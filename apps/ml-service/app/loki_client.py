import os
import httpx
import json
import time
from datetime import datetime, timezone

LOKI_URL = os.environ.get("LOKI_URL", "http://localhost:3100")
TENANT_ID = os.environ.get("LOKI_TENANT_ID", "aiops")
NAMESPACE_QUERY = os.environ.get("LOKI_QUERY", '{namespace="aiops", container="api"}')
def _is_health_probe(parsed_log: dict) -> bool:
    """
    Détecte les requêtes de liveness/readiness probe kube-probe
    pour qu'elles ne polluent pas le feature engineering.
    """
    req = parsed_log.get("req", {})
    user_agent = req.get("headers", {}).get("user-agent", "")
    return req.get("url") == "/health" and "kube-probe" in user_agent


async def fetch_recent_logs(
    since_ns: int,
    limit: int = 1000,
    exclude_probes: bool = True,
) -> list[dict]:
    """
    Récupère les logs Loki depuis `since_ns` (timestamp Unix en nanosecondes)
    jusqu'à maintenant. Retourne une liste de dicts avec timestamp + log parsé,
    triée par ordre chronologique croissant.

    Par défaut, exclut les requêtes de probes kube-probe (/health) pour ne
    garder que le trafic applicatif réel.
    """
    end_ns = time.time_ns()

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"{LOKI_URL}/loki/api/v1/query_range",
            headers={"X-Scope-OrgID": TENANT_ID},
            params={
                "query": NAMESPACE_QUERY,
                "start": since_ns,
                "end": end_ns,
                "limit": limit,
            },
        )
        response.raise_for_status()
        payload = response.json()

    logs = []
    skipped_probes = 0

    for stream in payload.get("data", {}).get("result", []):
        stream_labels = stream.get("stream", {})
        for entry_ts_ns, raw_line in stream.get("values", []):
            try:
                parsed = json.loads(raw_line)
            except json.JSONDecodeError:
                continue  # ligne non-JSON, on l'ignore proprement

            if exclude_probes and _is_health_probe(parsed):
                skipped_probes += 1
                continue

            logs.append({
                "timestamp_ns": int(entry_ts_ns),
                "timestamp": datetime.fromtimestamp(
                    int(entry_ts_ns) / 1e9, tz=timezone.utc
                ),
                "pod": stream_labels.get("pod"),
                "container": stream_labels.get("container"),
                "log": parsed,
            })

    if skipped_probes:
        print(f"[loki_client] {skipped_probes} probes kube-probe filtrées")

    logs.sort(key=lambda x: x["timestamp_ns"])
    return logs
