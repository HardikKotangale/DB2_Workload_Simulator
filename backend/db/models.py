from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey, Integer, String
)
from sqlalchemy.orm import DeclarativeBase, relationship
from datetime import datetime


class Base(DeclarativeBase):
    pass


class Run(Base):
    __tablename__ = "runs"

    id = Column(String, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    scenario = Column(String, nullable=False)
    status = Column(String, nullable=False, default="running")  # running | completed | failed
    rounds = Column(Integer, nullable=False)
    read_ratio = Column(Float, nullable=False)
    inject_defect = Column(Boolean, nullable=False, default=False)
    apply_fix = Column(Boolean, nullable=False, default=False)
    current_round = Column(Integer, nullable=True, default=0)
    total_ops = Column(Integer, nullable=True)
    fail_ops = Column(Integer, nullable=True)
    duration_ms = Column(Float, nullable=True)
    validation_passed = Column(Boolean, nullable=True)

    operations = relationship("RunOperation", back_populates="run", cascade="all, delete-orphan")
    perf_metrics = relationship("RunPerfMetric", back_populates="run", cascade="all, delete-orphan")
    validations = relationship("RunValidation", back_populates="run", cascade="all, delete-orphan")
    logs = relationship("RunLog", back_populates="run", cascade="all, delete-orphan")


class RunOperation(Base):
    __tablename__ = "run_operations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String, ForeignKey("runs.id"), nullable=False, index=True)
    ts_utc = Column(String, nullable=False)
    op_index = Column(Integer, nullable=False)
    type = Column(String, nullable=False)
    query_name = Column(String, nullable=False)
    sql_text = Column(String, nullable=False, default="")
    elapsed_ms = Column(Float, nullable=False)
    status = Column(String, nullable=False)
    error = Column(String, nullable=False, default="")

    run = relationship("Run", back_populates="operations")


class RunPerfMetric(Base):
    __tablename__ = "run_perf_metrics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String, ForeignKey("runs.id"), nullable=False, index=True)
    phase = Column(String, nullable=False)  # before | after
    p50_ms = Column(Float, nullable=False)
    p95_ms = Column(Float, nullable=False)
    avg_ms = Column(Float, nullable=False)

    run = relationship("Run", back_populates="perf_metrics")


class RunValidation(Base):
    __tablename__ = "run_validations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String, ForeignKey("runs.id"), nullable=False, index=True)
    test_name = Column(String, nullable=False)
    result_value = Column(Integer, nullable=False)
    passed = Column(Boolean, nullable=False)

    run = relationship("Run", back_populates="validations")


class RunLog(Base):
    __tablename__ = "run_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String, ForeignKey("runs.id"), nullable=False, index=True)
    ts = Column(String, nullable=False)
    level = Column(String, nullable=False)
    message = Column(String, nullable=False)

    run = relationship("Run", back_populates="logs")


class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    cron_expression = Column(String, nullable=False)
    scenario = Column(String, nullable=False, default="regression")
    inject_defect = Column(Boolean, nullable=False, default=False)
    read_ratio = Column(Float, nullable=False, default=0.7)
    enabled = Column(Boolean, nullable=False, default=True)
    last_run_at = Column(DateTime, nullable=True)
    next_run_at = Column(DateTime, nullable=True)
