from fastapi import APIRouter
from datetime import datetime, timedelta
import json
from pathlib import Path

import MetaTrader5 as mt5

from services.config_service import load_config
from services.trade_service import calculate_stats
from services.mt5_service import MT5Service

router = APIRouter()


@router.get("/account")
def get_account():
    if not MT5Service.connect():
        return {"error": f"MT5 connection failed: {MT5Service.last_error()}"}

    account = mt5.account_info()
    if account is None:
        return {"error": "No account connected"}

    positions = mt5.positions_get() or []
    stats = calculate_stats()

    trade_activity = [
        {
            "ticket": pos.ticket,
            "symbol": pos.symbol,
            "type": "BUY" if pos.type == mt5.POSITION_TYPE_BUY else "SELL",
            "volume": pos.volume,
            "entry_price": pos.price_open,
            "current_price": pos.price_current,
            "profit": pos.profit,
            "sl": pos.sl,
            "tp": pos.tp,
        }
        for pos in positions
    ]

    closed_trades = []
    history_orders = mt5.history_orders_get(datetime.now() - timedelta(days=7), datetime.now()) or []
    for order in history_orders:
        if getattr(order, "state", None) != mt5.ORDER_STATE_FILLED:
            continue
        closed_trades.append({
            "ticket": str(order.ticket),
            "pair": order.symbol,
            "type": "BUY" if order.type == mt5.ORDER_TYPE_BUY else "SELL",
            "profit": 0,
            "volume": order.volume_initial,
        })

    return {
        "balance": account.balance,
        "equity": account.equity,
        "profit": account.profit,
        "margin": account.margin,
        "free_margin": account.margin_free,
        "open_positions": len(positions),
        "daily_pnl": account.profit,
        "daily_pnl_percent": round((account.profit / account.balance) * 100, 2) if account.balance > 0 else 0,
        "win_rate": stats["win_rate"],
        "drawdown": stats["drawdown"],
        "expectancy": stats["expectancy"],
        "profit_factor": stats["profit_factor"],
        "trade_activity": trade_activity,
        "closed_trades": closed_trades[:10],
    }


@router.get("/market-overview")
def market_overview():
    if not MT5Service.connect():
        return {"pairs": []}

    symbols = ["XAUUSDm", "EURUSDm", "GBPUSDm", "USDJPYm", "EURGBPm"]
    pairs = []

    for symbol in symbols:
        if not MT5Service.ensure_symbol(symbol):
            continue
        tick = mt5.symbol_info_tick(symbol)
        info = mt5.symbol_info(symbol)
        if tick is None or info is None:
            continue
        pairs.append({
            "symbol": symbol,
            "price": round(tick.bid, info.digits),
            "change": 0,
            "trend": "neutral",
            "confidence": 50,
            "atr": 0,
            "spread": round(tick.ask - tick.bid, info.digits),
            "session": "LIVE",
        })

    return {"pairs": pairs}


@router.delete("/trades/clear")
def clear_trades():
    trades_file = Path(__file__).resolve().parents[2] / "storage" / "trades.json"
    trades_file.parent.mkdir(parents=True, exist_ok=True)
    with trades_file.open("w", encoding="utf-8") as f:
        json.dump([], f)
    return {"success": True, "message": "Trade history cleared"}
