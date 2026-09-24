# Phase 1 — NestJS + Prisma + PostgreSQL backend

**Status:** ✅ Done
**Period:** 31 August 2026 (commit `32ecdc8`)

## 1. Goal

Have a real application API that will serve as the source of logs and metrics for all later phases (observability, ML, alerting).

**Definition of Done (PRD):**
> API runs locally and produces structured JSON logs containing timestamp, level, message, context.

## 2. Deliverables

- **NestJS** REST API in `apps/backend`, with a full CRUD for the "taskmanager" domain entity.
- Data access through **Prisma** (ORM) on **PostgreSQL**; the database is named `taskmanager`.
- Connection configured through the `DATABASE_URL` environment variable.
- Structured JSON logger (`timestamp`, `level`, `message`, `context`), required by the PRD's DoD.

## 3. Later backend changes

| Phase | Addition |
|---|---|
| 1 / 6 | Structured JSON logs on `stdout` (`nestjs-pino`), planned from phase 1 by the PRD and consumed by Alloy and Loki in phase 6 |
| 8 | `Anomalies` module (CRUD + false positive), Prisma migration, unique constraint on `windowStart` |
| 9 | `/metrics` endpoint (Prometheus HTTP counter and histogram) |
| 10 | Filters, pagination, statistics and detail view for anomalies |

## 4. Lesson learned

The project was first developed on Windows and then continued on Linux: line endings (CRLF → LF) and `package-lock.json` had to be normalised (see phase 3).
