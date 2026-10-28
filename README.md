# CivicFix — Public Complaint & Resolution System

Citizens report civic issues (potholes, broken streetlights, water leaks, garbage, drainage). Officials route
them to field workers, track progress against department SLAs, and **unresolved complaints escalate
automatically** up the chain. A public **department scorecard** ranks resolution performance.

**Stack:** FastAPI · React (Vite) · PostgreSQL · MongoDB

## Data split

| PostgreSQL (relational, transactional) | MongoDB (flexible documents) |
|---|---|
| `users`, `departments` | `report_details` — category-specific fields (pothole depth, pole number, leak flow…) |
| `complaints` | `inspection_notes` — worker/official findings, severity, effort estimate |
| `assignments` — worker history | `discussions` — threaded messages, internal notes, system events |
| `deadlines` — SLA / extension / escalation, met or missed | `photos` — file metadata (stage, uploader, size, type) |
| `status_transitions` — full audit trail | |
| `escalations` — level, target, reason, auto/manual | |

## Distinctive feature: escalation + performance

- Each department has an SLA (e.g. Water 24h, Roads 72h). Creating a complaint sets its deadline.
- A background sweep runs every `ESCALATION_INTERVAL_SECONDS` (default 5 min). Any open complaint past its
  deadline climbs one level: **L1 Department Head → L2 Municipal Commissioner → L3 Mayor's Office**.
  Each step raises priority, marks the old deadline *missed*, and sets a shorter new one.
- Officials can escalate by hand. Citizens can escalate their own complaint once it's overdue.
- `/app/performance` ranks departments on **score = 40% resolution rate + 40% SLA compliance + 20% (100 − escalation rate)**,
  graded A–F, with comparison and trend charts. The landing page shows the same scorecard publicly.

## Roles

| Role | Can do |
|---|---|
| Citizen | Report issues with photos, track progress, discuss, close or reopen after a fix, escalate once overdue |
| Worker | See assigned tasks, start/hold/resolve, add inspection notes and progress photos |
| Official | Manage their department's queue, assign workers, extend deadlines, escalate, use the escalation center |
| Admin | Everything across all departments, plus staff management |

## Getting started

### 1. Databases
With Docker:
```bash
docker compose up -d
```
Without Docker, install PostgreSQL 16 and MongoDB 7 locally, then create the database:
```sql
CREATE USER civicfix WITH PASSWORD 'civicfix';
CREATE DATABASE civicfix OWNER civicfix;
```

### 2. Backend (http://localhost:8000, API docs at `/docs`)
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env          # macOS/Linux: cp; then edit as needed
python seed.py                  # resets both databases and loads demo data
uvicorn app.main:app --reload
```

### 3. Frontend (http://localhost:5173)
```bash
cd frontend
npm install
npm run dev
```
In development, Vite forwards `/api` and `/uploads` to the backend.

### Demo accounts (created by `seed.py`)
| Role | Email | Password |
|---|---|---|
| Admin | admin@civicfix.in | admin123 |
| Official | roads@civicfix.in (also elec, water, sani, gen) | official123 |
| Worker | roads.worker1@civicfix.in | worker123 |
| Citizen | citizen@civicfix.in | citizen123 |

## Project layout
```
backend/
  app/
    main.py              app, CORS, static uploads, background escalation loop
    models.py            SQLAlchemy models (PostgreSQL)
    mongo.py             MongoDB collections and indexes
    categories.py        issue categories, dynamic report fields, escalation levels
    services/workflow.py status state machine, deadlines, escalation logic
    routers/             auth, meta (departments/users), complaints, analytics/escalations
  seed.py
frontend/src/
  pages/                 Landing, Auth, Dashboard, ReportIssue, Complaints, ComplaintDetail,
                         Performance, Escalations, Staff
  components/            Layout (sidebar), ComplaintTable, ui (badges, stat cards, modal…)
```

## Status workflow
```
submitted → assigned → in_progress → resolved → closed
     ↘ rejected     ↘ on_hold ↗          ↘ reopened → in_progress
```
