from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db.models import Run, RunPerfMetric, RunValidation
from api.routes.runs import _run_to_dict

router = APIRouter(prefix="/api/runs", tags=["compare"])


@router.get("/compare")
async def compare_runs(
    a: str = Query(..., description="First run ID"),
    b: str = Query(..., description="Second run ID"),
    db: AsyncSession = Depends(get_db),
):
    run_a = await db.get(Run, a)
    run_b = await db.get(Run, b)

    if not run_a:
        raise HTTPException(status_code=404, detail=f"Run '{a}' not found")
    if not run_b:
        raise HTTPException(status_code=404, detail=f"Run '{b}' not found")

    async def _get_metrics(run_id: str) -> dict:
        stmt = select(RunPerfMetric).where(RunPerfMetric.run_id == run_id)
        result = await db.execute(stmt)
        metrics = result.scalars().all()
        before = next((m for m in metrics if m.phase == "before"), None)
        after = next((m for m in metrics if m.phase == "after"), None)
        return {
            "before": {"p50_ms": before.p50_ms, "p95_ms": before.p95_ms, "avg_ms": before.avg_ms} if before else None,
            "after": {"p50_ms": after.p50_ms, "p95_ms": after.p95_ms, "avg_ms": after.avg_ms} if after else None,
        }

    async def _get_validations(run_id: str) -> list:
        stmt = select(RunValidation).where(RunValidation.run_id == run_id)
        result = await db.execute(stmt)
        vals = result.scalars().all()
        return [
            {"id": v.id, "run_id": v.run_id, "test_name": v.test_name, "result_value": v.result_value, "passed": v.passed}
            for v in vals
        ]

    metrics_a = await _get_metrics(a)
    metrics_b = await _get_metrics(b)
    validations_a = await _get_validations(a)
    validations_b = await _get_validations(b)

    return {
        "run_a": _run_to_dict(run_a),
        "run_b": _run_to_dict(run_b),
        "metrics_a": metrics_a,
        "metrics_b": metrics_b,
        "validations_a": validations_a,
        "validations_b": validations_b,
    }
