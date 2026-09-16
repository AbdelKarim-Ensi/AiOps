import httpx
import pandas as pd

# En dev local : http://localhost:3000
# En cluster K8s (Phase 8 étape 4) : http://api-service.aiops.svc.cluster.local:3000
BACKEND_URL = "http://localhost:3000"


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
            # La fenêtre fait "window" minutes ; on la déduit du timestamp
            # de début + la durée de resample utilisée dans build_features().
            # Ici on suppose des fenêtres de 5 minutes (à ajuster si `window`
            # devient un paramètre variable plus tard).
            window_start = row["timestamp"]
            window_end = window_start + pd.Timedelta(minutes=5)

            payload = {
                "windowStart": window_start.isoformat(),
                "windowEnd": window_end.isoformat(),
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
