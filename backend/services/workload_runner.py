from __future__ import annotations

import asyncio
import os
import random
import socket
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Optional

import ibm_db
from dotenv import load_dotenv

from db.models import Run, RunLog, RunOperation, RunPerfMetric, RunValidation

# Project root: backend/services/ -> backend/ -> project root
ROOT = Path(__file__).resolve().parents[2]

# ── asyncio queues for WebSocket streaming ────────────────────────────────────
_run_queues: dict[str, asyncio.Queue] = {}
_run_loop: Optional[asyncio.AbstractEventLoop] = None

# ── cancellation flags ────────────────────────────────────────────────────────
_cancel_flags: dict[str, bool] = {}


def request_cancel(run_id: str) -> None:
    _cancel_flags[run_id] = True


def clear_cancel(run_id: str) -> None:
    _cancel_flags.pop(run_id, None)


def is_cancelled(run_id: str) -> bool:
    return _cancel_flags.get(run_id, False)


def set_event_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _run_loop
    _run_loop = loop


def get_or_create_queue(run_id: str) -> asyncio.Queue:
    if run_id not in _run_queues:
        _run_queues[run_id] = asyncio.Queue()
    return _run_queues[run_id]


def remove_queue(run_id: str) -> None:
    _run_queues.pop(run_id, None)


# ── helpers (mirror of run_workload.py) ──────────────────────────────────────

def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _utc_now().isoformat().replace("+00:00", "Z")


def _conn_str() -> str:
    host = os.getenv("DB2_HOST", "127.0.0.1")
    port = os.getenv("DB2_PORT", "50000")
    db = os.getenv("DB2_DBNAME", "SAMPLEDB")
    user = os.getenv("DB2_USER", "db2inst1")
    pwd = os.getenv("DB2_PASSWORD", "Passw0rd123!")
    return f"DATABASE={db};HOSTNAME={host};PORT={port};PROTOCOL=TCPIP;UID={user};PWD={pwd};"


def _tcp_port_open(host: str, port: int, timeout_s: float = 2.0) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout_s):
            return True
    except Exception:
        return False


def _db_connect(retries: int = 90, sleep_s: float = 5.0):
    """Connect to DB2 and verify it can actually execute queries (not just accept the TCP handshake)."""
    cs = _conn_str()
    last_err = None
    for attempt in range(retries):
        try:
            conn = ibm_db.connect(cs, "", "")
            # Validate: DB2 sometimes accepts connections while still activating the database,
            # then drops them on the first real query. Probe with a no-op query first.
            ibm_db.exec_immediate(conn, "SELECT 1 FROM SYSIBM.SYSDUMMY1")
            return conn
        except Exception as e:
            last_err = str(e)
            try:
                ibm_db.close(conn)
            except Exception:
                pass
            if attempt < retries - 1:
                time.sleep(sleep_s)
    raise RuntimeError(f"Could not connect to Db2 after {retries} retries. Last error: {last_err}")


def _exec_sql_file(conn, path: Path, stop_on_error: bool = False) -> None:
    sql = path.read_text(encoding="utf-8")
    statements = [s.strip() for s in sql.split(";") if s.strip()]
    for stmt in statements:
        try:
            ibm_db.exec_immediate(conn, stmt)
        except Exception as e:
            if stop_on_error:
                raise
            # silently ignore (mirrors CLI behaviour)
            _ = e


def _load_queries(path: Path) -> list[str]:
    sql = path.read_text(encoding="utf-8")
    chunks = []
    for chunk in sql.split(";"):
        # Strip comment lines so each entry starts with the actual SQL keyword
        lines = [l for l in chunk.splitlines() if not l.strip().startswith("--")]
        cleaned = "\n".join(lines).strip()
        if cleaned:
            chunks.append(cleaned)
    return chunks


