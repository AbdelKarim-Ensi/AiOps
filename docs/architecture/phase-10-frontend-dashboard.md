# Phase 10: Angular frontend (anomaly dashboard)

Branch: `phase-10-frontend-dashboard`

## Goal

Give the anomaly detection a web interface: display statistics, list the log windows detected as abnormal, view the detail of an anomaly and mark it as a false positive. The frontend is containerised, deployed on the kind cluster next to the API, and built by a dedicated CI pipeline.

## Subtasks and commits

| Subtask | Content | Commit |
|---|---|---|
| 10.1 | Backend: filters, pagination, stats, detail | `10a5d95` |
| 10.2 | Angular scaffold and `/api` proxy | `4f1ee7e` |
| 10.3 | Anomaly models and HTTP service | `36ff2b3` |
| 10.4 | Dashboard: design, Lucide icons, dark mode, badges | `a5b1b82` |
| 10.5 | Anomaly list view | `b9072a3` |
| 10.6 | Anomaly detail view | `a4b5934` |
| 10.7 | Multi-stage Dockerfile and nginx | `aa81967` |
| 10.8 | K8s manifests and Ingress (`/api` and `/`) | `fcceefd` |
| 10.9 | `frontend-ci.yml` pipeline, `app.spec.ts` fix | `171662e` |
| 10.10 | This documentation | |

## Architecture

```
Browser
   │
   ▼
Ingress nginx (localhost:80)
   ├── /api/...  ──(rewrite: /api removed)──▶ api-service:3000   (NestJS)
   └── /         ─────────────────────────────▶ frontend-service:80 (nginx + Angular)
```

In development, `ng serve` plays the role of the Ingress: `proxy.conf.json` sends `/api` to `http://localhost:3000`, removing the `/api` prefix. In the cluster, the Ingress does this rewrite. The Angular code always calls `/api/anomalies` and does not change between environments.

## Backend (10.1)

For anomalies, the API exposes: a filterable, paginated list (period, false-positive status), statistics for the dashboard, the detail by identifier (400 if the id is not a UUID, 404 if it does not exist) and marking as false positive (`PATCH /anomalies/:id/false-positive`). Pagination uses the `limit` and `offset` parameters (the frontend requests `limit=10&offset=0`). The details of the filters are in the controller and in `apps/frontend/src/app/core/anomalies.service.ts`.

`errorRate` is a ratio between 0 and 1 (0.33 for 40 errors out of 120 logs).

## Frontend (10.2 to 10.6)

- **Angular** with standalone components, signals and lazy-loaded routes.
- **Tailwind CSS** for styling (`src/tailwind.css`, `.postcssrc.json`), **Lucide** icons, dark mode following the system preference.
- **Routes**: `/dashboard`, `/anomalies`, `/anomalies/:id`. Any other route redirects to `/dashboard`.
- **HTTP layer**: `core/anomaly.models.ts` (types) and `core/anomalies.service.ts` (`baseUrl = '/api/anomalies'`).
- **List**: paginated table, From / To / False positive filters, a "Marquer faux positif" button (mark as false positive) that updates the row without reloading the page, rows clickable to the detail.
- **Detail**: the 9 fields of the anomaly and the marking button. Four distinct error states: loading, invalid identifier (400), anomaly not found (404), API unreachable or 5xx error.
- **Error rate display**: as a decimal in the list, with its percentage equivalent in the detail.

The UI texts remain in French.

## Containerisation (10.7)

`apps/frontend/Dockerfile` in two stages:

1. `node:22-alpine`: `npm ci` then `npm run build` (output in `dist/frontend/browser`).
2. `nginx:1.27-alpine`: copy of the build and of `nginx.conf`.

`nginx.conf`:

- `/healthz` returns `200 ok` (used by the Kubernetes probes);
- `.js`, `.css` and font files: long cache (`immutable`);
- any other route returns `index.html` with `Cache-Control: no-cache` (SPA fallback, needed to reload `/anomalies/:id`);
- gzip compression.

`.dockerignore` excludes `node_modules`, `dist`, `.angular` and development environment files.

## Kubernetes deployment (10.8)

Files in `infra/k8s/base/`:

