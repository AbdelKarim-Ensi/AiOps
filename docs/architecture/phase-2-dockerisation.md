# Phase 2 — Backend containerisation

**Status:** ✅ Done
**Period:** 1 September 2026 (commit `2ab2fb2`)

## 1. Goal

Produce a reproducible, lightweight Docker image of the backend, and be able to run PostgreSQL locally without installing it.

**Definition of Done (PRD):**
> `docker compose up` starts the API and the database, endpoints reachable from outside.

## 2. Deliverables

- **Multi-stage Dockerfile** for the backend: a build stage, and a runtime stage reduced to what is needed to start the API.
- **`docker-compose`** running PostgreSQL for local development.

## 3. Points of attention

- The final image runs on Alpine: the Prisma `binaryTargets` had to be fixed in phase 8 for the Prisma client to work in this container.
- This is the image that CI builds and pushes (phase 3) and that Kubernetes deploys (phase 5).
