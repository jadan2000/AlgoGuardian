import json
from pathlib import Path

STORAGE_PATH = Path(__file__).resolve().parents[1] / "storage" / "logs.json"


def get_logs() -> list:
    if not STORAGE_PATH.exists():
        return []
    with STORAGE_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_log(entry: dict) -> dict:
    logs = get_logs()
    logs.append(entry)
    with STORAGE_PATH.open("w", encoding="utf-8") as f:
        json.dump(logs, f, indent=2)
    return entry
