import asyncio
import time
from app.loki_client import fetch_recent_logs
from app.features.loki_adapter import loki_logs_to_dataframe
from app.features.feature_engineering import build_features
from app.predict import predict_anomalies

async def main():
    since_ns = time.time_ns() - (10 * 60 * 1_000_000_000)

    logs = await fetch_recent_logs(since_ns)
    print(f"{len(logs)} logs récupérés")

    df = loki_logs_to_dataframe(logs)
    features = build_features(df)

    predictions = predict_anomalies(features)
    print(predictions.to_string())

asyncio.run(main())
