# Phase 9 — Monitoring des métriques : Prometheus + Grafana

## 1. Objectif

Ajouter une couche de métriques applicatives à AiOps : instrumenter le backend (`api`) et le `ml-service`, les scraper avec Prometheus, et les visualiser dans le Grafana existant (Phase 6), à côté des logs Loki.

Definition of Done : au moins une requête PromQL complexe visible dans un dashboard (ici : `histogram_quantile` avec `sum by (le)` + `rate`, et un ratio d'erreur agrégé).

## 2. Architecture

- Chaque service expose `GET /metrics` au format Prometheus.
- Prometheus (Helm, namespace `observability`) scrape `api-service:3000` et `ml-service:8001` via des jobs statiques.
- Choix **Option A : Prometheus seul** (chart `prometheus-community/prometheus`), pas `kube-prometheus-stack`, pour ne pas dupliquer le Grafana de la Phase 6.
- Grafana reçoit Prometheus comme seconde datasource (à côté de Loki) et charge les dashboards depuis des ConfigMaps via le sidecar.

```
api-service (NestJS)  ──/metrics──┐
                                  ├──> Prometheus ──> Grafana (datasources : Loki + Prometheus)
ml-service (FastAPI)  ──/metrics──┘
```

## 3. Composants déployés

| Composant | Fichier(s) | Rôle |
|---|---|---|
| MetricsModule (NestJS) | `apps/backend/src/metrics/` | Expose `GET /metrics`, déclare compteur + histogramme HTTP |
| MetricsInterceptor | `apps/backend/src/metrics/` + `main.ts` | Interceptor global, enregistré via `app.useGlobalInterceptors(app.get(...))` |
| Instrumentation FastAPI | `apps/ml-service/app/main.py` | `Instrumentator().instrument(app).expose(app, endpoint="/metrics")` + métriques custom du polling |
| Prometheus (Helm) | `infra/k8s/observability/prometheus/values-prometheus.yaml` | Serveur Prometheus + jobs de scrape |
| Pipeline ml-service | `.github/workflows/ml-service-ci.yml` | lint-build → docker-build-push → deploy |
| Datasource Prometheus | `infra/k8s/observability/grafana/values-grafana.yaml` | Provisioning de la datasource, sidecar dashboards activé |
| Dashboard | `infra/k8s/observability/grafana/dashboards/aiops-metrics.json` | Dashboard `AiOps - Métriques (Phase 9)` |

### Métriques exposées

**Backend (NestJS, `@willsoto/nestjs-prometheus` + `prom-client`)**
- `http_requests_total{method, route, status_code}` (Counter)
- `http_request_duration_seconds{method, route, status_code}` (Histogram, buckets de 0.01s à 5s)

**ml-service (FastAPI, `prometheus-fastapi-instrumentator==8.1.0`, `prometheus-client==0.26.0`)**
- Métriques HTTP automatiques via l'instrumentator
- `ml_polling_cycles_total{status="success"|"error"}` (Counter)
- `ml_polling_cycle_duration_seconds` (Histogram)
- `ml_anomalies_detected_last_window` (Gauge)
- `ml_anomalies_sent_total` (Counter)
- Le `try/except/finally` du cycle garantit l'enregistrement quel que soit le résultat.

### Jobs de scrape

| Job | Cible |
|---|---|
| `api-service` | `api-service.aiops.svc.cluster.local:3000/metrics` |
| `ml-service` | `ml-service.aiops.svc.cluster.local:8001/metrics` |

### Dashboard Grafana

Le dashboard utilise une **variable `datasource`** (type datasource, query `prometheus`) au lieu d'un UID en dur : l'UID de la datasource est généré par Grafana et ne doit pas être supposé.

| Panel | Requête (résumé) |
|---|---|
| api-service / ml-service UP | `up{job="..."}` |
| Anomalies (dernière fenêtre) | `ml_anomalies_detected_last_window` |
| Anomalies envoyées (1h) | `increase(ml_anomalies_sent_total[1h])` |
| API - Latence P95 / P99 | `histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket{job="api-service"}[5m])))` |
| API - Taux d'erreur 5xx | ratio `rate(status_code=~"5..") / rate(total)`, numérateur en `or vector(0)` |
| API - Requêtes par route | `sum by (route) (rate(http_requests_total{job="api-service"}[5m]))` |
| ML - Durée cycle de polling (P95) | `histogram_quantile` sur `ml_polling_cycle_duration_seconds_bucket` |
| ML - Cycles de polling | `sum by (status) (rate(ml_polling_cycles_total[5m]))` |
| ML - Anomalies envoyées par heure | `increase(ml_anomalies_sent_total[1h])` |

Toutes les requêtes filtrent par `job=` (voir leçon 4).

### Chargement des dashboards

Le sidecar Grafana est activé dans `values-grafana.yaml` (`sidecar.dashboards.enabled`, label `grafana_dashboard: "1"`). Le dashboard est fourni via une ConfigMap `aiops-metrics-dashboard` (namespace `observability`) créée depuis le JSON du repo :

```bash
kubectl create configmap aiops-metrics-dashboard -n observability \
  --from-file=aiops-metrics.json=infra/k8s/observability/grafana/dashboards/aiops-metrics.json \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl label configmap aiops-metrics-dashboard -n observability grafana_dashboard=1 --overwrite
```

Le sidecar recharge tout seul après un `apply` (pas de `helm upgrade` nécessaire pour un simple changement du JSON).

## 4. Bugs corrigés durant la phase

- **`status_code` toujours à 200 côté NestJS** : la lecture de `response.statusCode` dans le callback RxJS (`tap`) avait lieu avant que le filtre d'exception Nest n'écrive le vrai code, donc les erreurs 500 étaient comptées comme 200. Fix : lecture dans l'event natif `response.once('finish', ...)`. Testé en local avec 200 et 500.
- **`extraScrapeConfigs` sans effet** : la clé doit être à la **racine** du values Prometheus, pas sous `server:`. Vérifié via `helm show values prometheus-community/prometheus`. Après `helm upgrade`, redémarrage du pod `prometheus-server` pour recharger la config.

## 5. Dette technique découverte : ml-service sans CI/CD

Le `ml-service` n'avait aucun pipeline (contrairement au backend) : chaque déploiement était manuel, et l'image en cluster était `aiops-ml-service:dev` (tag statique, buildée en local). L'instrumentation Prometheus n'était donc jamais arrivée dans le cluster (`/metrics` en 404).

Création de `.github/workflows/ml-service-ci.yml`, sur le modèle de `backend-ci.yml` :

1. `lint-build` : compile check Python (pas de vrais tests unitaires : `test_loki.py` est un script exploratoire, pas du pytest).
2. `docker-build-push` : image `ghcr.io/abdelkarim-ensi/aiops-ml-service:<sha>`.
3. `deploy` : `kubectl set image deployment/ml-service ml-service=... -n aiops`, exécuté sur le runner self-hosted.

Sur une PR, seul `lint-build` s'exécute ; build, push et deploy ne se déclenchent que sur `main`.

## 6. Incident : CrashLoopBackOff après le premier déploiement CI

Au premier merge sur `main`, le job `deploy` est resté bloqué sur `Waiting for deployment "ml-service" rollout to finish: 1 old replicas are pending termination`.

Diagnostic :

- `kubectl get pods` : le **nouveau** pod était en `CrashLoopBackOff`, l'ancien (`:dev`) tournait toujours et servait le trafic (il joue le rôle de filet de sécurité pendant un rolling update).
- `kubectl logs <pod> --previous` : `RuntimeError: Modèle introuvable : model/isolation_forest.joblib` levée dans le `lifespan`.
- Cause : `apps/ml-service/.gitignore` contenait `model/*.joblib`. Le modèle (913 Ko) existait en local (donc dans l'ancienne image buildée à la main) mais n'était jamais dans le checkout du CI, donc absent de l'image.

Fix :

- Exception dans `apps/ml-service/.gitignore` (`!model/isolation_forest.joblib`, placée **après** la règle générale) et commit du modèle.
- `kubectl rollout undo deployment/ml-service -n aiops` pour stopper le CrashLoop en attendant.
- Vérification préalable que `scikit-learn==1.9.1` et `joblib==1.6.0` étaient épinglés dans `requirements.txt` à la même version que celle qui avait entraîné le modèle.

Résultat : rollout réussi, `Application startup complete`, `GET /metrics 200 OK` dans les logs, target `ml-service` UP dans Prometheus (`job="ml-service"`).

## 7. Validation

- Prometheus `/targets` : `api-service` et `ml-service` en `UP`.
- `up{job=~"api-service|ml-service"}` renvoie 1 pour les deux ; `increase(ml_polling_cycles_total{status="success"}[5m])` augmente (~19 juste après le redéploiement, la fenêtre de 5 min n'étant pas encore pleine).
- Datasource Prometheus : "Successfully queried the Prometheus API" dans Grafana.
- Dashboard chargé par le sidecar : panels UP, latence P95/P99, requêtes par route, durée des cycles ML alimentés en données.
- PR de la datasource et du dashboard : #11.

## 8. Leçons apprises

1. **`extraScrapeConfigs` va à la racine du values Prometheus**, pas sous `server:`. Toujours vérifier la structure avec `helm show values <chart>`.
2. **Vérifier qu'un service a un pipeline CI/CD avant de dépendre de son image à jour.** Une image `:dev` construite à la main peut contenir des fichiers (ici le modèle) absents du repo.
3. **Un `.gitignore` peut exclure un artefact nécessaire au build** (`.joblib`). Le symptôme n'apparaît qu'au premier build en CI. Tester avec `git ls-files` et `git check-ignore -v`.
4. **Collision de noms de métriques entre services** : `prometheus-fastapi-instrumentator` expose des métriques nommées comme celles du backend NestJS (`http_requests_total`, `http_request_duration_seconds`) mais avec d'autres labels (`handler`, `status` groupé en `5xx`, contre `route` et `status_code`). Toujours filtrer par `job=` dans les requêtes et les dashboards.
5. **Un rolling update qui bloque ne veut pas dire que l'ancien pod est en cause** : regarder d'abord si le *nouveau* pod est en CrashLoop (`kubectl get pods`, `logs --previous`). Ne pas supprimer l'ancien pod, c'est lui qui sert le trafic. `kubectl rollout undo` est le moyen propre d'annuler.
6. **Ajouter un `--timeout` à `kubectl rollout status`** dans les pipelines pour ne pas bloquer indéfiniment le runner self-hosted.
7. **Un ratio avec un numérateur vide affiche "No data", pas 0.** Utiliser `(sum(rate(...)) or vector(0)) / sum(rate(...))` pour un panel de taux d'erreur.
8. **Buckets d'histogramme** : avec un plus petit bucket à 10 ms, les quantiles P95/P99 restent collés à cette borne quand tout est plus rapide. Adapter les buckets si on veut de la résolution sous 10 ms.
9. **Datasource dans un dashboard provisionné** : utiliser une variable de type `datasource` plutôt qu'un UID en dur.
10. **Collage de grosses lignes dans un terminal** : une ligne saisie est tronquée vers 4096 caractères, ce qui corrompt silencieusement un JSON écrit en une seule ligne. Écrire un panel par ligne, ou générer le fichier avec un script, puis valider avec `python3 -m json.tool` **et** vérifier le contenu (nombre de panels), car un JSON valide peut être incomplet.

## 9. Suite

Phase 10 selon la roadmap.