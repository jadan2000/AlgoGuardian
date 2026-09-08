from fastapi import APIRouter, HTTPException
import MetaTrader5 as mt5
import json

from config import MT5_LOGIN, MT5_PASSWORD, MT5_SERVER, MT5_PATH
from services.config_service import load_config
from services.trade_service import log_closed_trade
from services import bot_state
from engine.session_manager import SessionManager
from pathlib import Path

router = APIRouter()

@router.delete("/signals/clear")
def clear_signals():

    signals_file = (
        Path(__file__).resolve().parents[2]
        / "storage"
        / "signals.json"
    )

    with open(signals_file, "w", encoding="utf-8") as f:
        json.dump([], f)

    return {
        "success": True,
        "message": "Signals cleared"
    }

@router.delete("/signals/clear")
def clear_signals():

    signals_file = (
        Path(__file__).resolve().parents[2]
        / "storage"
        / "signals.json"
    )

    with open(signals_file, "w", encoding="utf-8") as f:
        json.dump([], f)

    return {
        "success": True,
        "message": "Signals cleared"
    }

@router.post("/start")
def start_bot():

    bot_state.BOT_RUNNING = True
    bot_state.BOT_PAUSED = False
    bot_state.KILL_SWITCH = False

    return {
        "success": True,
        "bot": "running"
    }


@router.post("/pause")
def pause_bot():

    bot_state.BOT_RUNNING = False
    bot_state.BOT_PAUSED = True

    return {
        "success": True,
        "bot": "paused"
    }


@router.post("/kill")
def kill_bot():

    bot_state.BOT_RUNNING = False
    bot_state.BOT_PAUSED = True
    bot_state.KILL_SWITCH = True

    return {
        "success": True,
        "bot": "killed"
    }


@router.get("/status")
def get_bot_status():

    if not mt5.initialize(path=MT5_PATH):
        return {
            "bot": "offline",
            "connected": False,
            "running": bot_state.BOT_RUNNING,
            "paused": bot_state.BOT_PAUSED,
            "kill_switch": bot_state.KILL_SWITCH
        }

    mt5.login(
        MT5_LOGIN,
        password=MT5_PASSWORD,
        server=MT5_SERVER
    )

    account = mt5.account_info()
    positions = mt5.positions_get()

    config = load_config()

    session_manager = SessionManager()

    if session_manager.london_open():
        session = "LONDON"
    elif session_manager.newyork_open():
        session = "NEW YORK"
    else:
        session = "CLOSED"

    return {
        "bot": (
            "killed"
            if bot_state.KILL_SWITCH
            else "paused"
            if bot_state.BOT_PAUSED
            else "running"
        ),
        "running": bot_state.BOT_RUNNING,
        "paused": bot_state.BOT_PAUSED,
        "kill_switch": bot_state.KILL_SWITCH,
        "connected": True,
        "uptime": "ONLINE",
        "latency": "0ms",
        "equity": f"${round(account.equity, 2)}" if account else "$0",
        "session": session,
        "open_trades": len(positions) if positions else 0,
        "config": {
            "max_trades_per_day": config.get(
                "max_trades_per_day",
                5
            )
        }
    }


@router.post("/trades/{ticket}/close")
def close_trade(ticket: int):

    if not mt5.initialize(path=MT5_PATH):
        raise HTTPException(
            status_code=500,
            detail=f"MT5 initialize failed: {mt5.last_error()}"
        )

    if not mt5.login(
        MT5_LOGIN,
        password=MT5_PASSWORD,
        server=MT5_SERVER
    ):
        raise HTTPException(
            status_code=500,
            detail=f"MT5 login failed: {mt5.last_error()}"
        )

    positions = mt5.positions_get()

    if positions is None:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get positions: {mt5.last_error()}"
        )

    position = None

    for pos in positions:
        if int(pos.ticket) == int(ticket):
            position = pos
            break

    if position is None:
        raise HTTPException(
            status_code=404,
            detail=f"Position {ticket} not found"
        )

    tick = mt5.symbol_info_tick(position.symbol)

    if tick is None:
        raise HTTPException(
            status_code=500,
            detail="Failed to get symbol tick"
        )

    if position.type == mt5.POSITION_TYPE_BUY:
        order_type = mt5.ORDER_TYPE_SELL
        price = tick.bid
    else:
        order_type = mt5.ORDER_TYPE_BUY
        price = tick.ask

    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": position.symbol,
        "volume": position.volume,
        "type": order_type,
        "position": position.ticket,
        "price": price,
        "deviation": 20,
        "magic": 20250620,
        "comment": "Manual Close",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_FOK,
    }

    result = mt5.order_send(request)

    if result is None:
        raise HTTPException(
            status_code=500,
            detail=f"Order send failed: {mt5.last_error()}"
        )

    if result.retcode != mt5.TRADE_RETCODE_DONE:
        raise HTTPException(
            status_code=500,
            detail=f"Close failed. Retcode={result.retcode}"
        )

    # Save closed trade to trades.json
    log_closed_trade(
        ticket=position.ticket,
        symbol=position.symbol,
        trade_type="BUY" if position.type == mt5.POSITION_TYPE_BUY else "SELL",
        volume=position.volume,
        profit=position.profit
    )

    print(
        f"CLOSED TRADE SAVED | "
        f"Ticket={position.ticket} | "
        f"Profit={position.profit}"
    )

    return {
        "success": True,
        "ticket": ticket,
        "message": "Trade closed successfully"
    }

@router.get("/signals")
def get_signals(limit: int = 10):

    signals_file = (
        Path(__file__).resolve().parents[2]
        / "storage"
        / "signals.json"
    )

    if not signals_file.exists():
        return []

    try:
        with open(signals_file, "r", encoding="utf-8") as f:
            signals = json.load(f)

        return signals[-limit:]

    except Exception:
        return []
