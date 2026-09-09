"""Persistent two-hour paper-trading experiment journal.

The journal is append-only: each checkpoint receives its own immutable JSON
snapshot so configuration, code version, market activity, trades and health
can be compared later.
"""

import hashlib
import json
import os
import platform
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

import MetaTrader5 as mt5

from services.config_service import load_config

BASE = Path(__file__).resolve().parents[1]
STORAGE = BASE / "storage"
JOURNAL = STORAGE / "experiment_history"
STATE_FILE = JOURNAL / "state.json"


def _now():
    return datetime.now(timezone.utc).isoformat()


def _read(path, default):
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return default


def _write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(value, f, indent=2, default=str)
    os.replace(tmp, path)


def _git_info():
    info = {"repository": "jadan2000/BOT", "branch": None, "commit": None, "dirty": None}
    try:
        info["commit"] = subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=BASE, text=True, stderr=subprocess.DEVNULL
        ).strip()
        info["branch"] = subprocess.check_output(
            ["git", "branch", "--show-current"], cwd=BASE, text=True, stderr=subprocess.DEVNULL
        ).strip() or None
        info["dirty"] = bool(subprocess.check_output(
            ["git", "status", "--porcelain"], cwd=BASE, text=True, stderr=subprocess.DEVNULL
        ).strip())
    except (OSError, subprocess.SubprocessError):
        pass
    return info


def config_fingerprint(config):
    raw = json.dumps(config, sort_keys=True, separators=(",", ":"), default=str).encode()
    return hashlib.sha256(raw).hexdigest()


def _account_snapshot():
    account = mt5.account_info()
    if account is None:
        return {}
    fields = (
        "login", "server", "currency", "balance", "credit", "profit", "equity",
        "margin", "margin_free", "margin_level", "margin_so_call", "margin_so_so",
        "leverage", "trade_mode", "limit_orders",
    )
    return {k: getattr(account, k, None) for k in fields}


def _positions_snapshot():
    positions = mt5.positions_get() or []
    result = []
    for p in positions:
        result.append({
            "ticket": int(getattr(p, "ticket", 0)),
            "time": int(getattr(p, "time", 0)),
            "symbol": getattr(p, "symbol", None),
            "type": int(getattr(p, "type", 0)),
            "volume": float(getattr(p, "volume", 0)),
            "price_open": float(getattr(p, "price_open", 0)),
            "price_current": float(getattr(p, "price_current", 0)),
            "sl": float(getattr(p, "sl", 0)),
            "tp": float(getattr(p, "tp", 0)),
            "profit": float(getattr(p, "profit", 0)),
            "swap": float(getattr(p, "swap", 0)),
            "magic": int(getattr(p, "magic", 0)),
            "comment": getattr(p, "comment", None),
        })
    return result


def begin_cycle():
    config = load_config()
    state = _read(STATE_FILE, {})
    cycle_id = int(state.get("cycle_number", 0)) + 1
    start = _now()
    cycle = {
        "cycle_id": cycle_id,
        "started_at": start,
        "status": "RUNNING",
        "git": _git_info(),
        "config": config,
        "config_hash": config_fingerprint(config),
        "environment": {
            "python": platform.python_version(),
            "platform": platform.platform(),
        },
        "account_start": _account_snapshot(),
        "positions_start": _positions_snapshot(),
        "signals": [],
        "execution_events": [],
        "errors": [],
    }
    state.update({"cycle_number": cycle_id, "active_cycle": cycle_id, "active_started_at": start})
    _write(STATE_FILE, state)
    _write(JOURNAL / f"cycle_{cycle_id:06d}_running.json", cycle)
    return cycle_id


def record_signal(cycle_id, signal):
    if not signal:
        return
    path = JOURNAL / f"cycle_{int(cycle_id):06d}_running.json"
    cycle = _read(path, {})
    cycle.setdefault("signals", []).append({"timestamp": _now(), "signal": signal})
    _write(path, cycle)


def record_execution(cycle_id, signal, result):
    path = JOURNAL / f"cycle_{int(cycle_id):06d}_running.json"
    cycle = _read(path, {})
    cycle.setdefault("execution_events", []).append({
        "timestamp": _now(), "signal": signal, "result": result,
    })
    _write(path, cycle)


def record_error(cycle_id, error):
    path = JOURNAL / f"cycle_{int(cycle_id):06d}_running.json"
    cycle = _read(path, {})
    cycle.setdefault("errors", []).append({"timestamp": _now(), "error": str(error)})
    _write(path, cycle)


def finish_cycle(cycle_id):
    path = JOURNAL / f"cycle_{int(cycle_id):06d}_running.json"
    cycle = _read(path, {})
    cycle["finished_at"] = _now()
    cycle["status"] = "COMPLETE"
    cycle["git_end"] = _git_info()
    cycle["config_end"] = load_config()
    cycle["config_end_hash"] = config_fingerprint(cycle["config_end"])
    cycle["account_end"] = _account_snapshot()
    cycle["positions_end"] = _positions_snapshot()

    start = cycle.get("account_start", {})
    end = cycle.get("account_end", {})
    cycle["performance"] = {
        "balance_change": (float(end.get("balance", 0)) - float(start.get("balance", 0))) if end and start else None,
        "equity_change": (float(end.get("equity", 0)) - float(start.get("equity", 0))) if end and start else None,
        "realized_or_account_profit_change": (float(end.get("profit", 0)) - float(start.get("profit", 0))) if end and start else None,
    }

    final = JOURNAL / f"cycle_{int(cycle_id):06d}.json"
    _write(final, cycle)
    try:
        path.unlink()
    except OSError:
        pass
    state = _read(STATE_FILE, {})
    state["last_completed_cycle"] = cycle_id
    state["last_completed_at"] = cycle["finished_at"]
    state.pop("active_cycle", None)
    state.pop("active_started_at", None)
    _write(STATE_FILE, state)
    return cycle


def run_checkpoint_if_due(force=False):
    """Run a checkpoint every two hours while the process is alive.

    This is intended for the bot runner. It does not alter strategy settings or
    restart code; it only records the paper-trading experiment state.
    """
    state = _read(STATE_FILE, {})
    active = state.get("active_cycle")
    now = time.time()
    started = state.get("active_started_epoch")
    if active is None:
        cycle_id = begin_cycle()
        state = _read(STATE_FILE, {})
        state["active_started_epoch"] = now
        _write(STATE_FILE, state)
        return cycle_id
    if force or (started and now - float(started) >= 7200):
        finish_cycle(active)
        cycle_id = begin_cycle()
        state = _read(STATE_FILE, {})
        state["active_started_epoch"] = now
        _write(STATE_FILE, state)
        return cycle_id
    return active
