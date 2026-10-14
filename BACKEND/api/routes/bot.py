from fastapi import APIRouter, HTTPException
import MetaTrader5 as mt5
import json
from pathlib import Path

from config import MT5_LOGIN, MT5_PASSWORD, MT5_SERVER, MT5_PATH
from services.config_service import load_config
from services.trade_service import log_closed_trade
from services import bot_state
from engine.session_manager import SessionManager
from engine.mt5_connector import MT5Connector

router = APIRouter()
mt5_connector = MT5Connector()

SIGNALS_FILE = Path(__file__).resolve().parents[2] / "storage" / "signals.json"


@router.delete("/signals/clear")
def clear_signals():
    SIGNALS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with SIGNALS_FILE.open("w", encoding="utf-8") as f:
        json.dump([], f)
    return {"success": True, "message": "Signals cleared"}


@router.post("/start")
def start_bot():
    bot_state.BOT_RUNNING = True
    bot_state.BOT_PAUSED = False
    bot_state.KILL_SWITCH = False
    return {"success": True, "bot": "running"}


@router.post("/pause")
def pause_bot():
    bot_state.BOT_RUNNING = False
    bot_state.BOT_PAUSED = True
    return {"success": True, "bot": "paused"}


@router.post("/kill")
def kill_bot():
    bot_state.BOT_RUNNING = False
    bot_state.BOT_PAUSED = True
    bot_state.KILL_SWITCH = True
    return {"success": True, "bot": "killed"}


@router.get("/status")
def get_bot_status():
    if not mt5_connector.connect():
        return {
            "bot": "offline",
            "connected": False,
            "running": bot_state.BOT_RUNNING,
            "paused": bot_state.BOT_PAUSED,
            "kill_switch": bot_state.KILL_SWITCH,
        }

    account = mt5.account_info()
    positions = mt5.positions_get()
    config = load_config()
    session = SessionManager().current_session()

    return {
        "bot": (
            "killed" if bot_state.KILL_SWITCH
            else "paused" if bot_state.BOT_PAUSED
            else "running" if bot_state.BOT_RUNNING
            else "stopped"
        ),
        "running": bot_state.BOT_RUNNING,
        "paused": bot_state.BOT_PAUSED,
        "kill_switch": bot_state.KILL_SWITCH,
        "connected": account is not None,
        "uptime": "ONLINE" if account else "OFFLINE",
        "latency": "0ms",
        "equity": f"${round(account.equity, 2)}" if account else "$0",
        "session": session,
        "open_trades": len(positions) if positions else 0,
        "config": {
            "max_trades_per_day": config["max_trades_per_day"]
        },
    }


@router.post("/trades/{ticket}/close")
def close_trade(ticket: int):
    if not mt5_connector.connect():
        raise HTTPException(status_code=500, detail=f"MT5 connection failed: {mt5.last_error()}")

    positions = mt5.positions_get()
    if positions is None:
        raise HTTPException(status_code=500, detail=f"Failed to get positions: {mt5.last_error()}")

    position = next((pos for pos in positions if int(pos.ticket) == int(ticket)), None)
    if position is None:
        raise HTTPException(status_code=404, detail=f"Position {ticket} not found")

    tick = mt5.symbol_info_tick(position.symbol)
    info = mt5.symbol_info(position.symbol)
    if tick is None or info is None:
        raise HTTPException(status_code=500, detail="Failed to get symbol tick or symbol settings")

    config = load_config()

    if position.type == mt5.POSITION_TYPE_BUY:
        order_type = mt5.ORDER_TYPE_SELL
        price = tick.bid
        trade_type = "BUY"
    else:
        order_type = mt5.ORDER_TYPE_BUY
        price = tick.ask
        trade_type = "SELL"

    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": position.symbol,
        "volume": position.volume,
        "type": order_type,
        "position": position.ticket,
        "price": price,
        "deviation": int(config["deviation"]),
        "magic": int(config["magic"]),
        "comment": f"{config['order_comment']} close",
        "type_time": mt5.ORDER_TIME_GTC,
    }

    # Select only a filling mode supported by this symbol/broker.
    filling_flags = int(getattr(info, "filling_mode", 0) or 0)
    filling_candidates = []
    if filling_flags & int(getattr(mt5, "SYMBOL_FILLING_IOC", 2)):
        filling_candidates.append(mt5.ORDER_FILLING_IOC)
    if filling_flags & int(getattr(mt5, "SYMBOL_FILLING_FOK", 1)):
        filling_candidates.append(mt5.ORDER_FILLING_FOK)
    market_execution = getattr(mt5, "SYMBOL_TRADE_EXECUTION_MARKET", 2)
    if getattr(info, "trade_exemode", None) != market_execution:
        filling_candidates.append(mt5.ORDER_FILLING_RETURN)
    filling_candidates = list(dict.fromkeys(filling_candidates))
    if not filling_candidates:
        filling_candidates = [mt5.ORDER_FILLING_FOK, mt5.ORDER_FILLING_IOC]

    result = None
    for index, filling_mode in enumerate(filling_candidates):
        request["type_filling"] = filling_mode
        result = mt5.order_send(request)
        if result is None:
            raise HTTPException(status_code=500, detail=f"Order send failed: {mt5.last_error()}")
        if result.retcode == mt5.TRADE_RETCODE_DONE:
            break
        unsupported_filling = getattr(mt5, "TRADE_RETCODE_INVALID_FILL", 10030)
        if result.retcode == unsupported_filling and index + 1 < len(filling_candidates):
            continue
        raise HTTPException(status_code=500, detail=f"Close failed. Retcode={result.retcode}; comment={result.comment}")

    if result is None or result.retcode != mt5.TRADE_RETCODE_DONE:
        raise HTTPException(status_code=500, detail="Close failed: no supported filling mode succeeded")

    log_closed_trade(
        ticket=position.ticket,
        symbol=position.symbol,
        trade_type=trade_type,
        volume=position.volume,
        profit=position.profit,
    )

    return {"success": True, "ticket": ticket, "message": "Trade closed successfully"}


@router.get("/signals")
def get_signals(limit: int = 10):
    if not SIGNALS_FILE.exists():
        return []
    try:
        with SIGNALS_FILE.open("r", encoding="utf-8") as f:
            signals = json.load(f)
        return signals[-max(0, min(limit, 100)):]
    except (json.JSONDecodeError, OSError):
        return []
