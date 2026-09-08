import json
from pathlib import Path

from fastapi import APIRouter

router = APIRouter()


@router.get("/strategy-stats")
def get_strategy_stats():

    strategy_file = (
        Path.cwd()
        / "storage"
        / "strategy_stats.json"
    )

    try:
        with open(strategy_file, "r", encoding="utf-8") as f:
            return json.load(f)

    except Exception as e:
        return {
            "error": str(e),
            "path": str(strategy_file),
            "exists": strategy_file.exists(),
            "market_conditions": [],
            "recent_evaluations": []
        }