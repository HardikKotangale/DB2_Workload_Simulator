from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from db.database import SyncSessionLocal
from db.models import Run
from services.exporter import export_csv, export_pdf

router = APIRouter(prefix="/api/runs", tags=["export"])


@router.get("/{run_id}/export")
def export_run(
    run_id: str,
    format: str = Query("csv"),
):
    if format not in ("csv", "pdf"):
        raise HTTPException(status_code=400, detail="format must be 'csv' or 'pdf'")

    with SyncSessionLocal() as db:
        run = db.get(Run, run_id)
        if not run:
            raise HTTPException(status_code=404, detail="Run not found")

        if format == "csv":
            data = export_csv(run_id, db)
            return Response(
                content=data,
                media_type="text/csv",
                headers={"Content-Disposition": f'attachment; filename="run_{run_id}.csv"'},
            )
        else:
            data = export_pdf(run_id, db)
            return Response(
                content=data,
                media_type="application/pdf",
                headers={"Content-Disposition": f'attachment; filename="run_{run_id}.pdf"'},
            )
