# Phase 8 — ML Service : boucle de polling continue et intégration Loki

## 1. Objectif

Faire tourner en continu, dans le cluster, un service de détection d'anomalies (`ml-service`) qui interroge Loki sur une fenêtre glissante, calcule des features, applique un modèle Isolation Forest, et remonte les anomalies détectées au backend via `POST /anomalies`.

## 2. Architecture

- `ml-service` (FastAPI + asyncio) tourne comme Deployment dans le namespace `aiops`.
- Boucle de polling fusionnée avec le cycle de vie FastAPI (`lifespan`), intervalle 10s.
- Fenêtre glissante de 5 minutes, avec une marge de lookback de 5 minutes (`LOOKBACK=600s`) pour couvrir les logs arrivant en retard.
- `_is_window_closed()` détermine si une fenêtre est prête à être traitée.
- Dédup en mémoire (`_sent_windows`) remplacée en fin de phase par une contrainte persistante côté base (voir section 5).
- Le service interroge Loki (`loki.observability.svc.cluster.local:3100`) et poste les anomalies détectées vers le backend (`api-service.aiops.svc.cluster.local:3000`).

## 3. Composants déployés

| Composant | Fichier(s) | Rôle |
|---|---|---|
| ml-service Deployment | `infra/k8s/base/ml-service/deployment.yaml` | Pod exécutant la boucle de polling |
| ml-service Service | `infra/k8s/base/ml-service/service.yaml` | Exposition interne du service |
| ml-service ConfigMap | `infra/k8s/base/ml-service/configmap.yaml` | `LOKI_URL`, `LOKI_QUERY`, `LOKI_TENANT_ID`, `BACKEND_URL` |
| `main.py` | `apps/ml-service/app/main.py` | Boucle de polling + lifespan FastAPI |
| `loki_client.py` | `apps/ml-service/app/loki_client.py` | Requêtes vers Loki, filtrage des probes kube-probe |
| `backend_client.py` | `apps/ml-service/app/backend_client.py` | POST vers le backend, fix timezone UTC |

## 4. Bugs corrigés durant la phase

- **Décalage horaire** : `backend_client.py` n'imposait pas explicitement UTC avant `.isoformat()`, causant une interprétation erronée du timestamp côté Node/Prisma (heure locale du serveur au lieu d'UTC). Fix : `.tz_localize("UTC")` / `.tz_convert("UTC")` systématique avant sérialisation.
- **Imports manquants** dans `loki_client.py` (`httpx`, `json`, `time`, `datetime`) réajoutés.
- **`Bus error (core dumped)`** du pod backend en cluster : mismatch OpenSSL entre les stages Docker build/production sur Alpine. Fix : ajout de `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` dans `apps/backend/prisma/schema.prisma`.

## 5. Dédup persistante des anomalies

**Problème initial** : `_sent_windows` était un dictionnaire en mémoire — à chaque redémarrage du pod (crash, déploiement, autoscaling), les fenêtres encore dans la marge de lookback étaient renvoyées en doublon.

**Solution retenue** : contrainte unique en base plutôt que dédup applicative.

- `apps/backend/prisma/schema.prisma` : ajout de `@unique` sur le champ `windowStart` du modèle `Anomaly`.
- Migration Prisma `add_unique_window_start` générée et appliquée (après nettoyage des doublons existants via une requête `DELETE ... USING` gardant la ligne au `createdAt` le plus ancien par `windowStart`).
- `apps/backend/src/anomalies/anomalies.service.ts` : la méthode `create()` utilise désormais `prisma.anomaly.upsert()` avec `where: { windowStart }` au lieu de `create()`, rendant l'opération idempotente peu importe le nombre de tentatives.

Résultat : la persistance de la dédup ne dépend plus de l'état mémoire du pod ; elle survit aux redémarrages, aux déploiements et à l'autoscaling.

## 6. Intégration CI/CD

Le pipeline `.github/workflows/backend-ci.yml` ne lançait auparavant que `prisma generate` (client uniquement), jamais `prisma migrate deploy`. Ajout d'une étape dans le job `deploy`, avant le rollout :

- Lancement d'un pod éphémère (`kubectl run prisma-migrate-<sha> --rm -i --restart=Never`) avec l'image backend fraîchement buildée, exécutant `npx prisma migrate deploy` contre la base du cluster.
- Variable `DATABASE_URL` injectée depuis le secret GitHub Actions `DATABASE_URL` (créé pour cette phase, valeur alignée sur `postgres-secret` du cluster : `postgresql://postgres:postgres@postgres-service:5432/taskmanager?schema=public`).
- Le `kubectl set image` + `kubectl rollout status` existant est conservé tel quel après cette étape.

Le tag d'image (`:${{ github.sha }}`) était déjà géré dynamiquement par le pipeline via `kubectl set image` — pas de bug réel sur ce point, contrairement à l'hypothèse initiale d'un tag figé en dur dans `deployment.yaml`.

## 7. Incident : clock-jump / suspend-resume

Durant les tests, une panne DNS transitoire (`Temporary failure in name resolution`, `All connection attempts failed`) a été observée dans les logs du pod `ml-service`. Diagnostic :

- Un seul cluster `kind` actif (`aiops-cluster-tf`) — la cause dual-cluster documentée en Phase 5-7 était exclue.
- CoreDNS et l'ensemble des pods du control-plane (`etcd`, `kube-apiserver`, `kube-scheduler`, `kube-proxy`, `kindnet`) ont redémarré au même moment.
- `docker inspect` a révélé que le conteneur du control-plane affichait un `StartedAt` antérieur à `uptime -s` (l'heure de démarrage de la machine) — signature typique d'un ajustement d'horloge après une mise en veille/reprise du laptop.
- Auto-résolu après quelques dizaines de minutes ; confirmé par résolution DNS réussie depuis l'intérieur du pod (`python3 -c "socket.gethostbyname(...)"`).

Pas de correctif de code nécessaire — comportement environnemental, pas applicatif.

## 8. Validation end-to-end

Test automatique réalisé sans intervention manuelle :
1. Déclenchement de `GET /tasks/simulate-failure` via l'Ingress (`http://localhost/tasks/simulate-failure`).
2. Attente de la fermeture de la fenêtre glissante (~10 min).
3. Vérification via `GET /anomalies` (`curl localhost:3003/anomalies`) : nouvelle entrée avec `windowStart` correspondant, `simulateFailureCount > 0`, une seule occurrence (pas de doublon).

## 9. État de clôture

- PR #7 (`phase-8-ml-loki-integration` → `main`) mergée.
- Pipeline complet (`lint-build-test` → `docker-build-push` → `deploy`) exécuté avec succès sur `main`, incluant la nouvelle étape de migration Prisma.
- Contrainte `Anomaly_windowStart_key` confirmée en base cluster via `\d "Anomaly"`.

Phase 8 clôturée.
