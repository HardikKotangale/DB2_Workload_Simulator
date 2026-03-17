# DB2 Workload Simulator

A full-stack observability platform for **IBM DB2**. Trigger mixed read/write workloads from a web UI, stream live logs via WebSocket, measure index impact with before/after benchmarks, run automated data integrity checks, schedule recurring tests, and export results as CSV or PDF — all from a single browser tab.

---

## Screenshots

> **Landing Page** — product overview with top navbar

<!-- TODO: Add screenshot → docs/screenshots/landing.png -->
![Landing Page](docs/screenshots/landing.png)

> **Dashboard** — DB2 connection status, aggregate stats, recent runs, historical trend chart

<!-- TODO: Add screenshot → docs/screenshots/dashboard.png -->
![Dashboard](docs/screenshots/dashboard.png)

> **New Run** — scenario picker, read/write ratio slider, options, delay controls

<!-- TODO: Add screenshot → docs/screenshots/new_run.png -->
![New Run](docs/screenshots/new_run.png)

> **Run Details (Live)** — real-time progress bar and WebSocket log stream while a run is active

<!-- TODO: Add screenshot → docs/screenshots/run_details_live.png -->
![Run Details Live](docs/screenshots/run_details_live.png)

> **Run Details (Completed)** — performance charts, throughput, read/write donut, error rate, validation table

<!-- TODO: Add screenshot → docs/screenshots/run_details_completed.png -->
![Run Details Completed](docs/screenshots/run_details_completed.png)

> **Run Comparison** — side-by-side metric diff table and grouped bar chart for two runs

<!-- TODO: Add screenshot → docs/screenshots/run_comparison.png -->
![Run Comparison](docs/screenshots/run_comparison.png)

> **Run History** — searchable/filterable table of all runs with per-row and bulk delete

<!-- TODO: Add screenshot → docs/screenshots/history.png -->
![History](docs/screenshots/history.png)

> **Schedules** — cron schedule CRUD with human-readable descriptions and time-remaining countdown

<!-- TODO: Add screenshot → docs/screenshots/schedules.png -->
![Schedules](docs/screenshots/schedules.png)

---

## Features

| Feature | Description |
|---|---|
| **Workload Simulation** | Smoke (15 rounds), Regression (80), Stress (300) scenarios with configurable read/write ratio |
| **Performance Benchmarking** | p50 / p95 / avg latency measured before and after index application |
| **Data Validation** | 7 built-in integrity tests run automatically after every workload |
| **Live Log Streaming** | WebSocket-powered real-time log panel with progress bar and round counter |
| **Defect Injection** | Insert a negative-total order to trigger validation failures, then apply a CHECK constraint fix |
| **Run Scheduling** | APScheduler cron jobs configurable from the UI — every N minutes, daily, or custom |
| **Run Comparison** | Side-by-side p50/p95/avg diff table + grouped bar chart for any two completed runs |
| **Run History** | Persistent SQLite store; searchable, filterable, paginated table with per-row and bulk delete |
| **Charts** | Throughput over time (area), read/write split (donut), error rate (bar), historical trend (composed) |
| **CSV Export** | All operations including full SQL text, elapsed ms, status, and error |
| **PDF Export** | Formatted report with run summary, benchmark table, and validation results via ReportLab |
| **Random Failure Simulation** | ~6 % chance of simulated failure on both READ and WRITE ops for realistic mixed results |
| **WebSocket Reconnect** | Exponential backoff reconnect (up to 5 attempts) — navigate away and back without losing logs |
| **Hot Reload** | Backend mounts source code as a volume; uvicorn reloads on every file save |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser  (React 18 · TypeScript · Tailwind · Recharts)         │
│                                                                 │
│  Landing  Dashboard  NewRun  RunDetails  History  Schedules     │
│  RunComparison                                                  │
│         │  HTTP / REST  (Axios)       WebSocket                 │
└─────────┼───────────────────────────────┼───────────────────────┘
          │                               │
