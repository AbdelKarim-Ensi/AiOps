
import json
import random
from datetime import datetime, timedelta

START_TIME = datetime(2026, 9, 15, 0, 0, 0)
DURATION_MINUTES = 6 * 60         
NORMAL_LOGS_PER_MINUTE = 9         
NORMAL_ERROR_RATE = 0.03           


ANOMALY_WINDOWS = [
    (60, 5, "burst"),
    (150, 5, "errors"),
    (240, 5, "burst"),
    (300, 5, "errors"),
    (330, 5, "burst"),
]

URLS = ["/health", "/tasks", "/tasks/simulate-failure", "/anomalies", "/users"]
METHODS = ["GET", "POST", "GET", "GET", "PATCH"]


def in_anomaly_window(minute: int):
    """Retourne le type d'anomalie active à cette minute, ou None."""
    for start, duration, kind in ANOMALY_WINDOWS:
        if start <= minute < start + duration:
            return kind
    return None


def make_log(timestamp: datetime, is_error: bool) -> dict:
    idx = random.randrange(len(URLS))
    level = 50 if is_error else 30
    return {
        "level": level,
        "time": int(timestamp.timestamp() * 1000),
        "msg": "Simulated internal failure occurred" if is_error else "request completed",
        "req": {
            "method": METHODS[idx],
            "url": URLS[idx],
        },
        "namespace": "aiops",
        "container": "api",
    }


def generate() -> list[dict]:
    logs = []
    for minute in range(DURATION_MINUTES):
        ts_base = START_TIME + timedelta(minutes=minute)
        anomaly = in_anomaly_window(minute)

        if anomaly == "burst":
            n_logs = NORMAL_LOGS_PER_MINUTE * 3  
            error_rate = NORMAL_ERROR_RATE
        elif anomaly == "errors":
            n_logs = NORMAL_LOGS_PER_MINUTE
            error_rate = 0.6                       
        else:
            n_logs = NORMAL_LOGS_PER_MINUTE
            error_rate = NORMAL_ERROR_RATE

        for _ in range(n_logs):
            offset_seconds = random.uniform(0, 60)
            ts = ts_base + timedelta(seconds=offset_seconds)
            is_error = random.random() < error_rate
            log = make_log(ts, is_error)
            
            log["_is_anomaly"] = 1 if anomaly is not None else 0
            logs.append(log)

    logs.sort(key=lambda l: l["time"])
    return logs


def main():
    logs = generate()
    output_path = "data/simulated_logs.jsonl"
    import os
    os.makedirs("data", exist_ok=True)
    with open(output_path, "w") as f:
        for log in logs:
            f.write(json.dumps(log) + "\n")

    n_anomalies = sum(l["_is_anomaly"] for l in logs)
    print(f"{len(logs)} logs générés -> {output_path}")
    print(f"{n_anomalies} logs marqués comme faisant partie d'une fenêtre anormale")
    print(f"Fenêtres d'anomalies injectées : {ANOMALY_WINDOWS}")


if __name__ == "__main__":
    main()