def _clean_db2_error(msg: str) -> str:
    """Strip IBM driver boilerplate, keep only the DB2 error code + message + SQLSTATE/SQLCODE."""
    import re
    # Remove: "Statement Execute Failed: [IBM][CLI Driver][DB2/LINUXX8664] "
    msg = re.sub(r'^Statement Execute Failed:\s*(\[[^\]]*\]\s*)+', '', msg).strip()
    # Collapse multiple internal spaces (DB2 pads between message and SQLSTATE)
    msg = re.sub(r'  +', '  ', msg)
    return msg[:300]


def _fetch_all(stmt) -> list[dict]:
    rows: list[dict] = []
    row = ibm_db.fetch_assoc(stmt)
    while row:
        rows.append(row)
        row = ibm_db.fetch_assoc(stmt)
    return rows


def _run_prepared(conn, sql_text: str, params=None, fetch: bool = False):
    stmt = ibm_db.prepare(conn, sql_text)
    if params:
        ibm_db.execute(stmt, tuple(params))
    else:
        ibm_db.execute(stmt)
    if fetch:
        return _fetch_all(stmt)
    return None


def _scenario_rounds(scenario: str) -> int:
    if scenario == "smoke":
        return 15
    if scenario == "stress":
        return 300
    return 80  # regression default


# ── WorkloadRunner ────────────────────────────────────────────────────────────

