# Phase 7 — Service ML (Isolation Forest)

**Statut :** ✅ Terminée
**Période :** 16 septembre 2026 (commits `1ca3ba0` à `1957a15` ; PR #6)

## 1. Objectif

Construire le service Python qui détecte les comportements anormaux à partir de fenêtres de logs, avant de le brancher sur Loki (phase 8).

**Definition of Done (PRD) :**
> Service ML local répond sur `/predict` avec un score d'anomalie cohérent, précision > 80 %.

## 2. Livrables

Service FastAPI dans `apps/ml-service` :

- **Feature engineering** avec pandas (environnement virtuel dédié) : transformation des logs en features numériques par fenêtre.
- **Entraînement d'un Isolation Forest** (scikit-learn) : **94,44 % de précision** face à la vérité terrain d'un jeu de test, au-dessus du seuil de 80 % fixé par le PRD.
- **Endpoint `/predict`** qui renvoie un score et un verdict d'anomalie.
- **Dockerfile** et `.dockerignore` ; image `aiops-ml-service:dev`, construite et testée.

## 3. Points d'attention

- Le `StandardScaler` a généré un `UserWarning` corrigé dans le même lot.
- Le modèle (`model/*.joblib`) est ignoré par git ; il a ensuite dû être embarqué explicitement dans l'image (phase 9, commit `eebff9f`).
- L'image est locale : elle est chargée dans le cluster avec `kind load docker-image`.

## 4. Suite

La phase 8 branche le service sur Loki, avec une boucle de polling continue et l'envoi des anomalies au backend : voir [phase-8-ml-loki-integration.md](phase-8-ml-loki-integration.md).