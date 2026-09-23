# Phase 5 — Déploiement Kubernetes de l'API et de PostgreSQL

**Statut :** ✅ Terminée
**Période :** 10 au 13 septembre 2026 (commits `4de6264`, `b6ba594` ; PR #3 et #4)
**Cluster :** `aiops-cluster-tf`, namespace `aiops`

## 1. Objectif

Déployer le backend et sa base sur Kubernetes, les exposer via un Ingress, et automatiser le déploiement depuis la CI.

**Definition of Done (PRD) :**
> Application accessible via Ingress (http://localhost), données persistantes, CI/CD redéploie sur K8s.

## 2. Livrables

| Ressource | Détail |
|---|---|
| Deployment + Service `api-service` | NestJS, port 3000, sondes liveness et readiness |
| StatefulSet + PVC + Service `postgres-service` | PostgreSQL avec stockage persistant, sondes de santé |
| Ingress Nginx | `localhost/` → `api-service:3000` (modifié en phase 10 : `/` → frontend, `/api` → backend) |
| Secrets | `postgres-secret`, `api-secret` (créés à la main, jamais versionnés) |
| Job `deploy` | Exécuté par un runner GitHub Actions self-hosted : `lint-build-test → docker-build-push → deploy` |

## 3. Validation (Definition of Done)

- Persistance : suppression du pod PostgreSQL, les données survivent grâce au PVC.
- Pipeline validé de bout en bout, job `deploy` en environ 1 min 28 s.
- Le runner self-hosted doit être actif pour que `deploy` s'exécute.

## 4. Difficultés rencontrées

| Problème | Cause | Correction |
|---|---|---|
| Pulls d'images bloqués ou très lents, erreurs `server misbehaving` | Deux clusters kind simultanés cassaient le DNS | Suppression de l'ancien cluster (`kind delete cluster --name <nom>`) |
| `rollout status` en timeout | Pulls lents pendant le problème DNS | Timeout porté de 60 s à 600 s (`b6ba594`) |
| Tag `postgres:15-alpine-amd64` introuvable | Ce tag n'existe pas | Utiliser `postgres:15-alpine` |
| Erreurs silencieuses de lecture de Secret | Secret nommé `api-secret` au lieu de `postgres-secret` dans le manifest Postgres | Noms de Secret alignés entre manifests et `secretRef` |
| `kind load docker-image` échoue | Digest de manifest multi-plateforme | `crictl pull` directement dans le nœud |