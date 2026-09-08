import json
from pathlib import Path

STORAGE_PATH = Path(__file__).resolve().parents[1] / "storage" / "signals.json"


def get_analytics() -> dict:
    if not STORAGE_PATH.exists():
        return {"signals": 0, "summary": {}}
    with STORAGE_PATH.open("r", encoding="utf-8") as f:
        signals = json.load(f)
    return {"signals": len(signals), "summary": {"latest": signals[-1] if signals else None}}
