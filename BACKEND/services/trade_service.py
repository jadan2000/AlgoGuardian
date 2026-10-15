from collections import defaultdict
from datetime import datetime, timedelta

import MetaTrader5 as mt5

from services.mt5_service import MT5Service

def _empty_stats():
    return {"total_trades": 0, "win_rate": 0, "profit_factor": None, "expectancy": 0, "drawdown": 0}


def _closed_trades_from_mt5(days: int = 30):
    if not MT5Service.connect():
        return []

    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    deals = mt5.history_deals_get(start_date, end_date) or []

    by_position = defaultdict(lambda: {"profit": 0.0, "symbol": "", "volume": 0.0, "close_time": 0})
    for deal in deals:
        position_id = int(getattr(deal, "position_id", 0) or 0)
        if position_id <= 0 or not getattr(deal, "symbol", None):
            continue
        if getattr(deal, "entry", None) not in (mt5.DEAL_ENTRY_OUT, mt5.DEAL_ENTRY_INOUT):
            continue
        row = by_position[position_id]
        row["profit"] += sum(float(getattr(deal, field, 0.0) or 0.0) for field in ("profit", "commission", "swap", "fee"))
        row["symbol"] = deal.symbol
        row["volume"] = max(row["volume"], float(getattr(deal, "volume", 0.0)))
        row["close_time"] = max(row["close_time"], int(getattr(deal, "time", 0) or 0))

    return list(by_position.values())


def get_closed_trade_stats(days: int = 30):
    trades = _closed_trades_from_mt5(days)
    if not trades:
        return _empty_stats()

    profits = [float(t["profit"]) for t in trades]
    wins = [p for p in profits if p > 0]
    losses = [p for p in profits if p < 0]

    total = len(profits)
    gross_profit = sum(wins)
    gross_loss = abs(sum(losses))
    net = sum(profits)

    ordered = sorted(trades, key=lambda t: t["close_time"])
    equity = 100.0
    peak = equity
    max_drawdown = 0.0
    for trade in ordered:
        equity += float(trade["profit"])
        peak = max(peak, equity)
        if peak > 0:
            max_drawdown = max(max_drawdown, (peak - equity) / peak * 100.0)

    return {
        "total_trades": total,
        "win_rate": round(len(wins) / total * 100, 2),
        "profit_factor": round(gross_profit / gross_loss, 2) if gross_loss > 0 else (None if gross_profit > 0 else 0),
        "expectancy": round(net / total, 2),
        "drawdown": round(max_drawdown, 2),
    }


def calculate_stats():
    return get_closed_trade_stats(30)