- `frontend/deployment.yaml`: 1 replica, image `ghcr.io/abdelkarim-ensi/aiops-frontend:latest`, probes on `/healthz`, requests of 10m CPU and 16Mi, memory limit of 64Mi.
- `frontend/service.yaml`: `frontend-service` (ClusterIP, port 80).
- `ingress/ingress.yaml`: `/` to `frontend-service:80`.
- `ingress/api-ingress.yaml`: `/api(/|$)(.*)` to `api-service:3000`, with `rewrite-target: /$2`.

**Why two Ingress objects?** The `rewrite-target` annotation applies to the whole Ingress object. On a single object, it would also rewrite the frontend routes. Two objects on the same host (`localhost`) are merged by ingress-nginx.

**Consequence**: the API is no longer reachable at `localhost/xxx` but at `localhost/api/xxx`. The API health check is therefore `localhost/api/health`. `localhost/health` now returns the frontend page (SPA fallback) and proves nothing about the API.

The manifests are applied by hand (`kubectl apply -f infra/k8s/base/frontend/` then `.../ingress/`), like those of the backend. CI only changes the Deployment image.

## CI/CD pipeline (10.9)

`.github/workflows/frontend-ci.yml`, modelled on `backend-ci.yml`:

| Job | Trigger | Role |
|---|---|---|
| `build-test` | push to `main` and pull request (paths `apps/frontend/**`) | Node 22, `npm ci`, `npm run build`, `npm test -- --no-watch` |
| `docker-build-push` | push to `main` only | Builds the image and pushes it to ghcr (`:latest` and `:<sha>`) |
| `deploy` | after the image push, self-hosted runner | `kubectl set image deployment/frontend ...` then `rollout status` |

There is no lint step: `package.json` only defines `build` and `test`.

`app.spec.ts` was fixed: the old test looked for the scaffold's "Hello, frontend" `h1`. The two tests now check that the application is created and that the navigation bar is present (AiOps, Dashboard, Anomalies). For now these are the only frontend tests.

## Difficulties encountered

- **Stuck Docker build**: `npm run build` ran for more than 10 minutes in the container while it takes a few seconds locally. The cause was a lack of memory in the Docker Desktop VM (3.65 GB), shared with the kind cluster, and additionally used by Docker Desktop's built-in Kubernetes (a second, empty cluster). After disabling that built-in Kubernetes, the build took 2 min 26 s.
- **Local image in kind**: the cluster does not see the local Docker images. The image was loaded with `kind load docker-image` under the name `ghcr.io/abdelkarim-ensi/aiops-frontend:latest`, and the Deployment uses `imagePullPolicy: IfNotPresent`. With `:latest` and without this policy, Kubernetes would try to pull from ghcr.
- **Files corrupted when pasting**: HTML blocks pasted into the terminal lost characters. Checksums (`sha256sum`) and line counts were used to detect the problem.

## Known limitations

- **Validation in the cluster (after merge).** Before the merge, the cluster API used the image from before 10.1 (`/api/anomalies/stats` returned 404). After the merge, `backend-ci.yml` and `frontend-ci.yml` deployed images tagged with the commit SHA. On `http://localhost/`, `/api/health` and `/api/anomalies/stats` respond, the dashboard shows 5 anomalies, 673 logs, 126 errors and 1 false positive, the list and the detail show the 5 anomalies with their 9 fields, and `/anomalies/00000000-0000-4000-8000-000000000000` shows "Anomalie introuvable" (nginx SPA fallback then 404 from the API).
- **Deployment image**: the versioned manifest references `:latest`, whereas CI puts the image tagged with the commit SHA. Re-applying `deployment.yaml` by hand therefore puts `:latest` back until the next deployment.
- **A single replica and no integration tests**: the frontend has no component tests, only the two tests of `app.spec.ts`.

## Post-merge verification

```bash
kubectl -n aiops get pods
kubectl -n aiops rollout status deployment/api
kubectl -n aiops rollout status deployment/frontend
curl -s localhost/api/health
curl -s localhost/api/anomalies/stats
curl -s -o /dev/null -w "%{http_code}\n" localhost/anomalies/abc
```

Expected: pods `Running`, `{"status":"ok",...}`, statistics JSON, then `200`. Then open `http://localhost/`: the dashboard, the list and the detail must show the API data, including after a reload (F5) on `/anomalies/<id>`.
