from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import Integer, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db, SyncSessionLocal
from db.models import Run, RunLog, RunOperation, RunPerfMetric, RunValidation
from services.workload_runner import WorkloadRunner, make_queue_callback, get_or_create_queue, request_cancel

router = APIRouter(prefix="/api/runs", tags=["runs"])

SCENARIO_ROUNDS = {"smoke": 15, "regression": 80, "stress": 300}


class RunCreate(BaseModel):
    scenario: str = "regression"
    inject_defect: bool = False
    apply_fix: bool = False
    read_ratio: float = 0.70
    round_delay_ms: int = 0


def _run_in_thread(run_id: str, scenario: str, inject_defect: bool, apply_fix: bool, read_ratio: float, round_delay_ms: int) -> None:
    """Synchronous function executed in a thread executor."""
    with SyncSessionLocal() as db:
        callback = make_queue_callback(run_id)
        runner = WorkloadRunner(
            run_id=run_id,
            scenario=scenario,
            inject_defect=inject_defect,
            apply_fix=apply_fix,
            read_ratio=read_ratio,
            round_delay_ms=round_delay_ms,
            log_callback=callback,
        )
        runner.run(db)


@router.post("/", status_code=201)
async def create_run(body: RunCreate, db: AsyncSession = Depends(get_db)):
    import secrets
    run_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S") + "_" + secrets.token_hex(2)
    rounds = SCENARIO_ROUNDS.get(body.scenario, 80)

    run = Run(
        id=run_id,
        created_at=datetime.now(timezone.utc),
        scenario=body.scenario,
        status="running",
        rounds=rounds,
        read_ratio=body.read_ratio,
        inject_defect=body.inject_defect,
        apply_fix=body.apply_fix,
    )
    db.add(run)
    await db.commit()

    # Pre-create the queue so WebSocket clients can connect immediately
    get_or_create_queue(run_id)

    # Launch workload in a background thread (WorkloadRunner is synchronous)
    loop = asyncio.get_event_loop()
    from services.workload_runner import set_event_loop
    set_event_loop(loop)
    loop.run_in_executor(
        None,
        _run_in_thread,
        run_id, body.scenario, body.inject_defect, body.apply_fix, body.read_ratio, body.round_delay_ms,
    )

    return {"id": run_id, "status": "running", "scenario": body.scenario, "rounds": rounds}


@router.get("/")
async def list_runs(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    status: Optional[str] = Query(None),
    scenario: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Run).order_by(Run.created_at.desc()).offset(skip).limit(limit)
    if status:
        stmt = stmt.where(Run.status == status)
    if scenario:
        stmt = stmt.where(Run.scenario == scenario)
    result = await db.execute(stmt)
    runs = result.scalars().all()
    return [_run_to_dict(r) for r in runs]


@router.delete("/", status_code=200)
async def delete_all_runs(db: AsyncSession = Depends(get_db)):
    """Delete all non-running runs and their related data."""
    from sqlalchemy import delete as sa_delete
    # Collect IDs of runs to delete
    id_result = await db.execute(select(Run.id).where(Run.status != "running"))
    run_ids = [r for (r,) in id_result.all()]
    if not run_ids:
        return {"deleted": 0}
    # Delete child records explicitly (async SQLAlchemy doesn't cascade lazily)
    for model in [RunLog, RunOperation, RunPerfMetric, RunValidation]:
        await db.execute(sa_delete(model).where(model.run_id.in_(run_ids)))
    await db.execute(sa_delete(Run).where(Run.id.in_(run_ids)))
    await db.commit()
    return {"deleted": len(run_ids)}


