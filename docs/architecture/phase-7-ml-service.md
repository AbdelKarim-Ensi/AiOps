# Phase 7 — ML service (Isolation Forest)

**Status:** ✅ Done
**Period:** 16 September 2026 (commits `1ca3ba0` to `1957a15`; PR #6)

## 1. Goal

Build the Python service that detects abnormal behaviour from windows of logs, before connecting it to Loki (phase 8).

**Definition of Done (PRD):**
> Local ML service responds on `/predict` with a consistent anomaly score, accuracy > 80%.

## 2. Deliverables

FastAPI service in `apps/ml-service`:

- **Feature engineering** with pandas (dedicated virtual environment): turning logs into numeric features per window.
- **Isolation Forest training** (scikit-learn): **94.44% accuracy** against the ground truth of a test set, above the 80% threshold set by the PRD.
- **`/predict` endpoint** that returns a score and an anomaly verdict.
- **Dockerfile** and `.dockerignore`; image `aiops-ml-service:dev`, built and tested.

## 3. Points of attention

- The `StandardScaler` raised a `UserWarning`, fixed in the same batch.
- The model (`model/*.joblib`) is ignored by git; it later had to be embedded explicitly in the image (phase 9, commit `eebff9f`).
- The image is local: it is loaded into the cluster with `kind load docker-image`.

## 4. Next

Phase 8 connects the service to Loki, with a continuous polling loop and anomalies sent to the backend: see [phase-8-ml-loki-integration.md](phase-8-ml-loki-integration.md).
