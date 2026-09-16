# Plateforme AIOps — Détection d'Anomalies dans les Logs

Monorepo du projet pré-PFE. Structure complète prévue pour les 12 phases
de la roadmap. Chaque dossier correspond à une ou plusieurs phases —
voir le tableau ci-dessous.

## Arborescence

```
aiops-platform/
├── apps/
│   ├── api/                    # Phase 1, 2, 5 — NestJS + Prisma + PostgreSQL
│   │   ├── src/
│   │   │   ├── tasks/          # Module Task (CRUD + logs)
│   │   │   │   └── dto/
│   │   │   ├── anomalies/      # Module Anomalies (Phase 8 — reçoit les résultats du ML)
│   │   │   │   └── dto/
│   │   │   ├── prisma/         # Service Prisma injectable
│   │   │   └── common/         # Health check, filtres, guards partagés
│   │   ├── prisma/             # schema.prisma + migrations
│   │   └── test/
│   │
│   ├── ml-service/             # Phase 7, 8 — Python + FastAPI + Isolation Forest
│   │   ├── app/                # API FastAPI (main.py, extraction de features)
│   │   ├── model/              # Modèle entraîné (.pkl) + script train.py
│   │   └── scripts/            # Génération de logs simulés, réentraînement
│   │
│   └── frontend/               # Phase 10 — Dashboard minimal
│       ├── src/
│       │   ├── components/     # Composants UI (liste anomalies, graphique)
│       │   ├── pages/          # Pages de l'app
│       │   └── services/       # Appels API (fetch/axios)
│       └── public/
│
├── infra/
│   ├── terraform/              # Phase 4 — Infrastructure as Code
│   │   ├── modules/
│   │   │   └── kind-cluster/   # Module réutilisable pour provisionner kind
│   │   └── environments/
│   │       └── local/          # Config spécifique à l'environnement local
│   │
│   └── k8s/                    # Manifests Kubernetes
│       ├── base/               # Phase 5 — Déploiement applicatif
│       │   ├── api/
│       │   ├── ml-service/
│       │   ├── frontend/
│       │   ├── postgres/
│       │   └── ingress/
│       └── observability/      # Phase 6, 9, 11 — Stack observabilité
│           ├── loki/
│           ├── grafana-alloy/
│           ├── prometheus/
│           ├── grafana/
│           └── alertmanager/
│
├── .github/
│   └── workflows/               # Phase 3 — Pipelines CI/CD GitHub Actions
│
├── docs/
│   └── architecture/            # Phase 12 — Schémas d'architecture, diagrammes
│
└── scripts/                     # Scripts utilitaires transverses (setup, seed, etc.)
```

## Correspondance Phase -> Dossier

| Phase | Dossier(s) concerné(s) |
|---|---|
| P1 — NestJS + Prisma + PostgreSQL | `apps/api/` |
| P2 — Dockerisation | `apps/api/Dockerfile`, `docker-compose.yml` (racine) |
| P3 — CI/CD basique | `.github/workflows/` |
| P4 — Kubernetes local + Terraform | `infra/terraform/` |
| P5 — Déploiement app sur K8s | `infra/k8s/base/` |
| P6 — Loki + Grafana Alloy | `infra/k8s/observability/loki/`, `grafana-alloy/` |
| P7 — Service ML Isolation Forest | `apps/ml-service/` |
| P8 — Intégration ML <-> Loki <-> PostgreSQL | `apps/api/src/anomalies/`, `apps/ml-service/` |
| P9 — Prometheus + Grafana | `infra/k8s/observability/prometheus/`, `grafana/` |
| P10 — Dashboard frontend | `apps/frontend/` |
| P11 — Alerting Alertmanager | `infra/k8s/observability/alertmanager/` |
| P12 — Documentation | `docs/`, README racine |

## Statut actuel

- [x] Phase 1 — API NestJS + Prisma (voir `apps/api/`)
- [ ] Phase 2 — Dockerisation
- [ ] Phase 3 — CI/CD basique
- [ ] Phase 4 — Kubernetes local + Terraform
- [ ] Phase 5 — Déploiement K8s
- [ ] Phase 6 — Loki + Grafana Alloy
- [ ] Phase 7 — Service ML
- [ ] Phase 8 — Intégration ML
- [ ] Phase 9 — Prometheus + Grafana
- [ ] Phase 10 — Dashboard frontend
- [ ] Phase 11 — Alerting
- [ ] Phase 12 — Documentation finale

