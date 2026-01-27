import os
import time
import json
import csv
import random
import argparse
import socket
from pathlib import Path
from datetime import datetime, timezone
from dotenv import load_dotenv
import ibm_db

ROOT = Path(__file__).resolve().parents[1]

def utc_now():
    return datetime.now(timezone.utc)

def now_iso():
    return utc_now().isoformat().replace("+00:00", "Z")

def conn_str():
    host = os.getenv("DB2_HOST", "127.0.0.1")
    port = os.getenv("DB2_PORT", "50000")
    db = os.getenv("DB2_DBNAME", "SAMPLEDB")
    user = os.getenv("DB2_USER", "db2inst1")
    pwd = os.getenv("DB2_PASSWORD", "Passw0rd123!")
    return f"DATABASE={db};HOSTNAME={host};PORT={port};PROTOCOL=TCPIP;UID={user};PWD={pwd};"

def ensure_out_dir():
    out_dir = ROOT / "out"
    out_dir.mkdir(exist_ok=True)
    return out_dir

def tcp_port_open(host: str, port: int, timeout_s: float = 2.0) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout_s):
            return True
    except Exception:
        return False

def db_connect(retries=90, sleep_s=5):
    cs = conn_str()
    last_err = None
    for _ in range(retries):
        try:
            c = ibm_db.connect(cs, "", "")
            return c
        except Exception as e:
            last_err = str(e)
            time.sleep(sleep_s)
    raise RuntimeError(f"Could not connect to Db2 after retries. Last error: {last_err}")

def exec_sql_file(conn, path: Path, stop_on_error=False):
    sql = path.read_text(encoding="utf-8")
    statements = [s.strip() for s in sql.split(";") if s.strip()]
    for stmt in statements:
        try:
            ibm_db.exec_immediate(conn, stmt)
        except Exception as e:
            if stop_on_error:
                raise
            print(f"[WARN] SQL failed (ignored): {stmt[:90]}... -> {e}")

def load_queries(path: Path):
    sql = path.read_text(encoding="utf-8")
    return [c.strip() for c in sql.split(";") if c.strip()]

def fetch_all(stmt):
    rows = []
    row = ibm_db.fetch_assoc(stmt)
    while row:
        rows.append(row)
        row = ibm_db.fetch_assoc(stmt)
    return rows

def run_prepared(conn, sql_text, params=None, fetch=False):
    stmt = ibm_db.prepare(conn, sql_text)
    if params:
        ibm_db.execute(stmt, tuple(params))
    else:
        ibm_db.execute(stmt)
    if fetch:
        return fetch_all(stmt)
    return None

def write_json(path: Path, obj):
    path.write_text(json.dumps(json_safe(obj), indent=2), encoding="utf-8")

