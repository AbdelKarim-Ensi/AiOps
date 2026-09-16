import joblib
import pandas as pd
from pathlib import Path

MODEL_PATH = Path("model/isolation_forest.joblib")

_artifact = None  # cache en mémoire, chargé une seule fois au premier appel


def _load_artifact():
    global _artifact
    if _artifact is None:
        _artifact = joblib.load(MODEL_PATH)
    return _artifact


def predict_anomalies(features_df: pd.DataFrame) -> pd.DataFrame:
    """
    Prend le DataFrame de features produit par build_features() et retourne
    le même DataFrame enrichi de deux colonnes :
      - anomaly_score : score de décision Isolation Forest (plus c'est négatif,
        plus c'est anormal)
      - is_anomaly : booléen, True si le modèle classe la fenêtre comme anomalie

    Ne modifie pas features_df en place ; retourne une copie.
    """
    artifact = _load_artifact()
    model = artifact["model"]
    scaler = artifact["scaler"]
    feature_columns = artifact["features"]

    result = features_df.copy()

    if result.empty:
        result["anomaly_score"] = pd.Series(dtype=float)
        result["is_anomaly"] = pd.Series(dtype=bool)
        return result

    X = result[feature_columns]
    X_scaled = scaler.transform(X)

    # decision_function : score continu (négatif = anormal, positif = normal)
    result["anomaly_score"] = model.decision_function(X_scaled)
    # predict : -1 = anomalie, 1 = normal -> on convertit en booléen explicite
    result["is_anomaly"] = model.predict(X_scaled) == -1

    return result
