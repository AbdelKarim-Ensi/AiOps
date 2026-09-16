from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import joblib
import pandas as pd
from pathlib import Path

MODEL_PATH = Path("model/isolation_forest.joblib")

app = FastAPI(title="AiOps ML Service", version="0.1.0")

_artifact = None


@app.on_event("startup")
def load_model():
    global _artifact
    if not MODEL_PATH.exists():
        raise RuntimeError(f"Modèle introuvable : {MODEL_PATH}. Lance d'abord train_model.py")
    _artifact = joblib.load(MODEL_PATH)


class PredictionInput(BaseModel):
    total_logs: int
    error_count: int
    error_rate: float
    distinct_urls: int
    simulate_failure_count: int


class PredictionOutput(BaseModel):
    is_anomaly: bool
    anomaly_score: float


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": _artifact is not None}


@app.post("/predict", response_model=PredictionOutput)
def predict(payload: PredictionInput):
    if _artifact is None:
        raise HTTPException(status_code=503, detail="Modèle non chargé")

    model = _artifact["model"]
    scaler = _artifact["scaler"]
    feature_cols = _artifact["features"]

    # DataFrame avec les mêmes noms de colonnes que lors du fit (évite le UserWarning)
    x = pd.DataFrame([[getattr(payload, col) for col in feature_cols]], columns=feature_cols)
    x_scaled = scaler.transform(x)

    pred = model.predict(x_scaled)[0]             # -1 = anomalie, 1 = normal
    score = model.decision_function(x_scaled)[0]  # plus bas = plus anormal

    return PredictionOutput(
        is_anomaly=bool(pred == -1),
        anomaly_score=float(score)
    )