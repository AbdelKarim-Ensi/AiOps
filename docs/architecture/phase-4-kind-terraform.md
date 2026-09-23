# Phase 4 — Cluster Kubernetes local (kind) et Terraform

**Statut :** ✅ Terminée
**Période :** 3 au 5 septembre 2026 (commits `bb2fbc0`, `ce4c944` ; PR #1 et #2)

## 1. Objectif

Disposer d'un cluster Kubernetes local, d'abord créé à la main pour comprendre le fonctionnement, puis décrit en code avec Terraform.

**Definition of Done (PRD) :**
> `terraform apply` crée un cluster kind prêt, un Pod de test répond, `destroy` détruit tout proprement.

## 2. Livrables

- **Cluster kind** de test avec un Deployment et un Service nginx pour valider le réseau et le déploiement.
- **Module Terraform** `infra/terraform/modules/kind-cluster` (provider `tehcyx/kind`, `main.tf`, `variables.tf`, `outputs.tf`).
- Cluster final : `aiops-cluster-tf`.

Versions utilisées : kind 0.24.0, Terraform 1.9.5.

## 3. Cycle Terraform pratiqué

```bash
cd infra/terraform/modules/kind-cluster
terraform init      # télécharge le provider
terraform plan      # calcule les changements
terraform apply     # crée le cluster
terraform destroy   # supprime le cluster
```

Le fichier `.tfstate` mémorise l'état réel ; il est ignoré par git (`*.tfstate` dans `.gitignore`).

## 4. Leçon retenue

Ne jamais garder deux clusters kind en même temps. L'ancien cluster créé à la main (`aiops-cluster`) coexistant avec `aiops-cluster-tf` a provoqué des erreurs DNS chroniques (voir phase 5). Toujours lancer `kind get clusters` avant un diagnostic réseau.