┌─────────▼───────────────────────────────▼───────────────────────┐
│  FastAPI  (Python 3.11 · Uvicorn · --reload)                    │
│                                                                 │
│  /api/runs          /api/schedules       /api/health            │
│  /api/runs/compare  /api/runs/{id}/export                       │
│  /ws/runs/{id}  ←── WebSocket live log stream                   │
│                                                                 │
│  WorkloadRunner (thread)   APScheduler   ReportLab exporter     │
│         │                                                       │
│  SQLite (SQLAlchemy async)  ←  run history, metrics, logs       │
└─────────┬───────────────────────────────────────────────────────┘
          │  ibm-db  (TCP 50000)
┌─────────▼───────────────────────────────────────────────────────┐
│  IBM DB2 Community Edition  (Docker · linux/amd64)              │
│  SAMPLEDB — customers, orders, order_items, products, audit_log │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Target database** | IBM DB2 Community Edition (Docker) |
| **Backend framework** | Python 3.11 · FastAPI · Uvicorn (hot-reload) |
| **ORM / persistence** | SQLAlchemy 2 (async) · aiosqlite · SQLite |
| **Scheduling** | APScheduler 3 |
| **PDF generation** | ReportLab |
| **DB2 driver** | ibm-db 3.2 |
| **Frontend** | React 18 · TypeScript · Vite |
| **Styling** | Tailwind CSS |
| **Charts** | Recharts |
| **Routing** | React Router v6 |
| **HTTP client** | Axios |
| **Container orchestration** | Docker · Docker Compose |

---

## Project Structure

```
DB2_Workload_Simulator/
├── backend/
│   ├── main.py                    # FastAPI app, CORS, lifespan, router mount
│   ├── Dockerfile                 # python:3.11-slim + ibm-db
│   ├── requirements.txt
│   ├── core/
│   │   └── config.py              # Pydantic Settings from .env
│   ├── db/
│   │   ├── database.py            # SQLite engine + async sessionmaker
│   │   └── models.py              # SQLAlchemy ORM models (Run, RunOperation, etc.)
│   ├── api/
│   │   ├── routes/
│   │   │   ├── runs.py            # CRUD, compare, trend, throughput, delete
│   │   │   ├── schedules.py       # Schedule CRUD + run-now endpoint
│   │   │   └── export.py          # CSV / PDF download
│   │   └── websocket.py           # WS /ws/runs/{id} live log stream
│   └── services/
│       ├── workload_runner.py     # WorkloadRunner class (executes in a thread)
│       ├── scheduler.py           # APScheduler integration
│       └── exporter.py            # ReportLab PDF builder + CSV writer
│
├── frontend/
│   ├── Dockerfile                 # Vite build → nginx static server
│   ├── nginx.conf                 # Reverse proxy /api/ and /ws/ to backend
│   ├── src/
│   │   ├── App.tsx                # Routes: / = Landing, /dashboard+ = app
│   │   ├── api/client.ts          # Typed Axios calls for every API endpoint
│   │   ├── hooks/
│   │   │   ├── useRuns.ts         # Fetch + auto-refresh run list
│   │   │   └── useWebSocket.ts    # WS hook with exponential backoff reconnect
│   │   ├── pages/
│   │   │   ├── Landing.tsx        # Product page with sticky top navbar
│   │   │   ├── Dashboard.tsx      # Overview: stats, trend chart, recent runs
│   │   │   ├── NewRun.tsx         # Configure and trigger a run
│   │   │   ├── RunDetails.tsx     # Live progress + completed analysis + export
│   │   │   ├── History.tsx        # Filterable, paginated run history table
│   │   │   ├── RunComparison.tsx  # Side-by-side run comparison
│   │   │   └── Schedules.tsx      # Cron schedule management
│   │   └── components/
│   │       ├── Layout.tsx         # Sidebar nav + DB2 status indicator
│   │       ├── LiveLog.tsx        # Auto-scrolling WebSocket log panel
│   │       ├── PerformanceChart.tsx  # Before/after grouped bar chart
│   │       ├── ThroughputChart.tsx   # Ops/sec area chart over time
│   │       ├── ReadWriteDonut.tsx    # READ vs WRITE pie chart
│   │       ├── ErrorRateChart.tsx    # Error rate horizontal bar chart
│   │       ├── TrendChart.tsx        # Historical run trend (composed chart)
│   │       ├── ValidationTable.tsx   # Pass/fail test results table
│   │       ├── MetricCard.tsx        # Stat card (p50 / p95 / avg / etc.)
│   │       ├── CompareChart.tsx      # Side-by-side comparison bar chart
│   │       └── StatusBadge.tsx       # running / completed / failed / cancelled pill
│
├── schema/
│   ├── 00_drop.sql                # Drop all tables (clean slate per run)
│   ├── 01_create.sql              # Create customers, orders, order_items, products, audit_log
│   ├── 02_seed.sql                # Seed reference data
│   ├── 03_indexes.sql             # Add performance indexes (benchmarked after)
│   ├── 04_fix_constraints.sql     # Apply CHECK constraint to fix defect
│   └── 05_defect_injection.sql    # Insert a negative-total order (defect)
│
├── queries/
│   ├── read_queries.sql           # SELECT queries used in workload rounds
│   └── write_queries.sql          # INSERT / UPDATE queries used in workload rounds
│
├── tests/
│   └── validate.sql               # 7 data integrity assertions
│
├── workloads/
│   └── run_workload.py            # Original CLI wrapper (still functional)
│
├── docker-compose.yml
├── .env                           # DB2 credentials — not committed, see .env.example
├── .env.example                   # Template for environment variables
└── requirements.txt               # CLI-only Python dependencies
```