def json_safe(obj):
    if isinstance(obj, dict):
        return {k: json_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [json_safe(v) for v in obj]
    if isinstance(obj, datetime):
        return obj.isoformat()
    return obj

def log_results_csv(csv_path: Path, records):
    if not records:
        return
    is_new = not csv_path.exists()
    with csv_path.open("a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(records[0].keys()))
        if is_new:
            w.writeheader()
        for r in records:
            w.writerow(r)

def diagnostics(conn, run_id: str, out_dir: Path):
    info = {"run_id": run_id, "ts_utc": now_iso()}

    # Basic "is Db2 responding"
    try:
        stmt = ibm_db.exec_immediate(conn, "SELECT CURRENT TIMESTAMP AS now FROM SYSIBM.SYSDUMMY1")
        info["db2_current_timestamp"] = fetch_all(stmt)[0]["NOW"]
        info["db2_ping"] = "OK"
    except Exception as e:
        info["db2_ping"] = "FAIL"
        info["db2_ping_error"] = str(e)[:250]

    # Instance info (may vary by edition/permissions)
    try:
        q = "SELECT service_level, fixpack_num, platform, inst_name FROM TABLE(sysproc.env_get_inst_info()) AS t"
        stmt = ibm_db.exec_immediate(conn, q)
        rows = fetch_all(stmt)
        info["instance_info"] = rows[0] if rows else {}
    except Exception as e:
        info["instance_info_error"] = str(e)[:250]

    path = out_dir / f"diagnostics_{run_id}.json"
    write_json(path, info)
    print(f"[INFO] Diagnostics written: {path}")
    return info

def run_validations(conn, out_dir: Path, run_id: str):
    print("[INFO] Running validation tests...")
    validations = load_queries(ROOT / "tests" / "validate.sql")
    results = {}
    for idx, t in enumerate(validations, start=1):
        stmt = ibm_db.prepare(conn, t)
        ibm_db.execute(stmt)
        rows = fetch_all(stmt)
        results[f"T{idx}"] = rows[0] if rows else {}
    val_path = out_dir / f"validation_{run_id}.json"
    write_json(val_path, results)
    print(f"[INFO] Validation results: {val_path}")
    print(results)
    return results

def any_validation_fail(results: dict) -> bool:
    # All your validations return a single count column; fail if any count > 0
    for _, row in results.items():
        for v in row.values():
            try:
                if int(v) > 0:
                    return True
            except Exception:
                continue
    return False

def benchmark_orders_by_customer(conn, read_qs, samples=25):
    bench_q = [q for q in read_qs if "WHERE o.customer_id = ?" in q]
    if not bench_q:
        raise RuntimeError("Benchmark query not found (orders by customer).")
    q = bench_q[0]
    ms_list = []
    for _ in range(samples):
        cid = random.randint(1, 20)
        s = time.perf_counter()
        run_prepared(conn, q, [cid], fetch=True)
        ms_list.append((time.perf_counter() - s) * 1000.0)

    ms_sorted = sorted(ms_list)
    p50 = ms_sorted[len(ms_sorted)//2]
    p95 = ms_sorted[int(len(ms_sorted)*0.95)-1]
    avg = sum(ms_list) / len(ms_list)
    return {"samples": samples, "p50_ms": round(p50, 3), "p95_ms": round(p95, 3), "avg_ms": round(avg, 3)}

def write_perf_report_md(path: Path, before: dict, after: dict):
    def pct_improve(b, a):
        if b <= 0:
            return "n/a"
        return f"{round(((b - a) / b) * 100.0, 2)}%"

    content = []
    content.append("# Db2 Performance Report (Before vs After Indexes)\n")
    content.append(f"- Generated: {now_iso()}\n")
    content.append("## Benchmark: R1_orders_by_customer\n")
    content.append("| Metric | Before Indexes (ms) | After Indexes (ms) | Improvement |\n")
    content.append("|---|---:|---:|---:|\n")

    for k in ["p50_ms", "p95_ms", "avg_ms"]:
        b = before[k]
        a = after[k]
        content.append(f"| {k} | {b} | {a} | {pct_improve(float(b), float(a))} |\n")

    path.write_text("".join(content), encoding="utf-8")

def parse_args():
    p = argparse.ArgumentParser(description="Db2 Workload Simulator & Query Analysis Tool")
    p.add_argument("--scenario", choices=["smoke", "regression", "stress"], default="regression",
                   help="Workload size profile (affects rounds).")
    p.add_argument("--inject-defect", action="store_true",
                   help="Inject an intentional defect (negative order total) and run validations.")
    p.add_argument("--apply-fix", action="store_true",
                   help="Apply fix (CHECK constraint) and re-run validations (for verification).")
    p.add_argument("--read-ratio", type=float, default=None,
                   help="Override READ ratio (0.0 - 1.0).")
    return p.parse_args()

def scenario_rounds(scn: str) -> int:
    if scn == "smoke":
        return 15
    if scn == "stress":
        return 300
    return 80  # regression default

def main():
    load_dotenv(ROOT / ".env")
    args = parse_args()
    out_dir = ensure_out_dir()
    run_id = utc_now().strftime("%Y%m%d_%H%M%S")

    host = os.getenv("DB2_HOST", "127.0.0.1")
    port = int(os.getenv("DB2_PORT", "50000"))
    if not tcp_port_open(host, port):
        print(f"[WARN] TCP port not open yet at {host}:{port}. Db2 container may still be starting.")

    print("[INFO] Connecting to Db2...")
    conn = db_connect()
    print("[INFO] Connected.")

    # Diagnostics
    diagnostics(conn, run_id, out_dir)

    # Setup schema
    print("[INFO] Applying schema...")
    exec_sql_file(conn, ROOT / "schema" / "00_drop.sql", stop_on_error=False)
    exec_sql_file(conn, ROOT / "schema" / "01_create.sql", stop_on_error=True)
    exec_sql_file(conn, ROOT / "schema" / "02_seed.sql", stop_on_error=True)
    print("[INFO] Schema + seed complete.")

    # Optional defect injection
    if args.inject_defect:
        print("[INFO] Injecting defect (negative total order)...")
        exec_sql_file(conn, ROOT / "schema" / "05_defect_injection.sql", stop_on_error=True)

    read_qs = load_queries(ROOT / "queries" / "read_queries.sql")
    write_qs = load_queries(ROOT / "queries" / "write_queries.sql")

    # Workload config
    rounds = int(os.getenv("WORKLOAD_ROUNDS", str(scenario_rounds(args.scenario))))
    read_ratio = float(os.getenv("READ_RATIO", "0.70"))
    if args.read_ratio is not None:
        read_ratio = args.read_ratio

    random.seed(7)

    # Performance benchmark BEFORE indexes
    print("[INFO] Benchmark BEFORE indexes...")
    before = benchmark_orders_by_customer(conn, read_qs, samples=25)

    records = []
    created_order_ids = []

    cities = ["San Jose", "San Francisco", "Oakland", "Fremont", "Sunnyvale"]
    statuses = ["NEW", "PAID", "CANCELLED"]

    print(f"[INFO] Running workload scenario={args.scenario} rounds={rounds} read_ratio={read_ratio}")
    ibm_db.autocommit(conn, ibm_db.SQL_AUTOCOMMIT_ON)

    for i in range(rounds):
        is_read = random.random() < read_ratio
        start = time.perf_counter()

        try:
            if is_read:
                q = random.choice(read_qs)
                if "WHERE o.customer_id = ?" in q:
                    cid = random.randint(1, 20)
                    run_prepared(conn, q, [cid], fetch=True)
                    qname = "R1_orders_by_customer"
                else:
                    run_prepared(conn, q, None, fetch=True)
                    if "SUM(o.total)" in q:
                        qname = "R2_revenue_by_city"
                    elif "SUM(oi.quantity)" in q:
                        qname = "R3_top_products"
                    elif "created_at" in q:
                        qname = "R4_recent_customers"
                    else:
                        qname = "R5_avg_total_by_status"
            else:
                w = random.choice(write_qs)
                if w.startswith("INSERT INTO customers"):
                    full_name = f"User {random.randint(1000, 9999)}"
                    email = f"user{random.randint(100000, 999999)}@example.com"
                    city = random.choice(cities)
                    run_prepared(conn, w, [full_name, email, city], fetch=False)
                    run_prepared(conn, write_qs[4], ["WRITE", f"Inserted customer {email}"], fetch=False)
                    qname = "W1_insert_customer"

                elif w.startswith("INSERT INTO orders"):
                    customer_id = random.randint(1, 10)
                    status = random.choice(statuses)
                    total = round(random.uniform(10, 500), 2)
                    run_prepared(conn, w, [customer_id, status, total], fetch=False)

                    stmt = ibm_db.exec_immediate(conn, "SELECT IDENTITY_VAL_LOCAL() AS last_id FROM SYSIBM.SYSDUMMY1")
                    last = fetch_all(stmt)[0]["LAST_ID"]
                    order_id = int(last)
                    created_order_ids.append(order_id)

                    items = random.randint(1, 3)
                    for _ in range(items):
                        product_id = random.randint(1, 6)
                        qty = random.randint(1, 5)
                        price_stmt = ibm_db.prepare(conn, "SELECT price FROM products WHERE product_id = ?")
                        ibm_db.execute(price_stmt, (product_id,))
                        price_row = fetch_all(price_stmt)[0]
                        unit_price = float(price_row["PRICE"])
                        run_prepared(conn, write_qs[2], [order_id, product_id, qty, unit_price], fetch=False)

                    run_prepared(conn, write_qs[4], ["WRITE", f"Inserted order {order_id} with {items} items"], fetch=False)
                    qname = "W2_insert_order_and_items"

                elif w.startswith("UPDATE orders"):
                    oid = random.choice(created_order_ids) if created_order_ids else random.randint(1, 10)
                    new_status = random.choice(statuses)
                    run_prepared(conn, w, [new_status, oid], fetch=False)
                    run_prepared(conn, write_qs[4], ["WRITE", f"Updated order {oid} to {new_status}"], fetch=False)
                    qname = "W4_update_order_status"

                else:
                    run_prepared(conn, w, ["INFO", f"noop event {i}"], fetch=False)
                    qname = "W5_audit_log"

            elapsed_ms = (time.perf_counter() - start) * 1000.0
            records.append({
                "run_id": run_id,
                "ts_utc": now_iso(),
                "op_index": i,
                "type": "READ" if is_read else "WRITE",
                "query_name": qname,
                "elapsed_ms": round(elapsed_ms, 3),
                "status": "OK",
                "error": ""
            })
        except Exception as e:
            elapsed_ms = (time.perf_counter() - start) * 1000.0
            records.append({
                "run_id": run_id,
                "ts_utc": now_iso(),
                "op_index": i,
                "type": "READ" if is_read else "WRITE",
                "query_name": "UNKNOWN",
                "elapsed_ms": round(elapsed_ms, 3),
                "status": "FAIL",
                "error": str(e)[:250]
            })

    # Save workload logs
    csv_path = out_dir / f"workload_{run_id}.csv"
    json_path = out_dir / f"workload_{run_id}.json"
    log_results_csv(csv_path, records)
    write_json(json_path, records)
    print(f"[INFO] Logs written: {csv_path} and {json_path}")

    # Validations (after workload, and after defect injection if enabled)
    results = run_validations(conn, out_dir, run_id)
    failed = any_validation_fail(results)

    # Apply indexes + benchmark AFTER indexes
    print("[INFO] Applying indexes...")
    exec_sql_file(conn, ROOT / "schema" / "03_indexes.sql", stop_on_error=True)

    print("[INFO] Benchmark AFTER indexes...")
    after = benchmark_orders_by_customer(conn, read_qs, samples=25)

    perf_summary = {
        "run_id": run_id,
        "ts_utc": now_iso(),
        "benchmark": "R1_orders_by_customer",
        "before_indexes": before,
        "after_indexes": after
    }
    perf_json = out_dir / f"perf_{run_id}.json"
    write_json(perf_json, perf_summary)

    perf_md = out_dir / f"perf_report_{run_id}.md"
    write_perf_report_md(perf_md, before, after)
    print(f"[INFO] Performance report: {perf_md}")
    print(f"[INFO] Performance JSON: {perf_json}")

    # Optional fix verification flow
    if args.apply_fix:
        print("[INFO] Applying FIX (constraint) for defect prevention...")
        exec_sql_file(conn, ROOT / "schema" / "04_fix_constraints.sql", stop_on_error=True)

        print("[INFO] Re-running validations after FIX...")
        fix_results = run_validations(conn, out_dir, f"{run_id}_after_fix")
        fix_failed = any_validation_fail(fix_results)

        if failed and not fix_failed:
            print("[INFO] Fix verification: PASS (validations improved from FAIL to PASS).")
        else:
            print("[INFO] Fix verification complete. Review validation JSON outputs in out/ directory.")

    ibm_db.close(conn)
    print("[DONE] Workload completed successfully.")

if __name__ == "__main__":
    main()
