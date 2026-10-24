"""Background bridge for read-only account snapshots and engine-only remote commands."""
import threading
import time
from datetime import datetime, timezone

from services import bot_state
from services.notification_relay import relay_post, NotificationRelayError

_STOP = threading.Event()
_THREAD = None
_TRADES_REFRESH_SECONDS = 60
_last_trades_refresh = 0.0
_cached_trades = []


def _snapshot():
    global _last_trades_refresh, _cached_trades
    from api.routes.account import get_account
    from api.routes.bot import get_bot_status
    from api.routes.trades import list_trades
    account = get_account()
    bot = get_bot_status()
    if time.monotonic() - _last_trades_refresh >= _TRADES_REFRESH_SECONDS:
        recent_trades = list_trades()
        _cached_trades = recent_trades if isinstance(recent_trades, list) else []
        _last_trades_refresh = time.monotonic()
    recent_trades = _cached_trades
    if not isinstance(account, dict) or "error" in account:
        account = None
    if not isinstance(bot, dict):
        bot = {}
    return {
        "schema_version": 1,
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "account": account,
        "recent_trades": recent_trades if isinstance(recent_trades, list) else [],
        "engine": {
            "bot": bot.get("bot", "offline"),
            "connected": bool(bot.get("connected", False)),
            "running": bool(bot_state.BOT_RUNNING),
            "paused": bool(bot_state.BOT_PAUSED),
            "kill_switch": bool(bot_state.KILL_SWITCH),
            "session": bot.get("session"),
            "uptime": bot.get("uptime"),
        },
    }


def _execute_command(command):
    expires_at = command.get("expires_at")
    if not isinstance(expires_at, str):
        raise RuntimeError("Command expiry is missing; request was refused.")
    try:
        expiry = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
    except ValueError as exc:
        raise RuntimeError("Command expiry is invalid; request was refused.") from exc
    if expiry <= datetime.now(timezone.utc):
        raise RuntimeError("Command expired before execution.")
    from api.routes.bot import start_bot, pause_bot
    action = command.get("action")
    if action == "pause":
        pause_bot()
        return {"success": True, "action": "pause", "running": bool(bot_state.BOT_RUNNING), "paused": bool(bot_state.BOT_PAUSED)}
    if action == "start":
        # Never remotely start without an available MT5 account and local config.
        from engine.mt5_connector import MT5Connector
        from services.config_service import load_config
        import MetaTrader5 as mt5
        if not MT5Connector().connect():
            raise RuntimeError("MT5 is not connected; start was refused locally.")
        account = mt5.account_info()
        if account is None:
            raise RuntimeError("MT5 account information is unavailable; start was refused locally.")
        if getattr(account, "trade_allowed", True) is False or getattr(account, "trade_expert", True) is False:
            raise RuntimeError("MT5 or the broker has disabled automated trading; start was refused locally.")
        config = load_config()
        if not isinstance(config, dict) or not config:
            raise RuntimeError("Local trading configuration is unavailable; start was refused.")
        if bot_state.KILL_SWITCH:
            raise RuntimeError("Kill switch is active; clear it locally before starting.")
        start_bot()
        return {"success": True, "action": "start", "running": bool(bot_state.BOT_RUNNING), "paused": bool(bot_state.BOT_PAUSED)}
    raise RuntimeError("Unsupported remote command.")


def _loop():
    while not _STOP.is_set():
        try:
            relay_post("/v1/snapshot/publish", {"snapshot": _snapshot()})
            result = relay_post("/v1/commands/poll", {})
            for command in result.get("commands", []):
                command_id = command.get("id")
                try:
                    outcome = _execute_command(command)
                    status = "completed"
                except Exception as exc:
                    outcome = {"success": False, "error": str(exc)[:240]}
                    status = "failed"
                if command_id:
                    try:
                        relay_post("/v1/commands/complete", {
                            "command_id": command_id, "status": status, "result": outcome
                        })
                    except NotificationRelayError:
                        pass
        except Exception:
            # A relay outage must not crash the local trading engine.
            pass
        _STOP.wait(5)


def start_remote_monitoring():
    global _THREAD
    if _THREAD and _THREAD.is_alive():
        return
    _STOP.clear()
    _THREAD = threading.Thread(target=_loop, name="remote-monitoring-relay", daemon=True)
    _THREAD.start()


def stop_remote_monitoring():
    _STOP.set()
