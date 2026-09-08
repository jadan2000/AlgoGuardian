import json
from pathlib import Path
from models.config import Config

STORAGE_PATH = Path(__file__).resolve().parents[1] / "storage" / "config.json"


def load_config() -> dict:
    if not STORAGE_PATH.exists():
        return {}
    with STORAGE_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_config(config_data: dict) -> dict:
    with STORAGE_PATH.open("w", encoding="utf-8") as f:
        json.dump(config_data, f, indent=2)
    return config_data
