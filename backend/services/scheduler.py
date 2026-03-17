from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

scheduler = AsyncIOScheduler()


async def start_scheduler(app: Any) -> None:
    """Load enabled schedules from DB and start APScheduler."""
    from db.database import SyncSessionLocal
    from db.models import Schedule

    with SyncSessionLocal() as session:
        schedules = session.query(Schedule).filter(Schedule.enabled == True).all()
        for sched in schedules:
            _register_job(sched)

    scheduler.start()


def _register_job(sched) -> None:
    """Register an APScheduler job for a Schedule row."""
    try:
        trigger = CronTrigger.from_crontab(sched.cron_expression)
    except Exception:
        return

    job_id = f"schedule_{sched.id}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)

    scheduler.add_job(
        _run_scheduled_workload,
        trigger=trigger,
        id=job_id,
        args=[sched.id],
        replace_existing=True,
        misfire_grace_time=60,
    )


def add_schedule_job(sched) -> None:
    _register_job(sched)


def remove_schedule_job(schedule_id: int) -> None:
    job_id = f"schedule_{schedule_id}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)


async def _run_scheduled_workload(schedule_id: int) -> None:
    """Triggered by APScheduler — creates a Run and executes WorkloadRunner."""
    from db.database import SyncSessionLocal
    from db.models import Run, Schedule
    from services.workload_runner import WorkloadRunner, make_queue_callback

    loop = asyncio.get_event_loop()

    with SyncSessionLocal() as session:
        sched = session.get(Schedule, schedule_id)
        if sched is None or not sched.enabled:
            return

        run_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S") + f"_sched{schedule_id}"
        scenario_rounds_map = {"smoke": 15, "regression": 80, "stress": 300}
        rounds = scenario_rounds_map.get(sched.scenario, 80)

        run_row = Run(
            id=run_id,
            scenario=sched.scenario,
            status="running",
            rounds=rounds,
            read_ratio=sched.read_ratio,
            inject_defect=sched.inject_defect,
            apply_fix=False,
        )
        session.add(run_row)
        session.commit()

        sched.last_run_at = datetime.now(timezone.utc)
        session.commit()

    def _run_in_thread() -> None:
        with SyncSessionLocal() as db:
            callback = make_queue_callback(run_id)
            runner = WorkloadRunner(
                run_id=run_id,
                scenario=sched.scenario,  # type: ignore[union-attr]
                inject_defect=sched.inject_defect,  # type: ignore[union-attr]
                apply_fix=False,
                read_ratio=sched.read_ratio,  # type: ignore[union-attr]
                log_callback=callback,
            )
            runner.run(db)

    await loop.run_in_executor(None, _run_in_thread)