---

## Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) with Compose v2
- ~6 GB free RAM (DB2 requires ~4 GB)
- macOS or Linux recommended (`linux/amd64` platform emulation required on Apple Silicon)

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/DB2_Workload_Simulator.git
cd DB2_Workload_Simulator
```

### 2. Create your `.env` file

```bash
cp .env.example .env
```

Edit `.env`:

```env
DB2_HOST=db2
DB2_PORT=50000
DB2_DBNAME=SAMPLEDB
DB2_USER=db2inst1
DB2_PASSWORD=Passw0rd123!
```

> `DB2_HOST=db2` is the Docker Compose service name — leave as-is when running via Compose.

### 3. Start all services

```bash
docker compose up -d
```

The first launch downloads the DB2 image (~1.8 GB) and initialises the database. This takes **3–8 minutes**. Monitor progress with:

```bash
docker compose logs -f db2
```

Wait until the logs show:

```
(*) Setup has completed.
```

### 4. Open the app

| URL | Description |
|---|---|
| `http://localhost:5173` | Landing page |
| `http://localhost:5173/dashboard` | Main dashboard |
| `http://localhost:8000/docs` | FastAPI interactive API docs (Swagger UI) |

---

## Running a Workload

1. Go to **New Run** (`/runs/new`)
2. Choose a **scenario**: Smoke · Regression · Stress
3. Drag the **read/write ratio** slider (default 70 % reads)
4. Optionally toggle **Inject Defect** to insert a negative-total order (triggers validation failures)
5. Optionally toggle **Apply Fix** to verify the CHECK constraint resolves the defect
6. Set a **Delay between rounds** to slow the run down (Off / 1s / 2s / 15s / 45s)
7. Click **Start Run**

The Run Details page opens and streams live logs. On completion, tabs for **Overview**, **Operations**, and **Log** become available with charts, validation results, and export buttons.

---

## Database Schema

The workload targets an e-commerce schema seeded into `SAMPLEDB`:

```
customers        orders           order_items
─────────        ──────           ───────────
customer_id  ←── customer_id      order_item_id
full_name        order_id     ←── order_id
email            status            product_id ──→ products
city             total             quantity
created_at       created_at        unit_price

audit_log
─────────
log_id
event_type
description
created_at
```

### Validation Tests

