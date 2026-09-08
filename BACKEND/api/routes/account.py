from fastapi import APIRouter
import MetaTrader5 as mt5
from datetime import datetime, timedelta
from pathlib import Path
import json

from config import MT5_LOGIN, MT5_PASSWORD, MT5_SERVER, MT5_PATH
from services.trade_service import calculate_stats

router = APIRouter()


@router.get("/account")
def get_account():

    if not mt5.initialize(path=MT5_PATH):
        return {"error": f"MT5 initialize failed: {mt5.last_error()}"}

    authorized = mt5.login(
        MT5_LOGIN,
        password=MT5_PASSWORD,
        server=MT5_SERVER
    )

    if not authorized:
        mt5.shutdown()
        return {"error": f"MT5 login failed: {mt5.last_error()}"}

    account = mt5.account_info()

    if account is None:
        mt5.shutdown()
        return {"error": "No account connected"}

    positions = mt5.positions_get()

    stats = calculate_stats()

    trade_activity = []
    closed_trades = []

    # Active Trades
    if positions:
        for pos in positions:
            trade_activity.append({
                "ticket": pos.ticket,
                "symbol": pos.symbol,
                "type": "BUY" if pos.type == 0 else "SELL",
                "volume": pos.volume,
                "entry_price": pos.price_open,
                "current_price": pos.price_current,
                "profit": pos.profit,
                "sl": pos.sl,
                "tp": pos.tp,
            })

    # History Orders
    history_orders = mt5.history_orders_get(
        datetime.now() - timedelta(days=7),
        datetime.now()
    )

    if history_orders:
        for order in history_orders:

            if (
                hasattr(order, "state")
                and order.state == mt5.ORDER_STATE_FILLED
            ):
                closed_trades.append({
                    "ticket": str(order.ticket),
                    "pair": order.symbol,
                    "type": "BUY" if order.type == 0 else "SELL",
                    "profit": 0,
                    "volume": order.volume_initial,
                })

    result = {
        "balance": account.balance,
        "equity": account.equity,
        "profit": account.profit,
        "margin": account.margin,
        "free_margin": account.margin_free,
        "open_positions": len(positions) if positions else 0,
        "daily_pnl": account.profit,
        "daily_pnl_percent": round(
            (account.profit / account.balance) * 100, 2
        ) if account.balance > 0 else 0,
        "win_rate": stats["win_rate"],
        "drawdown": stats["drawdown"],
        "expectancy": stats["expectancy"],
        "profit_factor": stats["profit_factor"],
        "trade_activity": trade_activity,
        "closed_trades": closed_trades[:10]
    }

    mt5.shutdown()

    return result


@router.get("/market-overview")
def market_overview():

    if not mt5.initialize(path=MT5_PATH):
        return {"pairs": []}

    authorized = mt5.login(
        MT5_LOGIN,
        password=MT5_PASSWORD,
        server=MT5_SERVER
    )

    if not authorized:
        mt5.shutdown()
        return {"pairs": []}

    symbols = [
        "XAUUSDm",
        "EURUSDm",
        "GBPUSDm",
        "USDJPYm",
        "EURGBPm"
    ]

    pairs = []

    for symbol in symbols:

        mt5.symbol_select(symbol, True)

        tick = mt5.symbol_info_tick(symbol)

        if tick is None:
            continue

        pairs.append({
            "symbol": symbol,
            "price": round(tick.bid, 5),
            "change": 0,
            "trend": "neutral",
            "confidence": 50,
            "atr": 0,
            "spread": round(tick.ask - tick.bid, 3),
            "session": "LIVE"
        })

    mt5.shutdown()

    return {
        "pairs": pairs
    }


@router.delete("/trades/clear")
def clear_trades():

    trades_file = (
        Path(__file__).resolve().parents[2]
        / "storage"
        / "trades.json"
    )

    trades_file.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    with trades_file.open(
        "w",
        encoding="utf-8"
    ) as f:
        json.dump([], f)

    return {
        "success": True,
        "message": "Trade history cleared"
    }