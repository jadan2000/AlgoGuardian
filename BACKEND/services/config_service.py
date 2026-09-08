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
    "lot_size": 0.01,
    "deviation": 20,
    "magic": 20250620,
    "order_comment": "AlgoGuardian",
}


NUMERIC_RANGES = {
    "risk_per_trade": (0.0, 100.0),
    "max_daily_loss": (0.0, 100.0),
    "max_drawdown": (0.0, 100.0),
    "max_trades_per_day": (0, 1000),
    "confluence_threshold": (0, 100),
    "ema_fast": (2, 500),
    "ema_slow": (2, 1000),
    "entry_ema": (2, 500),
    "adx_threshold": (0, 100),
    "atr_ratio": (0, 100),
    "atr_extension": (0, 100),
    "momentum_multiplier": (0, 100),
    "max_spread": (0, 1000),
    "breakout_buffer": (0, 1000),
    "breakout_lookback": (1, 500),
    "stop_loss": (0.0000001, 1000000),
    "take_profit": (0.0000001, 1000000),
    "cooldown_minutes": (0, 100000),
    "max_open_positions": (1, 1000),
    "lot_size": (0.0, 1000),
    "deviation": (0, 10000),
    "magic": (0, 2147483647),
}

BOOL_KEYS = {
    "entry_ema_filter", "trend_filter", "adx_filter", "atr_filter",
    "atr_extension_filter", "momentum_filter", "spread_filter",
    "breakout_filter", "allow_london", "allow_ny", "demo_mode",
}

TEXT_KEYS = {"trend_tf", "entry_tf", "order_comment"}


class ConfigError(ValueError):
    pass


def validate_config(config_data: dict) -> dict:
    if not isinstance(config_data, dict):
        raise ConfigError("Configuration must be a JSON object")

    merged = {**DEFAULT_CONFIG, **config_data}

    for key, (minimum, maximum) in NUMERIC_RANGES.items():
        value = merged.get(key)
        if isinstance(value, bool):
            raise ConfigError(f"{key} must be numeric")
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            raise ConfigError(f"{key} must be numeric")
        if numeric < minimum or numeric > maximum:
            raise ConfigError(f"{key} must be between {minimum} and {maximum}")
        if key in {"max_trades_per_day", "ema_fast", "ema_slow", "entry_ema", "breakout_lookback", "cooldown_minutes", "max_open_positions", "deviation", "magic"}:
            merged[key] = int(numeric)
        else:
            merged[key] = numeric

    for key in BOOL_KEYS:
        if not isinstance(merged.get(key), bool):
            raise ConfigError(f"{key} must be boolean")

    for key in TEXT_KEYS:
        if not isinstance(merged.get(key), str) or not merged[key].strip():
            raise ConfigError(f"{key} must be a non-empty string")

    pairs = merged.get("trading_pairs")
    if not isinstance(pairs, list) or not pairs or any(not isinstance(p, str) or not p.strip() for p in pairs):
        raise ConfigError("trading_pairs must be a non-empty list of symbol names")

    if merged["ema_fast"] >= merged["ema_slow"]:
        raise ConfigError("ema_fast must be lower than ema_slow")

    if merged["take_profit"] <= 0 or merged["stop_loss"] <= 0:
        raise ConfigError("stop_loss and take_profit must be greater than zero")

    return merged


def load_config() -> dict:
    with _CONFIG_LOCK:
        data = {}
        if STORAGE_PATH.exists():
            try:
                with STORAGE_PATH.open("r", encoding="utf-8") as f:
                    data = json.load(f)
            except (json.JSONDecodeError, OSError):
                data = {}
        try:
            return validate_config(data)
        except ConfigError:
            return validate_config(DEFAULT_CONFIG)


def save_config(config_data: dict) -> dict:
    validated = validate_config(config_data)
    with _CONFIG_LOCK:
        STORAGE_PATH.parent.mkdir(parents=True, exist_ok=True)
        with STORAGE_PATH.open("w", encoding="utf-8") as f:
            json.dump(validated, f, indent=2)
    return validated
