from __future__ import annotations

import asyncio
import json

from fastapi import WebSocket, WebSocketDisconnect

from services.workload_runner import get_or_create_queue


async def websocket_run_logs(websocket: WebSocket, run_id: str) -> None:
    """Stream live log lines from a running workload to the WebSocket client."""
    await websocket.accept()
    queue = get_or_create_queue(run_id)

    try:
        while True:
            try:
                msg = await asyncio.wait_for(queue.get(), timeout=30.0)
                await websocket.send_text(json.dumps(msg))
                if msg.get("done"):
                    break
            except asyncio.TimeoutError:
                # Send a keep-alive ping so the connection doesn't time out
                try:
                    await websocket.send_text(json.dumps({"ping": True}))
                except Exception:
                    break
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
