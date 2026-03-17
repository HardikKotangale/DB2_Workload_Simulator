from __future__ import annotations

import os
import socket
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from db.database import init_db
from api.routes import runs, compare, schedules, export
from api.websocket import websocket_run_logs
from services.scheduler import start_scheduler, scheduler
import services.workload_runner as workload_runner_module


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio
    # Initialise SQLite schema
    await init_db()
    # Store the running event loop so WorkloadRunner threads can push to queues
    workload_runner_module.set_event_loop(asyncio.get_event_loop())
    # Start APScheduler (loads persisted schedules)
    await start_scheduler(app)
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(
    title="DB2 Workload Simulator API",
    description="REST + WebSocket API for IBM Db2 workload simulation, benchmarking, and diagnostics.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers — compare MUST come before runs so /compare doesn't match /{run_id}
app.include_router(compare.router)
app.include_router(runs.router)
app.include_router(schedules.router)
app.include_router(export.router)


@app.websocket("/ws/runs/{run_id}")
async def ws_run_logs(websocket: WebSocket, run_id: str):
    await websocket_run_logs(websocket, run_id)


@app.get("/api/health", tags=["health"])
async def health():
    """Check app health and DB2 TCP connectivity."""
    host = os.getenv("DB2_HOST", "127.0.0.1")
    port = int(os.getenv("DB2_PORT", "50000"))
    try:
        with socket.create_connection((host, port), timeout=2.0):
            db2_status = "ok"
    except Exception:
        db2_status = "unreachable"

    return {"status": "ok", "db2": db2_status, "host": host, "port": port}