| ID | Name | What it checks |
|---|---|---|
| T1 | `T1_no_negative_totals` | No order has `total < 0` |
| T2 | `T2_orders_have_items` | Every order has at least one `order_items` row |
| T3 | `T3_unique_emails` | No duplicate `email` in `customers` |
| T4 | `T4_no_zero_total_orders` | No order has `total = 0` |
| T5 | `T5_products_positive_price` | All `products.price > 0` |
| T6 | `T6_no_orphaned_items` | All `order_items.order_id` reference a valid order |
| T7 | `T7_items_valid_qty_and_price` | All line items have `quantity ≥ 1` and `unit_price > 0` |

---

## API Reference

Base URL: `http://localhost:8000`
Interactive docs: `http://localhost:8000/docs`

### Runs

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/runs/` | Trigger a new run |
| `GET` | `/api/runs/` | List runs (filterable by status/scenario, paginated) |
| `GET` | `/api/runs/{id}` | Get a single run summary |
| `DELETE` | `/api/runs/{id}` | Delete a run and all its associated data |
| `DELETE` | `/api/runs/` | Delete all non-running runs |
| `POST` | `/api/runs/{id}/cancel` | Cancel a running run |
| `GET` | `/api/runs/{id}/logs` | Paginated log entries |
| `GET` | `/api/runs/{id}/operations` | Paginated operation records (filterable by type/status) |
| `GET` | `/api/runs/{id}/operations/summary` | Aggregated stats per query name |
| `GET` | `/api/runs/{id}/metrics` | Before/after benchmark JSON |
| `GET` | `/api/runs/{id}/validations` | Validation test results |
| `GET` | `/api/runs/{id}/export?format=csv` | Download operations as CSV |
| `GET` | `/api/runs/{id}/export?format=pdf` | Download PDF run report |
| `GET` | `/api/runs/compare?a={id}&b={id}` | Side-by-side comparison of two runs |
| `GET` | `/api/runs/trend` | Last N completed runs for historical trend chart |
| `GET` | `/api/runs/{id}/throughput` | Ops/sec bucketed time series |

### Schedules

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/schedules/` | List all schedules |
| `POST` | `/api/schedules/` | Create a new schedule |
| `PATCH` | `/api/schedules/{id}` | Update or enable/disable a schedule |
| `DELETE` | `/api/schedules/{id}` | Delete a schedule |
| `POST` | `/api/schedules/{id}/run` | Trigger a scheduled run immediately |

### Other

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | DB2 connectivity check |
| `WS` | `/ws/runs/{id}` | WebSocket live log stream |

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DB2_HOST` | `db2` | DB2 hostname (Docker Compose service name) |
| `DB2_PORT` | `50000` | DB2 TCP port |
| `DB2_DBNAME` | `SAMPLEDB` | Target database name |
| `DB2_USER` | `db2inst1` | DB2 username |
| `DB2_PASSWORD` | *(required)* | DB2 password |
| `SQLITE_DIR` | `/app/data` | Directory for the SQLite run-history database |

---

## Development

### Backend — hot reload (no rebuild needed)

`./backend` is mounted as a Docker volume and uvicorn runs with `--reload`. Save any `.py` file and the server reloads in ~1 second:

```bash
# Watch backend reload in real time
docker compose logs -f backend
```

Only rebuild when `requirements.txt` changes:

```bash
docker compose build backend && docker compose up -d backend
```

### Frontend — rebuild on source changes

```bash
docker compose build frontend && docker compose up -d frontend
```

### CLI mode (no Docker required)

The original CLI tool works without the web stack:

```bash
pip install -r requirements.txt
python workloads/run_workload.py --scenario smoke
python workloads/run_workload.py --scenario regression --inject-defect --apply-fix
```

---

## Scenarios at a Glance

| Scenario | Rounds | Approx. duration | Recommended use |
|---|---|---|---|
| `smoke` | 15 | ~30 s | CI/CD gate · post-deploy sanity check |
| `regression` | 80 | 2–3 min | Nightly runs · pre-release validation |
| `stress` | 300 | 8–12 min | Load testing · capacity planning |

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m "Add my feature"`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a pull request

---

## License

MIT License — see [LICENSE](LICENSE) for details.