```
AiOps
├─ README.md
├─ apps
│  ├─ backend
│  │  ├─ .dockerignore
│  │  ├─ .eslintrc.js
│  │  ├─ .prettierrc
│  │  ├─ Dockerfile
│  │  ├─ README.md
│  │  ├─ nest-cli.json
│  │  ├─ package-lock.json
│  │  ├─ package.json
│  │  ├─ prisma
│  │  │  ├─ migrations
│  │  │  │  ├─ 20260831222244_init
│  │  │  │  │  └─ migration.sql
│  │  │  │  └─ migration_lock.toml
│  │  │  └─ schema.prisma
│  │  ├─ src
│  │  │  ├─ anomalies
│  │  │  │  └─ dto
│  │  │  ├─ app.controller.spec.ts
│  │  │  ├─ app.controller.ts
│  │  │  ├─ app.module.ts
│  │  │  ├─ app.service.ts
│  │  │  ├─ common
│  │  │  │  └─ health.controller.ts
│  │  │  ├─ main.ts
│  │  │  ├─ prisma
│  │  │  │  ├─ prisma.module.ts
│  │  │  │  └─ prisma.service.ts
│  │  │  └─ tasks
│  │  │     ├─ dto
│  │  │     │  ├─ create-task.dto.ts
│  │  │     │  └─ update-task.dto.ts
│  │  │     ├─ tasks.controller.ts
│  │  │     ├─ tasks.module.ts
│  │  │     └─ tasks.service.ts
│  │  ├─ test
│  │  │  ├─ app.e2e-spec.ts
│  │  │  └─ jest-e2e.json
│  │  ├─ tsconfig.build.json
│  │  └─ tsconfig.json
│  ├─ frontend
│  │  ├─ public
│  │  └─ src
│  │     ├─ components
│  │     ├─ pages
│  │     └─ services
│  └─ ml-service
│     ├─ app
│     ├─ model
│     └─ scripts
├─ desktop.ini
├─ docker-compose.yml
├─ docs
│  └─ architecture
├─ infra
│  ├─ k8s
│  │  ├─ base
│  │  │  ├─ api
│  │  │  ├─ frontend
│  │  │  ├─ ingress
│  │  │  ├─ ml-service
│  │  │  └─ postgres
│  │  ├─ nginx-deployment.yaml
│  │  ├─ nginx-service.yaml
│  │  └─ observability
│  │     ├─ alertmanager
│  │     ├─ grafana
│  │     ├─ grafana-alloy
│  │     ├─ loki
│  │     └─ prometheus
│  └─ terraform
│     ├─ environments
│     │  └─ local
│     └─ modules
│        └─ kind-cluster
│           ├─ .terraform.lock.hcl
│           ├─ main.tf
│           ├─ outputs.tf
│           └─ variables.tf
└─ scripts

```
```
AiOps
├─ README.md
├─ apps
│  ├─ backend
│  │  ├─ .dockerignore
│  │  ├─ .eslintrc.js
│  │  ├─ .prettierrc
│  │  ├─ Dockerfile
│  │  ├─ README.md
│  │  ├─ nest-cli.json
│  │  ├─ package-lock.json
│  │  ├─ package.json
│  │  ├─ prisma
│  │  │  ├─ migrations
│  │  │  │  ├─ 20260831222244_init
│  │  │  │  │  └─ migration.sql
│  │  │  │  └─ migration_lock.toml
│  │  │  └─ schema.prisma
│  │  ├─ src
│  │  │  ├─ anomalies
│  │  │  │  └─ dto
│  │  │  ├─ app.controller.spec.ts
│  │  │  ├─ app.controller.ts
│  │  │  ├─ app.module.ts
│  │  │  ├─ app.service.ts
│  │  │  ├─ common
│  │  │  │  └─ health.controller.ts
│  │  │  ├─ main.ts
│  │  │  ├─ prisma
│  │  │  │  ├─ prisma.module.ts
│  │  │  │  └─ prisma.service.ts
│  │  │  └─ tasks
│  │  │     ├─ dto
│  │  │     │  ├─ create-task.dto.ts
│  │  │     │  └─ update-task.dto.ts
│  │  │     ├─ tasks.controller.ts
│  │  │     ├─ tasks.module.ts
│  │  │     └─ tasks.service.ts
│  │  ├─ test
│  │  │  ├─ app.e2e-spec.ts
│  │  │  └─ jest-e2e.json
│  │  ├─ tsconfig.build.json
│  │  └─ tsconfig.json
│  ├─ frontend
│  │  ├─ public
│  │  └─ src
│  │     ├─ components
│  │     ├─ pages
│  │     └─ services
│  └─ ml-service
│     ├─ app
│     ├─ model
│     └─ scripts
├─ desktop.ini
├─ docker-compose.yml
├─ docs
│  └─ architecture
├─ infra
│  ├─ k8s
│  │  ├─ base
│  │  │  ├─ api
│  │  │  │  ├─ configmap.yaml
│  │  │  │  ├─ deployment.yaml
│  │  │  │  ├─ secret.yaml
│  │  │  │  └─ service.yaml
│  │  │  ├─ frontend
│  │  │  ├─ ingress
│  │  │  │  └─ ingress.yaml
│  │  │  ├─ ml-service
│  │  │  ├─ namespace.yaml
│  │  │  └─ postgres
│  │  │     ├─ configmap.yaml
│  │  │     ├─ secret.yaml
│  │  │     ├─ service.yaml
│  │  │     └─ statefulset.yaml
│  │  ├─ nginx-deployment.yaml
│  │  ├─ nginx-service.yaml
│  │  └─ observability
│  │     ├─ alertmanager
│  │     ├─ grafana
│  │     ├─ grafana-alloy
│  │     ├─ loki
│  │     └─ prometheus
│  └─ terraform
│     ├─ environments
│     │  └─ local
│     └─ modules
│        └─ kind-cluster
│           ├─ .terraform.lock.hcl
│           ├─ main.tf
│           ├─ outputs.tf
│           └─ variables.tf
└─ scripts

```
```
AiOps
├─ README.md
├─ apps
│  ├─ backend
│  │  ├─ .dockerignore
│  │  ├─ .eslintrc.js
│  │  ├─ .prettierrc
│  │  ├─ Dockerfile
│  │  ├─ README.md
│  │  ├─ nest-cli.json
│  │  ├─ package-lock.json
│  │  ├─ package.json
│  │  ├─ prisma
│  │  │  ├─ migrations
│  │  │  │  ├─ 20260831222244_init
│  │  │  │  │  └─ migration.sql
│  │  │  │  └─ migration_lock.toml
│  │  │  └─ schema.prisma
│  │  ├─ src
│  │  │  ├─ anomalies
│  │  │  │  └─ dto
│  │  │  ├─ app.controller.spec.ts
│  │  │  ├─ app.controller.ts
│  │  │  ├─ app.module.ts
│  │  │  ├─ app.service.ts
│  │  │  ├─ common
│  │  │  │  └─ health.controller.ts
│  │  │  ├─ main.ts
│  │  │  ├─ prisma
│  │  │  │  ├─ prisma.module.ts
│  │  │  │  └─ prisma.service.ts
│  │  │  └─ tasks
│  │  │     ├─ dto
│  │  │     │  ├─ create-task.dto.ts
│  │  │     │  └─ update-task.dto.ts
│  │  │     ├─ tasks.controller.ts
│  │  │     ├─ tasks.module.ts
│  │  │     └─ tasks.service.ts
│  │  ├─ test
│  │  │  ├─ app.e2e-spec.ts
│  │  │  └─ jest-e2e.json
│  │  ├─ tsconfig.build.json
│  │  └─ tsconfig.json
│  ├─ frontend
│  │  ├─ public
│  │  └─ src
│  │     ├─ components
│  │     ├─ pages
│  │     └─ services
│  └─ ml-service
│     ├─ app
│     ├─ model
│     └─ scripts
├─ desktop.ini
├─ docker-compose.yml
├─ docs
│  └─ architecture
│     └─ phase-6-observability.md
├─ infra
│  ├─ k8s
│  │  ├─ base
│  │  │  ├─ api
│  │  │  │  ├─ configmap.yaml
│  │  │  │  ├─ deployment.yaml
│  │  │  │  ├─ secret.yaml
│  │  │  │  └─ service.yaml
│  │  │  ├─ frontend
│  │  │  ├─ ingress
│  │  │  │  └─ ingress.yaml
│  │  │  ├─ ml-service
│  │  │  ├─ namespace.yaml
│  │  │  └─ postgres
│  │  │     ├─ configmap.yaml
│  │  │     ├─ secret.yaml
│  │  │     ├─ service.yaml
│  │  │     └─ statefulset.yaml
│  │  ├─ nginx-deployment.yaml
│  │  ├─ nginx-service.yaml
│  │  └─ observability
│  │     ├─ alertmanager
│  │     ├─ grafana
│  │     │  └─ values-grafana.yaml
│  │     ├─ grafana-alloy
│  │     │  └─ values-alloy.yaml
│  │     ├─ install.sh
│  │     ├─ loki
│  │     │  └─ values-loki.yaml
│  │     └─ prometheus
│  └─ terraform
│     ├─ environments
│     │  └─ local
│     └─ modules
│        └─ kind-cluster
│           ├─ .terraform.lock.hcl
│           ├─ main.tf
│           ├─ outputs.tf
│           └─ variables.tf
└─ scripts

```
```
AiOps
├─ README.md
├─ apps
│  ├─ backend
│  │  ├─ .dockerignore
│  │  ├─ .eslintrc.js
│  │  ├─ .prettierrc
│  │  ├─ Dockerfile
│  │  ├─ README.md
│  │  ├─ nest-cli.json
│  │  ├─ package-lock.json
│  │  ├─ package.json
│  │  ├─ prisma
│  │  │  ├─ migrations
│  │  │  │  ├─ 20260831222244_init
│  │  │  │  │  └─ migration.sql
│  │  │  │  └─ migration_lock.toml
│  │  │  └─ schema.prisma
│  │  ├─ src
│  │  │  ├─ anomalies
│  │  │  │  └─ dto
│  │  │  ├─ app.controller.spec.ts
│  │  │  ├─ app.controller.ts
│  │  │  ├─ app.module.ts
│  │  │  ├─ app.service.ts
│  │  │  ├─ common
│  │  │  │  └─ health.controller.ts
│  │  │  ├─ main.ts
│  │  │  ├─ prisma
│  │  │  │  ├─ prisma.module.ts
│  │  │  │  └─ prisma.service.ts
│  │  │  └─ tasks
│  │  │     ├─ dto
│  │  │     │  ├─ create-task.dto.ts
│  │  │     │  └─ update-task.dto.ts
│  │  │     ├─ tasks.controller.ts
│  │  │     ├─ tasks.module.ts
│  │  │     └─ tasks.service.ts
│  │  ├─ test
│  │  │  ├─ app.e2e-spec.ts
│  │  │  └─ jest-e2e.json
│  │  ├─ tsconfig.build.json
│  │  └─ tsconfig.json
│  ├─ frontend
│  │  ├─ public
│  │  └─ src
│  │     ├─ components
│  │     ├─ pages
│  │     └─ services
│  └─ ml-service
│     ├─ app
│     │  └─ features
│     │     └─ feature_engineering.py
│     ├─ data
│     │  └─ simulated_logs.jsonl
│     ├─ model
│     ├─ requirements.txt
│     └─ scripts
│        └─ generate_logs.py
├─ desktop.ini
├─ docker-compose.yml
├─ docs
│  └─ architecture
│     └─ phase-6-observability.md
├─ infra
│  ├─ k8s
│  │  ├─ base
│  │  │  ├─ api
│  │  │  │  ├─ configmap.yaml
│  │  │  │  ├─ deployment.yaml
│  │  │  │  ├─ secret.yaml
│  │  │  │  └─ service.yaml
│  │  │  ├─ frontend
│  │  │  ├─ ingress
│  │  │  │  └─ ingress.yaml
│  │  │  ├─ ml-service
│  │  │  ├─ namespace.yaml
│  │  │  └─ postgres
│  │  │     ├─ configmap.yaml
│  │  │     ├─ secret.yaml
│  │  │     ├─ service.yaml
│  │  │     └─ statefulset.yaml
│  │  ├─ nginx-deployment.yaml
│  │  ├─ nginx-service.yaml
│  │  └─ observability
│  │     ├─ alertmanager
│  │     ├─ grafana
│  │     │  └─ values-grafana.yaml
│  │     ├─ grafana-alloy
│  │     │  └─ values-alloy.yaml
│  │     ├─ install.sh
│  │     ├─ loki
│  │     │  └─ values-loki.yaml
│  │     └─ prometheus
│  └─ terraform
│     ├─ environments
│     │  └─ local
│     └─ modules
│        └─ kind-cluster
│           ├─ .terraform.lock.hcl
│           ├─ main.tf
│           ├─ outputs.tf
│           └─ variables.tf
└─ scripts

```