from __future__ import annotations

import asyncio
import secrets
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db, SyncSessionLocal
from db.models import Run, Schedule
from services.scheduler import add_schedule_job, remove_schedule_job

router = APIRouter(prefix="/api/schedules", tags=["schedules"])


class ScheduleCreate(BaseModel):
    name: str
    cron_expression: str
    scenario: str = "regression"
    inject_defect: bool = False
    read_ratio: float = 0.70


class ScheduleUpdate(BaseModel):
    name: Optional[str] = None
    cron_expression: Optional[str] = None
    scenario: Optional[str] = None
    inject_defect: Optional[bool] = None
    read_ratio: Optional[float] = None
    enabled: Optional[bool] = None


def _sched_to_dict(s: Schedule) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "cron_expression": s.cron_expression,
        "scenario": s.scenario,
        "inject_defect": s.inject_defect,
        "read_ratio": s.read_ratio,
        "enabled": s.enabled,
        "last_run_at": s.last_run_at.isoformat() if s.last_run_at else None,
        "next_run_at": s.next_run_at.isoformat() if s.next_run_at else None,
    }


@router.get("/")
async def list_schedules(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Schedule).order_by(Schedule.id))
    return [_sched_to_dict(s) for s in result.scalars().all()]


@router.post("/", status_code=201)
async def create_schedule(body: ScheduleCreate, db: AsyncSession = Depends(get_db)):
    sched = Schedule(
        name=body.name,
        cron_expression=body.cron_expression,
        scenario=body.scenario,
        inject_defect=body.inject_defect,
        read_ratio=body.read_ratio,
        enabled=True,
    )
    db.add(sched)
    await db.commit()
    await db.refresh(sched)
    add_schedule_job(sched)
    return _sched_to_dict(sched)


@router.patch("/{schedule_id}")
async def update_schedule(schedule_id: int, body: ScheduleUpdate, db: AsyncSession = Depends(get_db)):
    sched = await db.get(Schedule, schedule_id)
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found")

    if body.name is not None:
        sched.name = body.name
    if body.cron_expression is not None:
        sched.cron_expression = body.cron_expression
    if body.scenario is not None:
        sched.scenario = body.scenario
    if body.inject_defect is not None:
        sched.inject_defect = body.inject_defect
    if body.read_ratio is not None:
        sched.read_ratio = body.read_ratio
    if body.enabled is not None:
        sched.enabled = body.enabled

    await db.commit()
    await db.refresh(sched)

    # Re-register or remove job based on enabled flag
    if sched.enabled:
        add_schedule_job(sched)
    else:
        remove_schedule_job(schedule_id)

    return _sched_to_dict(sched)


@router.post("/{schedule_id}/run", status_code=201)
async def run_schedule_now(schedule_id: int, db: AsyncSession = Depends(get_db)):
    sched = await db.get(Schedule, schedule_id)
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found")

    from services.workload_runner import WorkloadRunner, make_queue_callback, get_or_create_queue, set_event_loop
    from api.routes.runs import SCENARIO_ROUNDS

    run_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S") + "_" + secrets.token_hex(2)
    rounds = SCENARIO_ROUNDS.get(sched.scenario, 80)
    run = Run(
        id=run_id,
        created_at=datetime.now(timezone.utc),
        scenario=sched.scenario,
        status="running",
        rounds=rounds,
        read_ratio=sched.read_ratio,
        inject_defect=sched.inject_defect,
        apply_fix=False,
    )
    db.add(run)
    await db.commit()
    get_or_create_queue(run_id)

    def _run_in_thread():
        with SyncSessionLocal() as sess:
            callback = make_queue_callback(run_id)
            runner = WorkloadRunner(
                run_id=run_id, scenario=sched.scenario,
                inject_defect=sched.inject_defect, apply_fix=False,
                read_ratio=sched.read_ratio, log_callback=callback,
            )
            runner.run(sess)

    loop = asyncio.get_event_loop()
    set_event_loop(loop)
    loop.run_in_executor(None, _run_in_thread)
    return {"id": run_id, "status": "running"}


@router.delete("/{schedule_id}", status_code=204)
async def delete_schedule(schedule_id: int, db: AsyncSession = Depends(get_db)):
    sched = await db.get(Schedule, schedule_id)
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found")
    remove_schedule_job(schedule_id)
    await db.delete(sched)
    await db.commit()
