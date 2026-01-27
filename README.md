# IBM Db2 Workload Simulator & Query Analysis Tool

This project is a lightweight, enterprise-style **Db2 workload simulator** designed to demonstrate
database schema management, SQL query workloads, diagnostics, defect detection, fix verification,
and performance benchmarking.

The application simulates real-world backend/database engineering workflows such as:
- Executing mixed read/write SQL workloads
- Running validation test cases
- Performing defect injection and fix verification
- Collecting diagnostics and performance metrics
- Generating structured artifacts for analysis

---

## Project Structure

```
DB2_Workload_Simulator/
├── .venv/
├── out/
├── queries/
│   ├── read_queries.sql
│   └── write_queries.sql
├── schema/
│   ├── 00_drop.sql
│   ├── 01_create.sql
│   ├── 02_seed.sql
│   ├── 03_indexes.sql
│   ├── 04_fix_constraints.sql
│   └── 05_defect_injection.sql
├── tests/
│   └── validate.sql
├── workloads/
│   └── run_workload.py
├── .env.example
├── .env
├── docker-compose.yml
├── requirements.txt
└── README.md
```

---

## Prerequisites

- Docker & Docker Compose
- Python 3.11 / 3.12
- macOS / Linux / Windows

---

## Commands to Run the Project

### Start Db2 and verify health

```bash
docker compose up -d
docker compose ps
```

To stop and reset Db2:

```bash
docker compose down -v
```

---

### Create environment file

```bash
cp .env.example .env
```

---

### Install Python dependencies

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

---

### Confirm Db2 database exists

Verify:
```bash
docker exec -it db2-community bash -lc "su - db2inst1 -c 'db2 list db directory'"
```

Create if missing:
```bash
docker exec -it db2-community bash -lc "su - db2inst1 -c 'db2 create database SAMPLEDB'"
```

---

## Running the Application

### Regression workload
```bash
python workloads/run_workload.py --scenario regression
```

### Smoke test
```bash
python workloads/run_workload.py --scenario smoke
```

### Defect injection + fix verification
```bash
python workloads/run_workload.py --scenario regression --inject-defect --apply-fix
```

---

## Generated Outputs

All execution artifacts are written to the `out/` directory:
- diagnostics JSON
- workload CSV/JSON logs
- validation results
- performance reports (before/after indexes)

---

## Key Engineering Concepts

- Db2 schema design
- SQL workload execution
- Validation and defect verification
- Performance benchmarking
- Enterprise-style diagnostics

---

