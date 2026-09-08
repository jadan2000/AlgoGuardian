import json
from pathlib import Path
from threading import RLock

STORAGE_PATH = Path(__file__).resolve().parents[1] / "storage" / "config.json"
_CONFIG_LOCK = RLock()

DEFAULT_CONFIG = {
    "risk_per_trade": 1.0,
    "max_daily_loss": 3.0,
    "max_drawdown": 5.0,
    "max_trades_per_day": 3,
    "confluence_threshold": 60,
    "entry_ema_filter": False,
    "trend_filter": True,
    "adx_filter": True,
    "atr_filter": True,
    "atr_extension_filter": False,
    "momentum_filter": True,
    "spread_filter": True,
    "breakout_filter": False,
    "ema_fast": 20,
    "ema_slow": 50,
    "entry_ema": 20,
    "adx_threshold": 15,
    "atr_ratio": 0.5,
    "atr_extension": 1.2,
    "momentum_multiplier": 1.5,
    "max_spread": 0.3,
    "trend_tf": "H1",
    "entry_tf": "M5",
    "breakout_buffer": 0.15,
    "breakout_lookback": 5,
    "stop_loss": 1.0,
    "take_profit": 1.2,
    "cooldown_minutes": 2,
    "max_open_positions": 2,
    "trading_pairs": ["XAUUSDm"],
    "allow_london": True,
    "allow_ny": True,
    "demo_mode": False,
}


def load_config() -> dict:
    with _CONFIG_LOCK:
        data = {}
        if STORAGE_PATH.exists():
            try:
                with STORAGE_PATH.open("r", encoding="utf-8") as f:
                    data = json.load(f)
            except (json.JSONDecodeError, OSError):
                data = {}

        config = {**DEFAULT_CONFIG, **data}
        if not isinstance(config.get("trading_pairs"), list) or not config["trading_pairs"]:
            config["trading_pairs"] = list(DEFAULT_CONFIG["trading_pairs"])
        return config


def save_config(config_data: dict) -> dict:
    with _CONFIG_LOCK:
        merged = {**DEFAULT_CONFIG, **config_data}
        STORAGE_PATH.parent.mkdir(parents=True, exist_ok=True)
        with STORAGE_PATH.open("w", encoding="utf-8") as f:
            json.dump(merged, f, indent=2)
        return merged
