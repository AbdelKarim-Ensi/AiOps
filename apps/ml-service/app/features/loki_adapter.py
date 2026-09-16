import pandas as pd


def loki_logs_to_dataframe(logs: list[dict]) -> pd.DataFrame:
    """
    Convertit la sortie de `fetch_recent_logs()` (liste de dicts avec
    timestamp_ns/timestamp/pod/container/log) vers le même schéma DataFrame
    que `load_logs()`, pour pouvoir réutiliser `build_features()` sans
    modification.

    Chaque entrée Loki contient déjà le log pino brut sous la clé "log" ;
    on l'extrait et on s'assure que "req" existe toujours (certains logs
    système/startup peuvent ne pas en avoir), pour éviter un crash dans
    build_features() sur `df["req"].apply(...)`.
    """
    records = []
    for entry in logs:
        log = dict(entry["log"])  # copie pour ne pas muter l'original
        if "req" not in log or log["req"] is None:
            log["req"] = {}
        records.append(log)

    if not records:
        # DataFrame vide mais avec les colonnes attendues, pour que
        # build_features() ne plante pas sur une fenêtre sans données
        return pd.DataFrame(columns=["level", "time", "req", "timestamp"]).set_index(
            pd.DatetimeIndex([], name="timestamp")
        ).reset_index()

    df = pd.DataFrame(records)
    df["timestamp"] = pd.to_datetime(df["time"], unit="ms")
    return df
