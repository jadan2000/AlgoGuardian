from datetime import datetime, timedelta
import json
from pathlib import Path

from fastapi import APIRouter
import MetaTrader5 as mt5

from services.config_service import load_config
from services.trade_service import calculate_stats, get_closed_trade_stats
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
    day_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    day_deals = mt5.history_deals_get(day_start, datetime.now()) or []
    daily_pnl = sum(
        float(getattr(deal, field, 0.0) or 0.0)
        for deal in day_deals
        for field in ("profit", "commission", "swap", "fee")
        if getattr(deal, "position_id", 0)
    )

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

    now = datetime.now()
    history_orders = mt5.history_orders_get(now - timedelta(days=7), now) or []
    closed_trades = []
    seen_positions = set()

    for order in history_orders:
        position_id = int(getattr(order, "position_id", 0) or 0)
        if position_id <= 0 or position_id in seen_positions:
            continue
        if getattr(order, "state", None) != mt5.ORDER_STATE_FILLED:
            continue
        seen_positions.add(position_id)
        closed_trades.append({
            "ticket": str(order.ticket),
            "position_id": position_id,
            "pair": order.symbol,
            "type": "BUY" if order.type == mt5.ORDER_TYPE_BUY else "SELL",
            "profit": 0,
            "volume": order.volume_initial,
        })

    return {
        "balance": float(account.balance),
        "equity": float(account.equity),
        "profit": float(account.profit),
        "margin": float(account.margin),
        "free_margin": float(account.margin_free),
        "open_positions": len(positions),
        "daily_pnl": round(daily_pnl, 2),
        "daily_pnl_percent": round((daily_pnl / account.balance) * 100, 2) if account.balance > 0 else 0,
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

    symbols = load_config().get("trading_pairs", ["XAUUSDm"])
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
