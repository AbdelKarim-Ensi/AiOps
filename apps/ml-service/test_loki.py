import asyncio
import time
from app.loki_client import fetch_recent_logs
from app.features.loki_adapter import loki_logs_to_dataframe
from app.features.feature_engineering import build_features

async def main():
    since_ns = time.time_ns() - (10 * 60 * 1_000_000_000)  # 10 minutes avant maintenant

    logs = await fetch_recent_logs(since_ns)
    print(f"{len(logs)} logs récupérés")

    df = loki_logs_to_dataframe(logs)
    print(f"\nDataFrame : {len(df)} lignes, colonnes : {list(df.columns)}")

    features = build_features(df)
    print(f"\n{len(features)} fenêtres de temps générées")
    print(features)

asyncio.run(main())
