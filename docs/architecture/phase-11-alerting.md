# Phase 11: Alerting (Alertmanager and Slack notifications)

Branch: `phase-11-alerting` (PR #14)

## Goal

Automatically notify a critical anomaly detected by the ML service: the anomaly score of the last closed window is exposed as a Prometheus metric, an alert rule compares it to a threshold, and Alertmanager sends the notification to a Slack channel. Acceptance criterion: a simulated critical anomaly triggers a Slack notification in under one minute.

## Subtasks and commits

| Subtask | Content | Commit |
|---|---|---|
| 11.1 | `ml_anomaly_score_latest` gauge in the ML service | `9e442fb` |
| 11.2 | Alertmanager, `AnomalyScoreHigh` rule, Slack routing (`values-alertmanager.yaml`) | `98cebb8` |
| 11.3 | End-to-end validation (simulated anomaly, notification, resolution) | |
| 11.4 | Merge of PR #14, ML service image built and deployed by CI | `c556f9d` |
| 11.5 | This documentation | |

## Architecture

```
ml-service (FastAPI, :8001/metrics)
   │  gauge ml_anomaly_score_latest (updated on every closed window)
   ▼
Prometheus (scrape 15 s, rule evaluation 15 s)
   │  rule AnomalyScoreHigh: ml_anomaly_score_latest > 0.7
   ▼
Alertmanager (group_by alertname, group_wait 5 s)
   │  receiver slack-critical (webhook URL read from a file mounted from a Secret)
   ▼
Slack: channel #aiops-alerts
```

## Score metric (11.1)

`apps/ml-service/app/main.py` exposes a new gauge, `ml_anomaly_score_latest`, equal to `0.5 - decision_function` for the last closed window. The Isolation Forest returns a negative score for an anomaly; the inversion gives a scale where the higher the value, the more abnormal the window.

The score is computed on the last closed window among all the closed windows of the cycle, and not only among the new ones. The existing gauge `ml_anomalies_detected_last_window` falls back to 0 as of the next polling cycle (10 s), which makes it unsuitable for an alert: Prometheus scrapes every 15 s and could miss the peak. It is kept as is (purely additive change).

## Alertmanager and alert rule (11.2)

The `prometheus-community/prometheus` chart (version 29.31.1) bundles Alertmanager (v0.34.1), which was disabled until then in `values-prometheus.yaml`. It is enabled by a second values file, `infra/k8s/observability/prometheus/values-alertmanager.yaml`, merged by Helm on top of the first one:

- `server.global`: `scrape_interval` and `evaluation_interval` at 15 s;
- route: `group_by: [alertname]`, `group_wait: 5s`, `group_interval: 1m`, `repeat_interval: 4h`;
- receiver `slack-critical`: `slack_configs` with `api_url_file` (file mounted from the Secret `alertmanager-slack-webhook`, at `/etc/alertmanager/secrets/slack/webhook_url`) and `send_resolved: true`;
- Alertmanager persistence disabled;
- rule `AnomalyScoreHigh` (group `aiops-anomaly`, `serverFiles.alerting_rules.yml`): `ml_anomaly_score_latest > 0.7`, `for: 0m`, `severity: critical`.

This chart is not `kube-prometheus-stack`: there is no `PrometheusRule` CRD, the rules live in the values.

Deployment (by hand, like Loki and Grafana):

```bash
helm upgrade prometheus prometheus-community/prometheus -n observability \
  --version 29.31.1 \
  -f values-prometheus.yaml -f values-alertmanager.yaml
```

The Secret is created by hand and is never versioned:

```bash
read -s -p "Slack webhook URL: " SLACK_URL; echo
kubectl create secret generic alertmanager-slack-webhook -n observability \
  --from-literal=webhook_url="$SLACK_URL"
unset SLACK_URL
```

## Threshold calibration

The specification planned `score > 0.8`. Measurements show that this value is never reached on the model's real scale:

| Situation | Alert score |
|---|---|
| Window without traffic | 0.5 |
| Normal traffic window (~1 request/s) | 0.6206 |
| Window with ~1 min 43 s of errors | 0.7221 |
| Window with errors over most of its duration | 0.7333 |
| Normal `/predict` (40 logs, 1 error) | ~0.489 |
| Strong anomaly `/predict` (200 logs, 60 errors) | ~0.796 |

The threshold is therefore set to **0.7**: above the observed normal traffic (0.62), below the observed abnormal windows (0.72 and 0.73). The margin on the anomaly side is thin (about 0.02).

## End-to-end validation (11.3)

Local times (UTC+1). Burst of `POST /tasks/simulate-failure` at 1 request/s from 11:38:17 to 11:44:33, gauge sampled every 5 s.

| Time | Event |
|---|---|
| 11:40:00 | Window 11:35-11:40 closes |
| 11:40:06 | Gauge goes from 0.5 to 0.7221 (reading at 11:40:01: 0.5) |
| 11:40:09 | Alert goes to `FIRING` (Prometheus `activeAt`: 10:40:09Z) |
| 11:40 | Message `[FIRING:1] AnomalyScoreHigh` in `#aiops-alerts` (Slack only shows the minute) |
| 11:45:10 | Gauge goes to 0.7333 (next window) |
| 11:50 | Message `[RESOLVED] AnomalyScoreHigh`, alert `INACTIVE` |

Since the message is timestamped at minute 11:40, it arrived at 11:40:59 at the latest, i.e. less than 60 s after the window closed, even in the worst case. The estimated delay is about fifteen seconds (polling cycle detection, rule evaluation, 5 s `group_wait`).

A prior test of the routing alone (`POST` of a `TestAlert` alert to the Alertmanager API) produced `[FIRING:1] TestAlert` at 11:32 then `[RESOLVED]` at 11:38, which matches the default 5 min `resolve_timeout`.

## ML service deployment (11.4)

The ML service CI only builds the image on a push to `main`: on the PR, only `lint-build` (`py_compile`) runs, and it passed. After the merge, `docker-build-push` then `deploy` (self-hosted runner, `kubectl set image ... :<sha>`) updated the cluster. The Deployment runs on `ghcr.io/abdelkarim-ensi/aiops-ml-service:c556f9d9b15516e9077a6cb8e3c2c6772fc6a5f8`, pod `1/1 Running`, and the gauge is exposed (0.5, alert `INACTIVE`, no false notification).

The manifest `infra/k8s/base/ml-service/deployment.yaml` was not modified: it keeps `aiops-ml-service:dev` as base value, and CI sets the real tag at deployment time.

## Difficulties encountered

- **Unreachable cluster**: after a restart, `kubectl` and `helm` answered "connection refused". The kind control-plane container was stopped and the Docker CLI pointed to the Docker Desktop socket, which was not running. After starting Docker Desktop, the cluster and the `observability` stack were intact.
- **Score outside the specification's scale**: see the calibration section. A threshold of 0.8 would have made the alert silent.
- **Image missing from GHCR**: CI does not build an image for a branch. `kubectl set image` with the branch SHA gave `ErrImagePull` (the old pod stayed in service during the rolling update). The image was built locally and loaded with `kind load docker-image` under a test tag, then replaced by the CI image at merge.
- **Silent `port-forward` tunnels**: a `curl -s` hides the failure when the tunnel is down (pod restart). Readings use `curl -sf` with an explicit message.
- **Self-hosted runner stopped**: it showed as `Offline` in GitHub before the merge; it must be restarted (`./run.sh`) for the `deploy` job to run.

## Known limitations

- **The score plateaus around 0.733**: a window with 1 min 43 s of errors (0.7221) and a window almost entirely in error (0.7333) give close values. The alert distinguishes "abnormal" from "normal", not severity.
- **Thin threshold margin calibrated on little data**: a single normal traffic value (0.62) and two abnormal values were measured, with simple traffic. More varied traffic could get close to 0.7.
- **Detection delay**: the window is 5 min, so the alert fires after the window closes, up to 5 min after the start of the incident. The "under one minute" is measured from the window closing.
- **A single end-to-end measurement**; the Slack message time is only known to the minute.
- **Gauge without logs**: if a polling cycle produces no closed window, the gauge keeps its last value. This case was not explicitly verified; it could extend an alert beyond the end of an anomaly.
- **Minimal routing**: a single receiver, no routing by severity, no inhibition or silence configured. The Slack title uses the default template (alert name followed by the `instance` and `job` labels).
- **No persistence**: Alertmanager (silences, state) and Prometheus (metrics history) start from scratch at every restart.
- **Manual deployment**: `helm upgrade` and the Secret creation do not go through CI.
- **Deployment image**: the versioned manifest references `:dev`, whereas CI puts the image tagged with the SHA. Re-applying `deployment.yaml` by hand replaces the cluster image with `:dev` until the next deployment.

## Verification

```bash
kubectl -n observability get pods | grep alertmanager
kubectl -n aiops get deployment ml-service -o jsonpath='{.spec.template.spec.containers[0].image}'; echo
kubectl port-forward -n aiops svc/ml-service 8001:8001
curl -s localhost:8001/metrics | grep ml_anomaly_score_latest
kubectl port-forward -n observability svc/prometheus-server 9090:80
curl -s localhost:9090/api/v1/alertmanagers
```

Expected: the `prometheus-alertmanager-0` pod `1/1 Running`, an ML image ending with the SHA of the latest merge, the gauge below 0.7 outside an incident, and an active Alertmanager in the API response. On `http://localhost:9090/rules`, the `aiops-anomaly` group is loaded and `AnomalyScoreHigh` is `OK`; on `/alerts`, it is `INACTIVE` outside an incident.