@router.delete("/{run_id}", status_code=200)
async def delete_run(run_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a single run and all its related data."""
    from sqlalchemy import delete as sa_delete
    run = await db.get(Run, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.status == "running":
        raise HTTPException(status_code=409, detail="Cannot delete a run that is currently running")
    for model in [RunLog, RunOperation, RunPerfMetric, RunValidation]:
        await db.execute(sa_delete(model).where(model.run_id == run_id))
    await db.execute(sa_delete(Run).where(Run.id == run_id))
    await db.commit()
    return {"deleted": run_id}


@router.post("/{run_id}/cancel", status_code=200)
async def cancel_run(run_id: str, db: AsyncSession = Depends(get_db)):
    run = await db.get(Run, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.status != "running":
        raise HTTPException(status_code=409, detail=f"Run is not running (status={run.status})")
    request_cancel(run_id)
    return {"id": run_id, "status": "cancelling"}


@router.get("/{run_id}")
async def get_run(run_id: str, db: AsyncSession = Depends(get_db)):
    run = await db.get(Run, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return _run_to_dict(run)


@router.get("/{run_id}/logs")
async def get_run_logs(
    run_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(RunLog)
        .where(RunLog.run_id == run_id)
        .order_by(RunLog.id)
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    logs = result.scalars().all()
    return [{"id": l.id, "run_id": l.run_id, "ts": l.ts, "level": l.level, "message": l.message} for l in logs]


@router.get("/{run_id}/operations")
async def get_run_operations(
    run_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    type: Optional[str] = Query(None, description="READ or WRITE"),
    status: Optional[str] = Query(None, description="OK or FAIL"),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(RunOperation)
        .where(RunOperation.run_id == run_id)
        .order_by(RunOperation.op_index)
        .offset(skip)
        .limit(limit)
    )
    if type:
        stmt = stmt.where(RunOperation.type == type.upper())
    if status:
        stmt = stmt.where(RunOperation.status == status.upper())
    result = await db.execute(stmt)
    ops = result.scalars().all()
    return [
        {
            "id": o.id,
            "op_index": o.op_index,
            "type": o.type,
            "query_name": o.query_name,
            "sql_text": o.sql_text,
            "elapsed_ms": o.elapsed_ms,
            "status": o.status,
            "error": o.error,
            "ts_utc": o.ts_utc,
        }
        for o in ops
    ]


@router.get("/{run_id}/operations/summary")
async def get_run_operations_summary(run_id: str, db: AsyncSession = Depends(get_db)):
    """Aggregated stats per query_name: count, avg_ms, fail_count."""
    from sqlalchemy import func
    stmt = (
        select(
            RunOperation.query_name,
            RunOperation.type,
            func.count(RunOperation.id).label("count"),
            func.avg(RunOperation.elapsed_ms).label("avg_ms"),
            func.min(RunOperation.elapsed_ms).label("min_ms"),
            func.max(RunOperation.elapsed_ms).label("max_ms"),
            func.sum(
                (RunOperation.status == "FAIL").cast(Integer)
            ).label("fail_count"),
        )
        .where(RunOperation.run_id == run_id)
        .group_by(RunOperation.query_name, RunOperation.type)
        .order_by(RunOperation.type, RunOperation.query_name)
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [
        {
            "query_name": r.query_name,
            "type": r.type,
            "count": r.count,
            "avg_ms": round(r.avg_ms, 3) if r.avg_ms else 0,
            "min_ms": round(r.min_ms, 3) if r.min_ms else 0,
            "max_ms": round(r.max_ms, 3) if r.max_ms else 0,
            "fail_count": r.fail_count or 0,
        }
        for r in rows
    ]


@router.get("/{run_id}/metrics")
async def get_run_metrics(run_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(RunPerfMetric).where(RunPerfMetric.run_id == run_id)
    result = await db.execute(stmt)
    metrics = result.scalars().all()

    before = next((m for m in metrics if m.phase == "before"), None)
    after = next((m for m in metrics if m.phase == "after"), None)

    return {
        "before": {"p50_ms": before.p50_ms, "p95_ms": before.p95_ms, "avg_ms": before.avg_ms} if before else None,
        "after": {"p50_ms": after.p50_ms, "p95_ms": after.p95_ms, "avg_ms": after.avg_ms} if after else None,
    }


@router.get("/{run_id}/validations")
async def get_run_validations(run_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(RunValidation).where(RunValidation.run_id == run_id)
    result = await db.execute(stmt)
    vals = result.scalars().all()
    return [
        {"id": v.id, "run_id": v.run_id, "test_name": v.test_name, "result_value": v.result_value, "passed": v.passed}
        for v in vals
    ]


def _run_to_dict(r: Run) -> dict:
    return {
        "id": r.id,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "scenario": r.scenario,
        "status": r.status,
        "rounds": r.rounds,
        "current_round": r.current_round or 0,
        "read_ratio": r.read_ratio,
        "inject_defect": r.inject_defect,
        "apply_fix": r.apply_fix,
        "total_ops": r.total_ops,
        "fail_ops": r.fail_ops,
        "duration_ms": r.duration_ms,
        "validation_passed": r.validation_passed,
    }


@router.get("/trend")
async def get_run_trend(
    limit: int = Query(20, ge=5, le=100),
    scenario: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Run)
        .where(Run.status == "completed")
        .order_by(Run.created_at.desc())
        .limit(limit)
    )
    if scenario:
        stmt = stmt.where(Run.scenario == scenario)
    result = await db.execute(stmt)
    runs = list(reversed(result.scalars().all()))
    return [
        {
            "id": r.id,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "scenario": r.scenario,
            "validation_passed": r.validation_passed,
            "duration_s": round(r.duration_ms / 1000, 1) if r.duration_ms else None,
            "fail_ops": r.fail_ops,
            "total_ops": r.total_ops,
        }
        for r in runs
    ]


@router.get("/{run_id}/throughput")
async def get_run_throughput(
    run_id: str,
    bucket_seconds: int = Query(10, ge=1, le=300),
    db: AsyncSession = Depends(get_db),
):
    import math
    from datetime import datetime as dt
    stmt = select(RunOperation.ts_utc, RunOperation.status).where(RunOperation.run_id == run_id)
    result = await db.execute(stmt)
    rows = result.all()
    if not rows:
        return []
    parsed = []
    for ts, status in rows:
        try:
            parsed.append((dt.fromisoformat(ts.replace("Z", "+00:00")).timestamp(), status))
        except Exception:
            continue
    if not parsed:
        return []
    min_ts = min(t for t, _ in parsed)
    buckets: dict[int, dict] = {}
    for t, status in parsed:
        idx = math.floor((t - min_ts) / bucket_seconds)
        if idx not in buckets:
            buckets[idx] = {"total": 0, "fail": 0}
        buckets[idx]["total"] += 1
        if status == "FAIL":
            buckets[idx]["fail"] += 1
    return [
        {
            "t": idx * bucket_seconds,
            "ops_per_sec": round(buckets[idx]["total"] / bucket_seconds, 2),
            "fail_per_sec": round(buckets[idx]["fail"] / bucket_seconds, 2),
        }
        for idx in sorted(buckets.keys())
    ]
