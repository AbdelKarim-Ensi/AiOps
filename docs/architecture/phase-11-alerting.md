# Phase 11 : Alerting (Alertmanager et notifications Slack)

Branche : `phase-11-alerting` (PR #14)

## Objectif

Notifier automatiquement une anomalie critique détectée par le service ML : le score d'anomalie de la dernière fenêtre fermée est exposé comme métrique Prometheus, une règle d'alerte le compare à un seuil, et Alertmanager envoie la notification dans un canal Slack. Critère d'acceptation : une anomalie critique simulée déclenche une notification Slack en moins d'une minute.

## Sous-tâches et commits

| Sous-tâche | Contenu | Commit |
|---|---|---|
| 11.1 | Gauge `ml_anomaly_score_latest` dans le service ML | `9e442fb` |
| 11.2 | Alertmanager, règle `AnomalyScoreHigh`, routing Slack (`values-alertmanager.yaml`) | `98cebb8` |
| 11.3 | Validation de bout en bout (anomalie simulée, notification, résolution) | |
| 11.4 | Fusion de la PR #14, image du service ML construite et déployée par la CI | `c556f9d` |
| 11.5 | Cette documentation | |

## Architecture

```
ml-service (FastAPI, :8001/metrics)
   │  gauge ml_anomaly_score_latest (mise à jour à chaque fenêtre fermée)
   ▼
Prometheus (scrape 15 s, évaluation des règles 15 s)
   │  règle AnomalyScoreHigh : ml_anomaly_score_latest > 0.7
   ▼
Alertmanager (group_by alertname, group_wait 5 s)
   │  receiver slack-critical (URL du webhook lue dans un fichier monté depuis un Secret)
   ▼
Slack : canal #aiops-alerts
```

## Métrique du score (11.1)

`apps/ml-service/app/main.py` expose une nouvelle gauge, `ml_anomaly_score_latest`, égale à `0.5 - decision_function` pour la dernière fenêtre fermée. L'Isolation Forest renvoie un score négatif pour une anomalie ; l'inversion donne une échelle où plus la valeur est haute, plus la fenêtre est anormale.

Le score est calculé sur la dernière fenêtre fermée parmi toutes les fenêtres fermées du cycle, et pas seulement parmi les nouvelles. La gauge existante `ml_anomalies_detected_last_window` retombe à 0 dès le cycle de polling suivant (10 s), ce qui la rend inadaptée à une alerte : Prometheus scrape toutes les 15 s et pourrait manquer le pic. Elle est conservée telle quelle (changement purement additif).

## Alertmanager et règle d'alerte (11.2)

Le chart `prometheus-community/prometheus` (version 29.31.1) embarque Alertmanager (v0.34.1), désactivé jusque-là dans `values-prometheus.yaml`. Il est activé par un second fichier de values, `infra/k8s/observability/prometheus/values-alertmanager.yaml`, fusionné par Helm au-dessus du premier :

- `server.global` : `scrape_interval` et `evaluation_interval` à 15 s ;
- route : `group_by: [alertname]`, `group_wait: 5s`, `group_interval: 1m`, `repeat_interval: 4h` ;
- receiver `slack-critical` : `slack_configs` avec `api_url_file` (fichier monté depuis le Secret `alertmanager-slack-webhook`, dans `/etc/alertmanager/secrets/slack/webhook_url`) et `send_resolved: true` ;
- persistance d'Alertmanager désactivée ;
- règle `AnomalyScoreHigh` (groupe `aiops-anomaly`, `serverFiles.alerting_rules.yml`) : `ml_anomaly_score_latest > 0.7`, `for: 0m`, `severity: critical`.

Ce chart n'est pas `kube-prometheus-stack` : il n'y a pas de CRD `PrometheusRule`, les règles vivent dans les values.

Déploiement (à la main, comme Loki et Grafana) :

```bash
helm upgrade prometheus prometheus-community/prometheus -n observability \
  --version 29.31.1 \
  -f values-prometheus.yaml -f values-alertmanager.yaml
```

Le Secret est créé à la main et n'est jamais versionné :

```bash
read -s -p "Slack webhook URL: " SLACK_URL; echo
kubectl create secret generic alertmanager-slack-webhook -n observability \
  --from-literal=webhook_url="$SLACK_URL"
unset SLACK_URL
```

## Calibration du seuil

Le cahier des charges prévoyait `score > 0.8`. Les mesures montrent que cette valeur n'est jamais atteinte sur l'échelle réelle du modèle :

| Situation | Score d'alerte |
|---|---|
| Fenêtre sans trafic | 0.5 |
| Fenêtre de trafic normal (~1 requête/s) | 0.6206 |
| Fenêtre avec ~1 min 43 s d'erreurs | 0.7221 |
| Fenêtre avec erreurs sur la majeure partie de sa durée | 0.7333 |
| `/predict` normal (40 logs, 1 erreur) | ~0.489 |
| `/predict` anomalie forte (200 logs, 60 erreurs) | ~0.796 |

Le seuil est donc fixé à **0.7** : au-dessus du trafic normal observé (0.62), sous les fenêtres anormales observées (0.72 et 0.73). La marge côté anomalie est fine (environ 0.02).

## Validation de bout en bout (11.3)

Heures locales (UTC+1). Salve de `POST /tasks/simulate-failure` à 1 requête/s de 11:38:17 à 11:44:33, gauge relevée toutes les 5 s.

| Heure | Événement |
|---|---|
| 11:40:00 | Fermeture de la fenêtre 11:35-11:40 |
| 11:40:06 | La gauge passe de 0.5 à 0.7221 (relevé à 11:40:01 : 0.5) |
| 11:40:09 | L'alerte passe à `FIRING` (`activeAt` Prometheus : 10:40:09Z) |
| 11:40 | Message `[FIRING:1] AnomalyScoreHigh` dans `#aiops-alerts` (Slack n'affiche que la minute) |
| 11:45:10 | La gauge passe à 0.7333 (fenêtre suivante) |
| 11:50 | Message `[RESOLVED] AnomalyScoreHigh`, alerte `INACTIVE` |

Le message étant daté de la minute 11:40, il est arrivé au plus tard à 11:40:59, soit moins de 60 s après la fermeture de la fenêtre, même dans le pire cas. Le délai estimé est d'une quinzaine de secondes (détection du cycle de polling, évaluation de la règle, `group_wait` de 5 s).

Un test préalable du routage seul (`POST` d'une alerte `TestAlert` sur l'API d'Alertmanager) a produit `[FIRING:1] TestAlert` à 11:32 puis `[RESOLVED]` à 11:38, ce qui correspond au `resolve_timeout` par défaut de 5 min.

## Déploiement du service ML (11.4)

La CI du service ML ne construit l'image que sur un push vers `main` : sur la PR, seul `lint-build` (`py_compile`) tourne, et il est passé. Après la fusion, `docker-build-push` puis `deploy` (runner self-hosted, `kubectl set image ... :<sha>`) ont mis à jour le cluster. Le Deployment tourne sur `ghcr.io/abdelkarim-ensi/aiops-ml-service:c556f9d9b15516e9077a6cb8e3c2c6772fc6a5f8`, pod `1/1 Running`, et la gauge est exposée (0.5, alerte `INACTIVE`, aucune fausse notification).

Le manifeste `infra/k8s/base/ml-service/deployment.yaml` n'a pas été modifié : il garde `aiops-ml-service:dev` comme valeur de base, la CI pose le tag réel au déploiement.

## Difficultés rencontrées

- **Cluster injoignable** : après un redémarrage, `kubectl` et `helm` répondaient « connection refused ». Le conteneur du control-plane kind était arrêté et le CLI Docker pointait vers le socket de Docker Desktop, qui n'était pas lancé. Après démarrage de Docker Desktop, le cluster et la stack `observability` étaient intacts.
- **Score hors de l'échelle du cahier des charges** : voir la section de calibration. Le seuil de 0.8 aurait rendu l'alerte muette.
- **Image absente de GHCR** : la CI ne construit pas d'image pour une branche. `kubectl set image` avec le SHA de la branche a donné `ErrImagePull` (l'ancien pod est resté en service pendant le rolling update). L'image a été construite en local et chargée avec `kind load docker-image` sous un tag de test, puis remplacée par l'image de la CI à la fusion.
- **Tunnels `port-forward` silencieux** : un `curl -s` masque l'échec quand le tunnel est tombé (redémarrage de pod). Les relevés utilisent `curl -sf` avec un message explicite.
- **Runner self-hosted arrêté** : il apparaissait `Offline` dans GitHub avant la fusion ; il faut le relancer (`./run.sh`) pour que le job `deploy` s'exécute.

## Limites connues

- **Le score plafonne autour de 0.733** : une fenêtre à 1 min 43 s d'erreurs (0.7221) et une fenêtre presque entièrement en erreur (0.7333) donnent des valeurs proches. L'alerte distingue « anormal » de « normal », pas la gravité.
- **Marge du seuil fine et calibrée sur peu de données** : une seule valeur de trafic normal (0.62) et deux valeurs anormales ont été mesurées, avec un trafic simple. Un trafic plus varié pourrait s'approcher de 0.7.
- **Délai de détection** : la fenêtre est de 5 min, donc l'alerte part après la fermeture de la fenêtre, jusqu'à 5 min après le début de l'incident. Le « moins d'une minute » se mesure à partir de la fermeture de la fenêtre.
- **Une seule mesure de bout en bout** ; l'heure du message Slack n'est connue qu'à la minute.
- **Gauge sans logs** : si un cycle de polling ne produit aucune fenêtre fermée, la gauge garde sa dernière valeur. Ce cas n'a pas été vérifié explicitement ; il pourrait prolonger une alerte au-delà de la fin d'une anomalie.
- **Routage minimal** : un seul receiver, pas de routage par sévérité, pas d'inhibition ni de silence configurés. Le titre Slack utilise le template par défaut (nom de l'alerte suivi des labels `instance` et `job`).
- **Pas de persistance** : Alertmanager (silences, état) et Prometheus (historique des métriques) repartent de zéro à chaque redémarrage.
- **Déploiement manuel** : `helm upgrade` et la création du Secret ne passent pas par la CI.
- **Image du Deployment** : le manifeste versionné référence `:dev`, alors que la CI place l'image taguée avec le SHA. Réappliquer `deployment.yaml` à la main remplace l'image du cluster par `:dev` jusqu'au prochain déploiement.

## Vérification

```bash
kubectl -n observability get pods | grep alertmanager
kubectl -n aiops get deployment ml-service -o jsonpath='{.spec.template.spec.containers[0].image}'; echo
kubectl port-forward -n aiops svc/ml-service 8001:8001
curl -s localhost:8001/metrics | grep ml_anomaly_score_latest
kubectl port-forward -n observability svc/prometheus-server 9090:80
curl -s localhost:9090/api/v1/alertmanagers
```

Attendu : le pod `prometheus-alertmanager-0` en `1/1 Running`, une image ML terminée par le SHA de la dernière fusion, la gauge à une valeur inférieure à 0.7 hors incident, et un Alertmanager actif dans la réponse de l'API. Sur `http://localhost:9090/rules`, le groupe `aiops-anomaly` est chargé et `AnomalyScoreHigh` est `OK` ; sur `/alerts`, il est `INACTIVE` hors incident.
