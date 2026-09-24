# Phase 6 — Log observability (Loki + Grafana Alloy)

**Status:** ✅ Done
**Cluster:** local `kind`, `aiops-cluster-tf`
**Observability namespace:** `observability` (separate from the application namespace `aiops`)

## 1. Goal

Make the logs of the NestJS API (namespace `aiops`) visible, centralised and filterable in a single interface, in preparation for the following phases (ML — phases 7/8 — and alerting — phase 11), which will consume these same logs.

**Definition of Done (DoD):**
> API logs visible and filterable in Grafana through Loki, at least 3 documented LogQL queries.

## 2. Architecture

```
┌─────────────────────────┐        ┌──────────────────────────────┐
│   Namespace: aiops       │        │   Namespace: observability     │
│                          │        │                                │
│  ┌────────────────────┐  │        │  ┌──────────────┐              │
│  │ deployment/api      │  │ logs   │  │ Grafana Alloy │              │
│  │ (NestJS + Pino)     │──┼───────▶│  │ (DaemonSet)   │              │
│  └────────────────────┘  │ stdout │  └──────┬───────┘              │
│                          │        │         │ push (HTTP)          │
│  ┌────────────────────┐  │        │         ▼                      │
│  │ statefulset/postgres│  │        │  ┌──────────────┐              │
│  └────────────────────┘  │        │  │ Loki          │              │
└─────────────────────────┘        │  │ (SingleBinary)│              │
                                    │  └──────┬───────┘              │
                                    │         │ query (LogQL)         │
                                    │         ▼                      │
                                    │  ┌──────────────┐              │
                                    │  │ Grafana       │              │
                                    │  └──────────────┘              │
                                    └──────────────────────────────┘
```

**Flow:**
1. The NestJS API writes its logs as structured JSON on `stdout` (via `nestjs-pino`).
2. Grafana Alloy, deployed as a DaemonSet, discovers the pods of the `aiops` namespace through `discovery.kubernetes`, filters them with `discovery.relabel`, adds the `pod` / `namespace` / `container` labels, then pushes the logs to Loki.
3. Loki stores the logs (`SingleBinary` mode, local filesystem, suited to a single-node kind cluster) under the `aiops` tenant (multi-tenancy enabled, the `X-Scope-OrgID: aiops` header is mandatory on every query).
4. Grafana queries Loki as a datasource (the `X-Scope-OrgID` header is configured automatically through provisioning, see `values-grafana.yaml`) and allows log exploration with LogQL in the **Explore** tab.

## 3. Deployed components

| Component | Helm chart | Mode | Role |
|---|---|---|---|
| Loki | `grafana/loki` v7.3.0 | SingleBinary (replicas=1, read/write/backend=0) | Log storage and indexing |
| Grafana Alloy | `grafana/alloy` | DaemonSet, custom `.alloy` config | Collects K8s logs → Loki |
| Grafana | `grafana/grafana` | `persistence.enabled=false` | Visualisation, Explore, LogQL |

Resulting pods in `observability`: `loki-0`, `loki-gateway-*`, `loki-canary-*`, `loki-chunks-cache-0`, `loki-results-cache-0`, `alloy-*` (DaemonSet), `grafana-*`.

## 4. Files and reproducibility

All Helm parameters are versioned (no more ad hoc `--set` commands):

```
infra/k8s/observability/
├── loki/
│   └── values-loki.yaml
├── grafana-alloy/
│   ├── alloy-config.alloy      # collection pipeline (discovery, relabel, push)
│   └── values-alloy.yaml
├── grafana/
│   └── values-grafana.yaml     # includes automatic provisioning of the Loki datasource
└── install.sh                  # idempotent install/upgrade
```

**Full installation from a blank cluster:**
```bash
chmod +x infra/k8s/observability/install.sh
./infra/k8s/observability/install.sh
```

The script creates the namespace, adds the `grafana` Helm repo, then installs Loki → Alloy → Grafana in that order (Loki must be up before Alloy pushes logs, and before Grafana tests the datasource).

**Local access to Grafana:**
```bash
kubectl -n observability port-forward svc/grafana 3001:80
# http://localhost:3001 — admin / admin (see technical debt, section 6)
```

## 5. Documented LogQL queries

### Query 1 — Filter by service (namespace + container)
```logql
{namespace="aiops", container="api"}
```
Isolates the logs of the `api` application container, explicitly excluding PostgreSQL (`container="postgres"` does not appear). Validated with 555 logs returned and a consistent time histogram in the Explore tab.

**Usage:** base view for any investigation on the API.

### Query 2 — Filter by log level (JSON parsing)
```logql
{namespace="aiops", container="api"} | json | level=50
```
`nestjs-pino` follows the **Pino** convention: the `level` field is numeric, not a string (`10`=trace, `20`=debug, `30`=info, `40`=warn, `50`=error, `60`=fatal). The `| json` pipe parses the JSON body of each log line and exposes `level` as a filterable label.

**Validation:** logs generated through the test endpoint `/tasks/simulate-failure` (20 curl calls), returned with `level: 50`, `errorType: "SIMULATED_FAILURE"`, `msg: "Simulated internal failure occurred"`.

**Alternative tested:** `detected_level`, a label derived automatically by Loki from the log content, with no manual JSON parsing needed:
```logql
{namespace="aiops", container="api"} | detected_level="error"
```

**Usage:** quickly isolate application errors for investigation or, later, feed Alertmanager (phase 11).

### Query 3 — Volume metric over time
```logql
sum(count_over_time({namespace="aiops", container="api"}[5m]))
```
Aggregates the number of log lines over sliding 5-minute windows. Unlike queries 1 and 2 (which return raw logs), this one returns a numeric time series that can be graphed in Grafana.

**Validation:** a stable curve around ~50 (background noise from the `kube-probe` health checks), with a clear peak (~110) matching exactly the deliberate generation of 20 error requests through `simulate-failure`.

**Usage:** detecting activity spikes / volume anomalies. It is the conceptual basis for the ML integration of phases 7/8 (Isolation Forest on log metrics).

### Bonus query — Breakdown by level
```logql
sum by (level) (count_over_time({namespace="aiops", container="api"} | json [5m]))
```
Combines JSON parsing and aggregation to distinguish, on the same graph, the volume of `info` (30) and `error` (50) logs. Not required by the DoD but useful for a monitoring dashboard (phase 9).

## 6. Points of attention / known technical debt

- **Grafana password in clear text** (`adminPassword: admin` in `values-grafana.yaml`): acceptable for an isolated local kind cluster, but to be moved to a Kubernetes `Secret` before any non-local deployment.
- **Local filesystem storage for Loki** (`storage.type: filesystem`): suited to the local / pre-thesis context, not persistent if the `loki-0` pod is deleted without a dedicated PVC. Acceptable here, to be reviewed for a production environment (S3/GCS backend).
- **Single-tenant multi-tenancy** (`aiops`): the configuration already supports several tenants if the project ever grows to several environments or teams.

## 7. Next (phase 7)

The logs collected and structured in Loki will be the data source for the ML service (FastAPI + scikit-learn, Isolation Forest) in charge of detecting anomalies. Query 3 above (counting over time) foreshadows the type of signal that will be used to train the model.
