import asyncio
import time
from contextlib import asynccontextmanager
from pathlib import Path

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from prometheus_fastapi_instrumentator import Instrumentator
from prometheus_client import Counter, Histogram, Gauge

from app.loki_client import fetch_recent_logs
from app.features.loki_adapter import loki_logs_to_dataframe
from app.features.feature_engineering import build_features
from app.predict import predict_anomalies
from app.backend_client import send_anomalies_to_backend

MODEL_PATH = Path("model/isolation_forest.joblib")
POLL_INTERVAL_SECONDS = 10
WINDOW_MINUTES = 5
LOOKBACK_NS = (WINDOW_MINUTES + 5) * 60 * 1_000_000_000

_artifact = None
_sent_windows: set[str] = set()

# --- Métriques custom sur la boucle de polling ---
POLLING_CYCLES = Counter(
    "ml_polling_cycles_total",
    "Nombre total de cycles de polling exécutés",
    ["status"],
)

POLLING_CYCLE_DURATION = Histogram(
    "ml_polling_cycle_duration_seconds",
    "Durée d'un cycle de polling en secondes",
    buckets=[0.1, 0.5, 1, 2, 5, 10, 20, 30],
)

LAST_WINDOW_ANOMALIES = Gauge(
    "ml_anomalies_detected_last_window",
    "Nombre d'anomalies détectées lors du dernier cycle de polling",
)

ANOMALIES_SENT_TOTAL = Counter(
    "ml_anomalies_sent_total",
    "Nombre total d'anomalies envoyées au backend",
)


def _is_window_closed(window_start: pd.Timestamp) -> bool:
    window_end = window_start + pd.Timedelta(minutes=WINDOW_MINUTES)
    return window_end.to_pydatetime().replace(tzinfo=None) <= pd.Timestamp.utcnow().replace(tzinfo=None)


async def _polling_loop():
    while True:
        cycle_start = time.monotonic()
        cycle_status = "success"
        try:
            since_ns = time.time_ns() - LOOKBACK_NS
            logs = await fetch_recent_logs(since_ns)

            if logs:
                df = loki_logs_to_dataframe(logs)
                if not df.empty:
                    features = build_features(df, window=f"{WINDOW_MINUTES}min")
                    predictions = predict_anomalies(features)

                    closed = predictions[
                        predictions["timestamp"].apply(_is_window_closed)
                        & ~predictions["timestamp"].astype(str).isin(_sent_windows)
                    ]

                    if not closed.empty:
                        created = await send_anomalies_to_backend(closed)
                        _sent_windows.update(closed["timestamp"].astype(str))
                        if created:
                            print(f"[polling] {len(created)} anomalie(s) envoyée(s) au backend")
                            ANOMALIES_SENT_TOTAL.inc(len(created))

                        LAST_WINDOW_ANOMALIES.set(len(created) if created else 0)
                    else:
                        LAST_WINDOW_ANOMALIES.set(0)

                    cutoff = pd.Timestamp.utcnow().replace(tzinfo=None) - pd.Timedelta(hours=1)
                    _sent_windows.intersection_update(
                        ts for ts in _sent_windows if pd.Timestamp(ts) > cutoff
                    )

        except Exception as exc:
            print(f"[polling] erreur pendant le cycle: {exc}")
            cycle_status = "error"

        finally:
            POLLING_CYCLES.labels(status=cycle_status).inc()
            POLLING_CYCLE_DURATION.observe(time.monotonic() - cycle_start)

        await asyncio.sleep(POLL_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _artifact
    if not MODEL_PATH.exists():
        raise RuntimeError(f"Modèle introuvable : {MODEL_PATH}. Lance d'abord train_model.py")
    _artifact = joblib.load(MODEL_PATH)

    task = asyncio.create_task(_polling_loop())
    print(f"[main] boucle de polling démarrée (intervalle: {POLL_INTERVAL_SECONDS}s, lookback: {LOOKBACK_NS/1e9:.0f}s)")

    yield

    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    print("[main] boucle de polling arrêtée")


app = FastAPI(title="AiOps ML Service", version="0.1.0", lifespan=lifespan)

Instrumentator().instrument(app).expose(app, endpoint="/metrics")


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

    x = pd.DataFrame([[getattr(payload, col) for col in feature_cols]], columns=feature_cols)
    x_scaled = scaler.transform(x)

    pred = model.predict(x_scaled)[0]
    score = model.decision_function(x_scaled)[0]

    return PredictionOutput(
        is_anomaly=bool(pred == -1),
        anomaly_score=float(score)
    )
