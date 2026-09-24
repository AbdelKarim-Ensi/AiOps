# Phase 8 — ML service: continuous polling loop and Loki integration

## 1. Goal

Run continuously, inside the cluster, an anomaly detection service (`ml-service`) that queries Loki over a sliding window, computes features, applies an Isolation Forest model, and reports detected anomalies to the backend through `POST /anomalies`.

## 2. Architecture

- `ml-service` (FastAPI + asyncio) runs as a Deployment in the `aiops` namespace.
- Polling loop merged with the FastAPI lifecycle (`lifespan`), 10 s interval.
- 5-minute sliding window, with a 5-minute lookback margin (`LOOKBACK=600s`) to cover late-arriving logs.
- `_is_window_closed()` decides whether a window is ready to be processed.
- In-memory dedup (`_sent_windows`), replaced at the end of the phase by a persistent constraint in the database (see section 5).
- The service queries Loki (`loki.observability.svc.cluster.local:3100`) and posts detected anomalies to the backend (`api-service.aiops.svc.cluster.local:3000`).

## 3. Deployed components

| Component | File(s) | Role |
|---|---|---|
| ml-service Deployment | `infra/k8s/base/ml-service/deployment.yaml` | Pod running the polling loop |
| ml-service Service | `infra/k8s/base/ml-service/service.yaml` | Internal exposure of the service |
| ml-service ConfigMap | `infra/k8s/base/ml-service/configmap.yaml` | `LOKI_URL`, `LOKI_QUERY`, `LOKI_TENANT_ID`, `BACKEND_URL` |
| `main.py` | `apps/ml-service/app/main.py` | Polling loop + FastAPI lifespan |
| `loki_client.py` | `apps/ml-service/app/loki_client.py` | Loki queries, filtering of kube-probe requests |
| `backend_client.py` | `apps/ml-service/app/backend_client.py` | POST to the backend, UTC timezone fix |

## 4. Bugs fixed during the phase

- **Time offset**: `backend_client.py` did not explicitly enforce UTC before `.isoformat()`, causing the timestamp to be misinterpreted on the Node/Prisma side (server local time instead of UTC). Fix: systematic `.tz_localize("UTC")` / `.tz_convert("UTC")` before serialisation.
- **Missing imports** in `loki_client.py` (`httpx`, `json`, `time`, `datetime`) added back.
- **`Bus error (core dumped)`** of the backend pod in the cluster: OpenSSL mismatch between the Docker build/production stages on Alpine. Fix: added `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` in `apps/backend/prisma/schema.prisma`.

## 5. Persistent anomaly dedup

**Initial problem**: `_sent_windows` was an in-memory dictionary. On every pod restart (crash, deployment, autoscaling), windows still within the lookback margin were sent again as duplicates.

**Chosen solution**: a unique constraint in the database rather than application-level dedup.

- `apps/backend/prisma/schema.prisma`: added `@unique` on the `windowStart` field of the `Anomaly` model.
- Prisma migration `add_unique_window_start` generated and applied (after cleaning existing duplicates with a `DELETE ... USING` query keeping the row with the oldest `createdAt` per `windowStart`).
- `apps/backend/src/anomalies/anomalies.service.ts`: the `create()` method now uses `prisma.anomaly.upsert()` with `where: { windowStart }` instead of `create()`, making the operation idempotent regardless of the number of attempts.

Result: dedup no longer depends on the pod's in-memory state; it survives restarts, deployments and autoscaling.

## 6. CI/CD integration

The `.github/workflows/backend-ci.yml` pipeline used to run only `prisma generate` (client only), never `prisma migrate deploy`. A step was added in the `deploy` job, before the rollout:

- Launch of an ephemeral pod (`kubectl run prisma-migrate-<sha> --rm -i --restart=Never`) with the freshly built backend image, running `npx prisma migrate deploy` against the cluster database.
- `DATABASE_URL` variable injected from the GitHub Actions secret `DATABASE_URL` (created for this phase, value aligned with the cluster's `postgres-secret`: `postgresql://postgres:postgres@postgres-service:5432/taskmanager?schema=public`).
- The existing `kubectl set image` + `kubectl rollout status` are kept as they are after this step.

The image tag (`:${{ github.sha }}`) was already handled dynamically by the pipeline through `kubectl set image`, so there was no real bug on this point, contrary to the initial hypothesis of a tag hard-coded in `deployment.yaml`.

## 7. Incident: clock jump / suspend-resume

During testing, a transient DNS failure (`Temporary failure in name resolution`, `All connection attempts failed`) was observed in the `ml-service` pod logs. Diagnosis:

- Only one `kind` cluster active (`aiops-cluster-tf`), so the dual-cluster cause documented in phases 5-7 was ruled out.
- CoreDNS and all control-plane pods (`etcd`, `kube-apiserver`, `kube-scheduler`, `kube-proxy`, `kindnet`) restarted at the same moment.
- `docker inspect` showed that the control-plane container had a `StartedAt` earlier than `uptime -s` (the machine boot time), a typical signature of a clock adjustment after the laptop was suspended and resumed.
- Self-resolved after a few dozen minutes; confirmed by successful DNS resolution from inside the pod (`python3 -c "socket.gethostbyname(...)"`).

No code fix needed: environmental behaviour, not application behaviour.

## 8. End-to-end validation

Automatic test carried out without manual intervention:
1. Trigger `GET /tasks/simulate-failure` through the Ingress (`http://localhost/tasks/simulate-failure`).
2. Wait for the sliding window to close (~10 min).
3. Check through `GET /anomalies` (`curl localhost:3003/anomalies`): new entry with the matching `windowStart`, `simulateFailureCount > 0`, a single occurrence (no duplicate).

## 9. Closing state

- PR #7 (`phase-8-ml-loki-integration` → `main`) merged.
- Full pipeline (`lint-build-test` → `docker-build-push` → `deploy`) run successfully on `main`, including the new Prisma migration step.
- `Anomaly_windowStart_key` constraint confirmed in the cluster database through `\d "Anomaly"`.

Phase 8 closed.
