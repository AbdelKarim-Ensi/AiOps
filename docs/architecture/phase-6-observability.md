# Phase 6 — Observabilité des logs (Loki + Grafana Alloy)

**Statut :** ✅ Terminée
**Cluster :** `kind` local, `aiops-cluster-tf`
**Namespace observabilité :** `observability` (séparé du namespace applicatif `aiops`)

## 1. Objectif

Rendre les logs de l'API NestJS (namespace `aiops`) visibles, centralisés et
filtrables dans une interface unique, en préparation des phases suivantes
(ML — Phase 7/8 — et alerting — Phase 11) qui consommeront ces mêmes logs.

**Definition of Done (DoD) :**
> Logs de l'API visibles et filtrables dans Grafana via Loki, au moins 3
> requêtes LogQL documentées.

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

**Flux :**
1. L'API NestJS écrit ses logs en JSON structuré sur `stdout` (via `nestjs-pino`).
2. Grafana Alloy, déployé en DaemonSet, découvre les pods du namespace `aiops`
   via `discovery.kubernetes`, les filtre via `discovery.relabel`, ajoute les
   labels `pod` / `namespace` / `container`, puis pousse les logs vers Loki.
3. Loki stocke les logs (mode `SingleBinary`, filesystem local, adapté à un
   cluster kind mono-nœud) sous le tenant `aiops` (multi-tenancy activée,
   header `X-Scope-OrgID: aiops` obligatoire sur toute requête).
4. Grafana interroge Loki comme datasource (header `X-Scope-OrgID` configuré
   automatiquement via provisioning, cf. `values-grafana.yaml`) et permet
   l'exploration des logs via LogQL dans l'onglet **Explore**.

## 3. Composants déployés

| Composant | Chart Helm | Mode | Rôle |
|---|---|---|---|
| Loki | `grafana/loki` v7.3.0 | SingleBinary (replicas=1, read/write/backend=0) | Stockage et indexation des logs |
| Grafana Alloy | `grafana/alloy` | DaemonSet, config custom `.alloy` | Collecte des logs K8s → Loki |
| Grafana | `grafana/grafana` | `persistence.enabled=false` | Visualisation, Explore, LogQL |

Pods résultants dans `observability` : `loki-0`, `loki-gateway-*`,
`loki-canary-*`, `loki-chunks-cache-0`, `loki-results-cache-0`, `alloy-*`
(DaemonSet), `grafana-*`.

## 4. Fichiers et reproductibilité

Tous les paramètres Helm sont versionnés (plus de commandes `--set` ad hoc) :

```
infra/k8s/observability/
├── loki/
│   └── values-loki.yaml
├── grafana-alloy/
│   ├── alloy-config.alloy      # pipeline de collecte (discovery, relabel, push)
│   └── values-alloy.yaml
├── grafana/
│   └── values-grafana.yaml     # inclut le provisioning auto de la datasource Loki
└── install.sh                  # installation/mise à jour idempotente
```

**Installation complète depuis un cluster vierge :**
```bash
chmod +x infra/k8s/observability/install.sh
./infra/k8s/observability/install.sh
```

Le script crée le namespace, ajoute le repo Helm `grafana`, puis installe
Loki → Alloy → Grafana dans cet ordre (Loki doit être up avant qu'Alloy ne
pousse des logs, et avant que Grafana ne teste la datasource).

**Accès local à Grafana :**
```bash
kubectl -n observability port-forward svc/grafana 3001:80
# http://localhost:3001 — admin / admin (cf. dette technique, section 6)
```

## 5. Requêtes LogQL documentées

### Requête 1 — Filtrage par service (namespace + conteneur)
```logql
{namespace="aiops", container="api"}
```
Isole les logs du conteneur applicatif `api` en excluant explicitement
PostgreSQL (`container="postgres"` n'apparaît pas). Validée avec 555 logs
remontés, histogramme temporel cohérent dans l'onglet Explore.

**Usage :** vue de base pour toute investigation sur l'API.

### Requête 2 — Filtrage par niveau de log (parsing JSON)
```logql
{namespace="aiops", container="api"} | json | level=50
```
`nestjs-pino` suit la convention **Pino** : le champ `level` est numérique,
pas une chaîne (`10`=trace, `20`=debug, `30`=info, `40`=warn, `50`=error,
`60`=fatal). Le pipe `| json` parse le corps JSON de chaque ligne de log et
expose `level` comme label filtrable.

**Validation :** logs générés via l'endpoint de test `/tasks/simulate-failure`
(20 appels curl), remontés avec `level: 50`, `errorType: "SIMULATED_FAILURE"`,
`msg: "Simulated internal failure occurred"`.

**Alternative testée :** `detected_level`, un label dérivé automatiquement
par Loki à partir du contenu du log, sans nécessiter de parsing JSON manuel :
```logql
{namespace="aiops", container="api"} | detected_level="error"
```

**Usage :** isoler rapidement les erreurs applicatives pour investigation ou,
plus tard, alimenter Alertmanager (Phase 11).

### Requête 3 — Métrique de volume dans le temps
```logql
sum(count_over_time({namespace="aiops", container="api"}[5m]))
```
Agrège le nombre de lignes de log sur des fenêtres glissantes de 5 minutes.
Contrairement aux requêtes 1 et 2 (retour de logs bruts), celle-ci retourne
une série temporelle numérique, visualisable en graphique dans Grafana.

**Validation :** courbe stable autour de ~50 (bruit de fond des health
checks `kube-probe`), avec un pic net (~110) correspondant exactement à
la génération volontaire de 20 requêtes d'erreur via `simulate-failure`.

**Usage :** détection de pics d'activité / d'anomalies de volume — sert de
base conceptuelle à l'intégration ML de la Phase 7/8 (Isolation Forest sur
les métriques de logs).

### Requête bonus — Répartition par niveau
```logql
sum by (level) (count_over_time({namespace="aiops", container="api"} | json [5m]))
```
Combine parsing JSON et agrégation pour distinguer, sur le même graphique,
le volume de logs `info` (30) et `error` (50). Non requise par le DoD mais
utile pour un dashboard de suivi (Phase 9).

## 6. Points d'attention / dette technique connue

- **Mot de passe Grafana en clair** (`adminPassword: admin` dans
  `values-grafana.yaml`) : acceptable pour un cluster kind local isolé,
  mais à externaliser via un `Secret` Kubernetes avant tout déploiement
  non-local.
- **Stockage Loki filesystem local** (`storage.type: filesystem`) : adapté
  au contexte local/pré-thèse, non persistant en cas de suppression du pod
  `loki-0` sans PVC dédié — acceptable ici, à revoir pour un environnement
  de production (S3/GCS backend).
- **Multi-tenancy à un seul tenant** (`aiops`) : la configuration supporte
  déjà plusieurs tenants si le projet devait évoluer vers plusieurs
  environnements ou équipes.

## 7. Suite (Phase 7)

Les logs collectés et structurés dans Loki serviront de source de données
pour le service ML (FastAPI + scikit-learn, Isolation Forest) chargé de
détecter les anomalies — la requête 3 ci-dessus (comptage temporel) préfigure
le type de signal qui sera exploité pour l'entraînement du modèle.