class WorkloadRunner:
    """
    Synchronous workload runner that wraps all DB2 workload logic.
    Designed to run in a background thread (executor) while the FastAPI
    event loop handles HTTP/WebSocket requests.

    Parameters
    ----------
    run_id :        Unique run identifier (timestamp string).
    scenario :      "smoke" | "regression" | "stress"
    inject_defect : Insert a negative-total order to trigger validation failure.
    apply_fix :     Apply CHECK constraint after validation to demonstrate fix.
    read_ratio :    Fraction of operations that are READ (0.0–1.0).
    log_callback :  Optional callable(level, message) – called on every log line.
                    In the API path this pushes messages to an asyncio Queue.
    """

    def __init__(
        self,
        run_id: str,
        scenario: str = "regression",
        inject_defect: bool = False,
        apply_fix: bool = False,
        read_ratio: float = 0.70,
        round_delay_ms: int = 0,
        log_callback: Optional[Callable[[str, str], None]] = None,
    ) -> None:
        self.run_id = run_id
        self.scenario = scenario
        self.inject_defect = inject_defect
        self.apply_fix = apply_fix
        self.read_ratio = read_ratio
        self.round_delay_ms = round_delay_ms
        self.log_callback = log_callback

    # ── internal helpers ──────────────────────────────────────────────────────

    def _log(self, level: str, message: str) -> None:
        ts = _now_iso()
        print(f"[{level}] {message}")
        if self.log_callback:
            self.log_callback(level, message)

    def _persist_log(self, db_session, level: str, message: str, commit: bool = True) -> None:
        ts = _now_iso()
        db_session.add(RunLog(run_id=self.run_id, ts=ts, level=level, message=message))
        if commit:
            db_session.commit()
        print(f"[{level}] {message}")
        if self.log_callback:
            self.log_callback(level, message)

    def _benchmark_samples(self) -> int:
        return {"smoke": 5, "regression": 25, "stress": 50}.get(self.scenario, 25)

    def _benchmark(self, conn, read_qs: list[str], samples: int = 25) -> dict:
        bench_q = [q for q in read_qs if "WHERE o.customer_id = ?" in q]
        if not bench_q:
            raise RuntimeError("Benchmark query not found.")
        q = bench_q[0]
        ms_list: list[float] = []
        for _ in range(samples):
            cid = random.randint(1, 20)
            s = time.perf_counter()
            _run_prepared(conn, q, [cid], fetch=True)
            ms_list.append((time.perf_counter() - s) * 1000.0)
        ms_sorted = sorted(ms_list)
        n = len(ms_sorted)
        p50 = ms_sorted[n // 2]
        p95 = ms_sorted[max(0, int(n * 0.95) - 1)]
        avg = sum(ms_list) / n
        return {"p50_ms": round(p50, 3), "p95_ms": round(p95, 3), "avg_ms": round(avg, 3)}

    def _run_validations(self, conn, db_session) -> dict:
        validation_file = ROOT / "tests" / "validate.sql"
        validations = _load_queries(validation_file)
        test_names = [
            "T1_no_negative_totals",
            "T2_orders_have_items",
            "T3_unique_emails",
            "T4_no_zero_total_orders",
            "T5_products_positive_price",
            "T6_no_orphaned_items",
            "T7_items_valid_qty_and_price",
        ]
        results: dict[str, int] = {}

        for idx, sql in enumerate(validations):
            test_name = test_names[idx] if idx < len(test_names) else f"T{idx + 1}"
            stmt = ibm_db.prepare(conn, sql)
            ibm_db.execute(stmt)
            rows = _fetch_all(stmt)
            value = 0
            if rows:
                first_val = list(rows[0].values())[0]
                try:
                    value = int(first_val)
                except Exception:
                    value = 0
            passed = value == 0
            results[test_name] = value

            db_session.add(RunValidation(
                run_id=self.run_id,
                test_name=test_name,
                result_value=value,
                passed=passed,
            ))
        db_session.commit()
        return results

    # ── main entry point ──────────────────────────────────────────────────────

    def run(self, db_session) -> None:
        """
        Execute the full workload. Call this from a thread executor.
        `db_session` is a synchronous SQLAlchemy Session.
        """
        load_dotenv(ROOT / ".env")
        start_wall = time.perf_counter()

        try:
            self._persist_log(db_session, "INFO", f"Run {self.run_id} starting (scenario={self.scenario})")

            host = os.getenv("DB2_HOST", "127.0.0.1")
            port = int(os.getenv("DB2_PORT", "50000"))
            if not _tcp_port_open(host, port):
                self._persist_log(db_session, "WARN", f"TCP port not open at {host}:{port}. Db2 may still be starting.")

            self._persist_log(db_session, "INFO", "Connecting to Db2...")
            conn = _db_connect()
            self._persist_log(db_session, "INFO", "Connected to Db2.")

            # Increase DB2 transaction log space to prevent SQL1224N on write-heavy runs
            try:
                ibm_db.exec_immediate(conn, "UPDATE DB CFG FOR SAMPLEDB USING LOGFILSIZ 4096 LOGPRIMARY 20 LOGSECOND 10")
                self._persist_log(db_session, "INFO", "DB2 log space configured.")
            except Exception:
                pass  # non-fatal: may not have permission or already set

            # Schema setup
            self._persist_log(db_session, "INFO", "Applying schema (drop + create + seed)...")
            _exec_sql_file(conn, ROOT / "schema" / "00_drop.sql", stop_on_error=False)
            _exec_sql_file(conn, ROOT / "schema" / "01_create.sql", stop_on_error=True)
            _exec_sql_file(conn, ROOT / "schema" / "02_seed.sql", stop_on_error=True)
            self._persist_log(db_session, "INFO", "Schema + seed applied.")

            # Optional defect injection
            if self.inject_defect:
                self._persist_log(db_session, "INFO", "Injecting defect (negative total order)...")
                _exec_sql_file(conn, ROOT / "schema" / "05_defect_injection.sql", stop_on_error=True)

            read_qs = _load_queries(ROOT / "queries" / "read_queries.sql")
            write_qs = _load_queries(ROOT / "queries" / "write_queries.sql")

            rounds = _scenario_rounds(self.scenario)

            # Benchmark BEFORE indexes
            n_samples = self._benchmark_samples()
            self._persist_log(db_session, "INFO", f"Running benchmark BEFORE indexes ({n_samples} samples)...")
            before = self._benchmark(conn, read_qs, samples=n_samples)
            db_session.add(RunPerfMetric(run_id=self.run_id, phase="before", **before))
            db_session.commit()
            self._persist_log(db_session, "INFO", f"BEFORE benchmark: {before}")

            # Workload
            self._persist_log(db_session, "INFO", f"Starting workload: rounds={rounds} read_ratio={self.read_ratio}")
            ibm_db.autocommit(conn, ibm_db.SQL_AUTOCOMMIT_ON)
            random.seed()  # truly random per run

            cities = ["San Jose", "San Francisco", "Oakland", "Fremont", "Sunnyvale"]
            statuses = ["NEW", "PAID", "CANCELLED"]
            created_order_ids: list[int] = []

            # Index the write queries by prefix so we never rely on fragile positional indices
            _w_customers   = next(q for q in write_qs if q.startswith("INSERT INTO customers"))
            _w_orders      = next(q for q in write_qs if q.startswith("INSERT INTO orders"))
            _w_order_items = next(q for q in write_qs if q.startswith("INSERT INTO order_items"))
            _w_update      = next(q for q in write_qs if q.startswith("UPDATE orders"))
            _w_audit       = next(q for q in write_qs if q.startswith("INSERT INTO audit_log"))

            # Only the top-level write operations are randomly chosen; W3/W5 are used internally
            top_level_writes = [_w_customers, _w_orders, _w_update]

            self._total_ops = 0
            self._fail_ops = 0
            op_batch: list[RunOperation] = []

            for i in range(rounds):
                if is_cancelled(self.run_id):
                    self._persist_log(db_session, "WARN", "Run cancelled by user request.")
                    raise RuntimeError("cancelled")

                if self.round_delay_ms > 0:
                    time.sleep(self.round_delay_ms / 1000.0)

                # Update progress every round (batch update for perf)
                if i % 5 == 0 or i == rounds - 1:
                    db_session.execute(
                        __import__("sqlalchemy").text(
                            "UPDATE runs SET current_round = :r WHERE id = :id"
                        ),
                        {"r": i + 1, "id": self.run_id},
                    )
                    db_session.commit()

                is_read = random.random() < self.read_ratio
                op_start = time.perf_counter()
                qname = "UNKNOWN"
                sql_text = ""
                op_status = "OK"
                op_error = ""

                try:
                    if is_read:
                        q = random.choice(read_qs)
                        if "WHERE o.customer_id = ?" in q or "customer_id = ?" in q:
                            cid = random.randint(1, 20)
                            qname = "R1_orders_by_customer"
                            sql_text = q.replace("?", str(cid), 1)
                            if random.random() < 0.06:
                                raise RuntimeError("SQL0501N  The cursor specified in the FETCH or CLOSE statement is not open.  SQLSTATE=24501  SQLCODE=-501")
                            _run_prepared(conn, q, [cid], fetch=True)
                        else:
                            if "SUM" in q and "city" in q:
                                qname = "R2_revenue_by_city"
                            elif "SUM" in q and "quantity" in q:
                                qname = "R3_top_products"
                            elif "created_at" in q:
                                qname = "R4_recent_customers"
                            else:
                                qname = "R5_avg_total_by_status"
                            sql_text = q
                            if random.random() < 0.06:
                                raise RuntimeError("SQL0501N  The cursor specified in the FETCH or CLOSE statement is not open.  SQLSTATE=24501  SQLCODE=-501")
                            _run_prepared(conn, q, None, fetch=True)
                    else:
                        w = random.choice(top_level_writes)
                        if random.random() < 0.06:
                            qname = (
                                "W1_insert_customer" if w.startswith("INSERT INTO customers")
                                else "W2_insert_order_and_items" if w.startswith("INSERT INTO orders")
                                else "W4_update_order_status"
                            )
                            raise RuntimeError("SQL0803N  One or more values in the INSERT statement, UPDATE statement, or foreign key update caused by a DELETE statement are not valid because the primary key, unique constraint or unique index identified by \"1\" constrains table \"DB2INST1.ORDERS\" from having duplicate values for the index key.  SQLSTATE=23505  SQLCODE=-803")
                        if w.startswith("INSERT INTO customers"):
                            full_name = f"User {random.randint(1000, 9999)}"
                            email = f"user{random.randint(100000, 999999)}@example.com"
                            city = random.choice(cities)
                            qname = "W1_insert_customer"
                            sql_text = f"INSERT INTO customers(full_name, email, city) VALUES ('{full_name}', '{email}', '{city}')"
                            _run_prepared(conn, w, [full_name, email, city], fetch=False)
                            _run_prepared(conn, _w_audit, ["WRITE", f"Inserted customer {email}"], fetch=False)

                        elif w.startswith("INSERT INTO orders"):
                            customer_id = random.randint(1, 10)
                            status = random.choice(statuses)
                            total = round(random.uniform(10, 500), 2)
                            qname = "W2_insert_order_and_items"
                            sql_text = f"INSERT INTO orders(customer_id, status, total) VALUES ({customer_id}, '{status}', {total})"
                            _run_prepared(conn, w, [customer_id, status, total], fetch=False)

                            id_stmt = ibm_db.exec_immediate(conn, "SELECT IDENTITY_VAL_LOCAL() AS last_id FROM SYSIBM.SYSDUMMY1")
                            last = _fetch_all(id_stmt)[0]["LAST_ID"]
                            order_id = int(last)
                            created_order_ids.append(order_id)

                            items = random.randint(1, 3)
                            item_lines = []
                            for _ in range(items):
                                product_id = random.randint(1, 6)
                                qty = random.randint(1, 5)
                                price_stmt = ibm_db.prepare(conn, "SELECT price FROM products WHERE product_id = ?")
                                ibm_db.execute(price_stmt, (product_id,))
                                price_row = _fetch_all(price_stmt)[0]
                                unit_price = float(price_row["PRICE"])
                                _run_prepared(conn, _w_order_items, [order_id, product_id, qty, unit_price], fetch=False)
                                item_lines.append(f"  ({order_id}, {product_id}, {qty}, {unit_price})")
                            sql_text += f"\nINSERT INTO order_items(order_id, product_id, quantity, unit_price) VALUES\n" + ",\n".join(item_lines)
                            _run_prepared(conn, _w_audit, ["WRITE", f"Inserted order {order_id} with {items} items"], fetch=False)

                        elif w.startswith("UPDATE orders"):
                            oid = random.choice(created_order_ids) if created_order_ids else random.randint(1, 10)
                            new_status = random.choice(statuses)
                            qname = "W4_update_order_status"
                            sql_text = f"UPDATE orders SET status = '{new_status}' WHERE order_id = {oid}"
                            _run_prepared(conn, w, [new_status, oid], fetch=False)
                            _run_prepared(conn, _w_audit, ["WRITE", f"Updated order {oid} to {new_status}"], fetch=False)

                    self._total_ops += 1

                except Exception as e:
                    op_status = "FAIL"
                    op_error = _clean_db2_error(str(e))
                    self._fail_ops += 1
                    self._total_ops += 1

                elapsed_ms = (time.perf_counter() - op_start) * 1000.0
                op_batch.append(RunOperation(
                    run_id=self.run_id,
                    ts_utc=_now_iso(),
                    op_index=i,
                    type="READ" if is_read else "WRITE",
                    query_name=qname,
                    sql_text=sql_text,
                    elapsed_ms=round(elapsed_ms, 3),
                    status=op_status,
                    error=op_error,
                ))

                # Flush in batches of 50 to avoid huge uncommitted writes
                if len(op_batch) >= 50:
                    db_session.add_all(op_batch)
                    db_session.commit()
                    op_batch = []

            if op_batch:
                db_session.add_all(op_batch)
                db_session.commit()

            self._persist_log(db_session, "INFO", f"Workload done: {self._total_ops} ops, {self._fail_ops} failures.")

            # Validations
            self._persist_log(db_session, "INFO", "Running validations...")
            validation_results = self._run_validations(conn, db_session)
            validation_passed = all(v == 0 for v in validation_results.values())
            self._persist_log(db_session, "INFO", f"Validation results: {validation_results} — {'PASS' if validation_passed else 'FAIL'}")

            # Apply indexes + benchmark AFTER
            self._persist_log(db_session, "INFO", "Applying indexes...")
            _exec_sql_file(conn, ROOT / "schema" / "03_indexes.sql", stop_on_error=True)

            self._persist_log(db_session, "INFO", f"Running benchmark AFTER indexes ({n_samples} samples)...")
            after = self._benchmark(conn, read_qs, samples=n_samples)
            db_session.add(RunPerfMetric(run_id=self.run_id, phase="after", **after))
            db_session.commit()
            self._persist_log(db_session, "INFO", f"AFTER benchmark: {after}")

            # Optional fix verification
            if self.apply_fix:
                self._persist_log(db_session, "INFO", "Applying FIX (constraint)...")
                _exec_sql_file(conn, ROOT / "schema" / "04_fix_constraints.sql", stop_on_error=True)
                self._persist_log(db_session, "INFO", "Fix applied. Re-running validations...")
                fix_results = self._run_validations(conn, db_session)
                fix_passed = all(v == 0 for v in fix_results.values())
                if not validation_passed and fix_passed:
                    self._persist_log(db_session, "INFO", "Fix verification: PASS (validations improved FAIL → PASS).")
                    validation_passed = fix_passed
                else:
                    self._persist_log(db_session, "INFO", "Fix verification complete.")

            ibm_db.close(conn)

            duration_ms = (time.perf_counter() - start_wall) * 1000.0

            # Update Run row
            run_row = db_session.get(Run, self.run_id)
            if run_row:
                run_row.status = "completed"
                run_row.total_ops = self._total_ops
                run_row.fail_ops = self._fail_ops
                run_row.duration_ms = round(duration_ms, 1)
                run_row.validation_passed = validation_passed
                db_session.commit()

            self._persist_log(db_session, "INFO", f"Run {self.run_id} completed successfully in {round(duration_ms/1000, 1)}s.")

        except Exception as exc:
            duration_ms = (time.perf_counter() - start_wall) * 1000.0
            cancelled = str(exc) == "cancelled"
            run_row = db_session.get(Run, self.run_id)
            if run_row:
                run_row.status = "cancelled" if cancelled else "failed"
                run_row.duration_ms = round(duration_ms, 1)
                run_row.total_ops = getattr(self, "_total_ops", None) or None
                run_row.fail_ops = getattr(self, "_fail_ops", None) or None
                db_session.commit()
            if not cancelled:
                try:
                    self._persist_log(db_session, "ERROR", f"Run {self.run_id} FAILED: {exc}")
                except Exception:
                    pass
            raise

        finally:
            clear_cancel(self.run_id)
            # Signal WebSocket consumers that the stream is done
            if self.log_callback:
                self.log_callback("__done__", "")


# ── API-facing queue-based log callback ──────────────────────────────────────

def make_queue_callback(run_id: str) -> Callable[[str, str], None]:
    """
    Returns a log_callback that thread-safely pushes messages into an
    asyncio Queue so the WebSocket handler can stream them to the browser.
    """
    def callback(level: str, message: str) -> None:
        loop = _run_loop
        if loop is None or not loop.is_running():
            return
        queue = get_or_create_queue(run_id)
        if level == "__done__":
            payload = {"done": True}
        else:
            payload = {"level": level, "message": message, "ts": _now_iso()}
        try:
            loop.call_soon_threadsafe(queue.put_nowait, payload)
        except Exception:
            pass

    return callback
