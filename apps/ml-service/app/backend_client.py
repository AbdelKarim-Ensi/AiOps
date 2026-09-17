import os
import httpx
import pandas as pd

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:3000")


async def send_anomalies_to_backend(predictions_df: pd.DataFrame) -> list[dict]:
    """
    Envoie chaque fenêtre détectée comme anomalie (is_anomaly=True) vers
    l'API NestJS via POST /anomalies. Les fenêtres normales ne sont pas
    envoyées (on ne stocke que les anomalies, cf. décision produit Phase 8).

    Retourne la liste des réponses du backend (anomalies créées avec leur id).
    Les échecs individuels sont loggés mais n'interrompent pas l'envoi des
    autres fenêtres du batch.
    """
    anomalies = predictions_df[predictions_df["is_anomaly"]]

    if anomalies.empty:
        return []

    created = []

    async with httpx.AsyncClient(timeout=10.0) as client:
        for _, row in anomalies.iterrows():

            window_start = row["timestamp"]
            window_end = window_start + pd.Timedelta(minutes=5)

            # AJOUT : on force le fuseau UTC explicitement avant isoformat().
            # Sans ça, un timestamp naive ("2026-09-17T15:20:00" sans offset)
            # est réinterprété par Node/Prisma comme heure locale du serveur,
            # ce qui décale windowStart/windowEnd du fuseau local (ex: -1h en CET).
            window_start_utc = (
                window_start.tz_localize("UTC") if window_start.tzinfo is None
                else window_start.tz_convert("UTC")
            )
            window_end_utc = (
                window_end.tz_localize("UTC") if window_end.tzinfo is None
                else window_end.tz_convert("UTC")
            )

            payload = {
                "windowStart": window_start_utc.isoformat(),
                "windowEnd": window_end_utc.isoformat(),
                "totalLogs": int(row["total_logs"]),
                "errorCount": int(row["error_count"]),
                "distinctUrls": int(row["distinct_urls"]),
                "simulateFailureCount": int(row["simulate_failure_count"]),
                "errorRate": float(row["error_rate"]),
                "anomalyScore": float(row["anomaly_score"]),
            }

            try:
                response = await client.post(f"{BACKEND_URL}/anomalies", json=payload)
                response.raise_for_status()
                created.append(response.json())
            except httpx.HTTPError as exc:
                print(f"[backend_client] échec envoi anomalie {window_start}: {exc}")

    return created
