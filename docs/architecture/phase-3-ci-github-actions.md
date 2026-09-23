# Phase 3 — CI/CD avec GitHub Actions

**Statut :** ✅ Terminée
**Période :** 1er et 2 septembre 2026 (commits `617a5d0` à `bc531c5`)

## 1. Objectif

Automatiser la validation du backend à chaque push et publier l'image Docker dans le registre GitHub (GHCR).

**Definition of Done (PRD) :**
> Chaque push déclenche automatiquement build + tests + push d'image sans intervention.

## 2. Livrables

Un workflow GitHub Actions qui enchaîne :

1. **lint**
2. **build**
3. **test**
4. **docker build et push** vers GHCR (`ghcr.io/abdelkarim-ensi/aiops-backend`)

La phase 5 ajoute ensuite le job `deploy`, et les phases 9 et 10 dupliquent le schéma pour le service ML et le frontend.

## 3. Difficultés rencontrées

| Problème | Cause | Correction |
|---|---|---|
| Push refusé vers GHCR | Le nom d'image contenait des majuscules ; GHCR exige des minuscules | Nom d'image mis en minuscules (`bd91389`) |
| Tag d'image vide | Le nom d'image calculé dans une étape n'était pas disponible dans la suivante | Calcul du nom en ligne dans la commande (`f963ad4`) |
| Échecs de lint / build | Fichiers en CRLF après le passage de Windows à Linux | Normalisation des fins de ligne en LF (`bc531c5`) |

Le jeton (PAT) utilisé pour pousser doit aussi avoir le scope `workflow` en plus de `repo`, sinon les modifications de `.github/workflows/` sont rejetées.