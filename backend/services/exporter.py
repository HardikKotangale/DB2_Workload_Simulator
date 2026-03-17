from __future__ import annotations

import csv
import io
from typing import TYPE_CHECKING

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

from db.models import Run, RunOperation, RunPerfMetric, RunValidation


def export_csv(run_id: str, db_session) -> bytes:
    """Return CSV bytes for all RunOperation rows of the given run."""
    ops = db_session.query(RunOperation).filter(RunOperation.run_id == run_id).order_by(RunOperation.op_index).all()

    output = io.StringIO()
    fieldnames = ["run_id", "ts_utc", "op_index", "type", "query_name", "sql_text", "elapsed_ms", "status", "error"]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    for op in ops:
        writer.writerow({
            "run_id": op.run_id,
            "ts_utc": op.ts_utc,
            "op_index": op.op_index,
            "type": op.type,
            "query_name": op.query_name,
            "sql_text": op.sql_text,
            "elapsed_ms": op.elapsed_ms,
            "status": op.status,
            "error": op.error,
        })

    return output.getvalue().encode("utf-8")


def export_pdf(run_id: str, db_session) -> bytes:
    """Build and return a PDF report for the given run."""
    run: Run | None = db_session.get(Run, run_id)
    validations = db_session.query(RunValidation).filter(RunValidation.run_id == run_id).all()
    metrics = db_session.query(RunPerfMetric).filter(RunPerfMetric.run_id == run_id).all()

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=50, bottomMargin=40)
    styles = getSampleStyleSheet()
    elements = []

    # Title
    elements.append(Paragraph("DB2 Workload Simulator — Run Report", styles["Title"]))
    elements.append(Spacer(1, 12))

    # Run summary
    if run:
        elements.append(Paragraph("Run Summary", styles["Heading2"]))
        summary_data = [
            ["Field", "Value"],
            ["Run ID", run.id],
            ["Scenario", run.scenario],
            ["Status", run.status],
            ["Rounds", str(run.rounds)],
            ["Read Ratio", f"{run.read_ratio:.0%}"],
            ["Total Ops", str(run.total_ops or "—")],
            ["Failed Ops", str(run.fail_ops or "—")],
            ["Duration", f"{round(run.duration_ms / 1000, 2)}s" if run.duration_ms else "—"],
            ["Validation", "PASS" if run.validation_passed else ("FAIL" if run.validation_passed is False else "—")],
        ]
        summary_table = Table(summary_data, colWidths=[150, 300])
        summary_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("PADDING", (0, 0), (-1, -1), 6),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 20))

    # Performance Metrics
    if metrics:
        elements.append(Paragraph("Performance Benchmarks (Before vs After Indexes)", styles["Heading2"]))
        before = next((m for m in metrics if m.phase == "before"), None)
        after = next((m for m in metrics if m.phase == "after"), None)

        perf_data = [["Metric", "Before Indexes (ms)", "After Indexes (ms)", "Improvement"]]
        for key, label in [("p50_ms", "p50"), ("p95_ms", "p95"), ("avg_ms", "avg")]:
            b = getattr(before, key, None) if before else None
            a = getattr(after, key, None) if after else None
            if b and a and b > 0:
                pct = f"{round(((b - a) / b) * 100, 1)}%"
            else:
                pct = "—"
            perf_data.append([label, str(b) if b else "—", str(a) if a else "—", pct])

        perf_table = Table(perf_data, colWidths=[100, 150, 150, 120])
        perf_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("PADDING", (0, 0), (-1, -1), 6),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ]))
        elements.append(perf_table)
        elements.append(Spacer(1, 20))

    # Validations
    if validations:
        elements.append(Paragraph("Validation Results", styles["Heading2"]))
        val_data = [["Test", "Result Value", "Status"]]
        for v in validations:
            val_data.append([v.test_name, str(v.result_value), "PASS" if v.passed else "FAIL"])

        val_table = Table(val_data, colWidths=[220, 120, 80])
        val_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("PADDING", (0, 0), (-1, -1), 6),
        ]))
        elements.append(val_table)

    doc.build(elements)
    buffer.seek(0)
    return buffer.read()
