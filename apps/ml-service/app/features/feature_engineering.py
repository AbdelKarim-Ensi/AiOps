
import pandas as pd


def load_logs(path: str) -> pd.DataFrame:
    """Charge un fichier JSONL de logs en DataFrame pandas."""
    df = pd.read_json(path, lines=True)
    df["timestamp"] = pd.to_datetime(df["time"], unit="ms")
    return df


def build_features(df: pd.DataFrame, window: str = "5min") -> pd.DataFrame:
    """
    Agrège les logs bruts en features numériques par fenêtre de temps.

    `window` suit la syntaxe pandas resample (ex: "5min", "1min").
    """
    df = df.set_index("timestamp").sort_index()

    is_error = df["level"] == 50
    is_simulate_failure = df["req"].apply(lambda r: r.get("url") == "/tasks/simulate-failure")

    total_logs = df["level"].resample(window).count().rename("total_logs")
    error_count = is_error.resample(window).sum().rename("error_count")
    distinct_urls = (
        df["req"].apply(lambda r: r.get("url"))
        .resample(window)
        .nunique()
        .rename("distinct_urls")
    )
    simulate_failure_count = (
        is_simulate_failure.resample(window).sum().rename("simulate_failure_count")
    )

    features = pd.concat(
        [total_logs, error_count, distinct_urls, simulate_failure_count], axis=1
    ).fillna(0)

   
    features["error_rate"] = features["error_count"] / features["total_logs"].replace(0, 1)

    
    if "_is_anomaly" in df.columns:
        ground_truth = (
            df["_is_anomaly"].resample(window).max().rename("ground_truth_anomaly")
        )
        features = features.join(ground_truth)

    return features.reset_index()


FEATURE_COLUMNS = [
    "total_logs",
    "error_count",
    "error_rate",
    "distinct_urls",
    "simulate_failure_count",
]


if __name__ == "__main__":
    df = load_logs("data/simulated_logs.jsonl")
    features = build_features(df)
    print(features.head(10))
    print(f"\n{len(features)} fenêtres de temps générées")
    print(f"Colonnes features utilisées par le modèle : {FEATURE_COLUMNS}")