# Phase 5 — Kubernetes deployment of the API and PostgreSQL

**Status:** ✅ Done
**Period:** 10–13 September 2026 (commits `4de6264`, `b6ba594`; PRs #3 and #4)
**Cluster:** `aiops-cluster-tf`, namespace `aiops`

## 1. Goal

Deploy the backend and its database on Kubernetes, expose them through an Ingress, and automate deployment from CI.

**Definition of Done (PRD):**
> Application reachable through the Ingress (http://localhost), persistent data, CI/CD redeploys to K8s.

## 2. Deliverables

| Resource | Detail |
|---|---|
| Deployment + Service `api-service` | NestJS, port 3000, liveness and readiness probes |
| StatefulSet + PVC + Service `postgres-service` | PostgreSQL with persistent storage, health probes |
| Ingress Nginx | `localhost/` → `api-service:3000` (changed in phase 10: `/` → frontend, `/api` → backend) |
| Secrets | `postgres-secret`, `api-secret` (created by hand, never committed) |
| `deploy` job | Run by a self-hosted GitHub Actions runner: `lint-build-test → docker-build-push → deploy` |

## 3. Validation

- Persistence: deleting the PostgreSQL pod, the data survives thanks to the PVC.
- Pipeline validated end to end, `deploy` job in about 1 min 28 s.
- The self-hosted runner must be active for `deploy` to run.

## 4. Problems encountered

| Problem | Cause | Fix |
|---|---|---|
| Blocked or very slow image pulls, `server misbehaving` errors | Two simultaneous kind clusters broke DNS | Deleted the old cluster (`kind delete cluster --name <name>`) |
| `rollout status` timeout | Slow pulls during the DNS problem | Timeout raised from 60 s to 600 s (`b6ba594`) |
| Tag `postgres:15-alpine-amd64` not found | That tag does not exist | Use `postgres:15-alpine` |
| Silent Secret lookup errors | Secret named `api-secret` instead of `postgres-secret` in the Postgres manifest | Secret names aligned between manifests and `secretRef` |
| `kind load docker-image` fails | Multi-platform manifest digest | `crictl pull` directly inside the node |
