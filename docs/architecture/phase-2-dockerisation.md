# Phase 2 — Dockerisation du backend

**Statut :** ✅ Terminée
**Période :** 1er septembre 2026 (commit `2ab2fb2`)

## 1. Objectif

Produire une image Docker reproductible et légère du backend, et pouvoir lancer PostgreSQL en local sans l'installer.

**Definition of Done (PRD) :**
> `docker compose up` démarre l'API et la BDD, endpoints accessibles de l'extérieur.

## 2. Livrables

- **Dockerfile multi-stage** pour le backend : une étape de build, une étape d'exécution réduite à ce qui est nécessaire pour démarrer l'API.
- **`docker-compose`** lançant PostgreSQL pour le développement local.

## 3. Points d'attention

- L'image finale tourne sur Alpine : les `binaryTargets` Prisma ont dû être corrigés en phase 8 pour que le client Prisma fonctionne dans ce conteneur.
- Cette image est celle que la CI construit et pousse (phase 3) puis que Kubernetes déploie (phase 5).