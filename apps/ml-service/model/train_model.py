import joblib
from pathlib import Path
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

from app.features.feature_engineering import load_logs, build_features, FEATURE_COLUMNS

DATA_PATH = "data/simulated_logs.jsonl"
MODEL_DIR = Path("model")
MODEL_PATH = MODEL_DIR / "isolation_forest.joblib"


def main():
    # 1. Charger les logs bruts puis construire les features
    raw_logs = load_logs(DATA_PATH)
    df = build_features(raw_logs)

    X = df[FEATURE_COLUMNS]

    # 2. Normaliser (Isolation Forest est sensible à l'échelle)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # 3. Entraîner Isolation Forest
    # contamination ≈ proportion attendue d'anomalies (495/3510 ≈ 0.14)
    model = IsolationForest(
        n_estimators=200,
        contamination=0.14,
        random_state=42,
        n_jobs=-1
    )
    model.fit(X_scaled)

    # 4. Sauvegarder modèle + scaler ensemble
    MODEL_DIR.mkdir(exist_ok=True)
    joblib.dump(
        {"model": model, "scaler": scaler, "features": FEATURE_COLUMNS},
        MODEL_PATH
    )
    print(f"Modèle entraîné et sauvegardé dans {MODEL_PATH}")

    # 5. Évaluation rapide vs ground truth si dispo
    if "ground_truth_anomaly" in df.columns:
        preds = model.predict(X_scaled)  # -1 = anomalie, 1 = normal
        df["predicted_anomaly"] = (preds == -1).astype(int)
        accuracy = (df["predicted_anomaly"] == df["ground_truth_anomaly"]).mean()
        print(f"Accuracy vs ground truth: {accuracy:.2%}")


if __name__ == "__main__":
    main()