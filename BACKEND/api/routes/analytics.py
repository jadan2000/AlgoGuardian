from collections import defaultdict
from datetime import datetime, timedelta

import MetaTrader5 as mt5
from fastapi import APIRouter

from services.mt5_service import MT5Service
from services.trade_service import get_closed_trade_stats

router = APIRouter()


def _closed_positions(days=365):
    if not MT5Service.connect():
        return []
    end = datetime.now()
    start = end - timedelta(days=days)
    deals = mt5.history_deals_get(start, end) or []
    grouped = defaultdict(lambda: {
        "profit": 0.0, "symbol": "", "volume": 0.0,
        "close_time": 0, "entry_price": None, "exit_price": None,
        "side": "UNKNOWN", "sl": 0.0, "tp": 0.0,
    })
    for deal in deals:
        pid = int(getattr(deal, "position_id", 0) or 0)
        if pid <= 0 or not getattr(deal, "symbol", None):
            continue
        row = grouped[pid]
        row["symbol"] = deal.symbol
        entry = getattr(deal, "entry", None)
        if entry in (mt5.DEAL_ENTRY_OUT, mt5.DEAL_ENTRY_INOUT):
            row["profit"] += sum(float(getattr(deal, field, 0.0) or 0.0) for field in ("profit", "commission", "swap", "fee"))
            row["close_time"] = max(row["close_time"], int(getattr(deal, "time", 0) or 0))
            row["exit_price"] = float(getattr(deal, "price", 0.0) or 0.0)
            row["volume"] = max(row["volume"], float(getattr(deal, "volume", 0.0) or 0.0))
        elif entry == mt5.DEAL_ENTRY_IN:
            row["entry_price"] = float(getattr(deal, "price", 0.0) or 0.0)
            row["side"] = "BUY" if getattr(deal, "type", None) == mt5.DEAL_TYPE_BUY else "SELL"
            row["volume"] = max(row["volume"], float(getattr(deal, "volume", 0.0) or 0.0))
    return [
        {"position_id": pid, **row, "close_datetime": datetime.fromtimestamp(row["close_time"]) if row["close_time"] else None}
        for pid, row in grouped.items()
        if row["close_time"] and row["exit_price"] is not None
    ]


@router.get("/overview")
def get_analytics_overview():
    trades = _closed_positions(365)
    profits = [float(t["profit"]) for t in trades]
    wins = [p for p in profits if p > 0]
    losses = [p for p in profits if p < 0]
    total = len(profits)
    gross_profit = sum(wins)
    gross_loss = abs(sum(losses))
    net = sum(profits)
    account = mt5.account_info() if MT5Service.connect() else None

    ordered = sorted(trades, key=lambda t: t["close_time"])
    baseline = float(getattr(account, "balance", 0.0) or 0.0) - net if account else 0.0
    equity = baseline
    peak = equity
    max_drawdown = 0.0
    equity_curve = [{"date": "Start", "equity": round(equity, 2)}]
    monthly = defaultdict(float)
    strategy = defaultdict(lambda: {"trades": 0, "wins": 0, "pnl": 0.0})
    hourly = defaultdict(lambda: {"trades": 0, "pnl": 0.0})
    daily = defaultdict(float)
    for trade in ordered:
        profit = float(trade["profit"])
        equity += profit
        peak = max(peak, equity)
        if peak > 0:
            max_drawdown = max(max_drawdown, (peak - equity) / peak * 100)
        dt = trade["close_datetime"]
        equity_curve.append({"date": dt.strftime("%m-%d"), "equity": round(equity, 2)})
        monthly[dt.strftime("%b %Y")] += profit
        strategy[trade["symbol"]]["trades"] += 1
        strategy[trade["symbol"]]["wins"] += int(profit > 0)
        strategy[trade["symbol"]]["pnl"] += profit
        hourly[dt.strftime("%a") + "|" + str(dt.hour)]["trades"] += 1
        hourly[dt.strftime("%a") + "|" + str(dt.hour)]["pnl"] += profit
        daily[dt.strftime("%Y-%m-%d")] += profit

    today = datetime.now().date()
    daily_pnl = sum(float(t["profit"]) for t in trades if t["close_datetime"] and t["close_datetime"].date() == today)
    monthly_returns = []
    for month, pnl in monthly.items():
        monthly_returns.append({"month": month, "return_pct": round(pnl / baseline * 100, 2) if baseline > 0 else 0, "pnl": round(pnl, 2)})
    hourly_heatmap = [
        {"day": key.split("|")[0][:3], "hour": int(key.split("|")[1]), "trades": v["trades"], "pnl": round(v["pnl"], 2)}
        for key, v in hourly.items()
    ]
    strategy_breakdown = [
        {"name": symbol, "trades": v["trades"], "win_rate": round(v["wins"] / v["trades"] * 100, 1) if v["trades"] else 0,
         "avg_rr": 0, "pnl": round(v["pnl"], 2)}
        for symbol, v in strategy.items()
    ]
    stats = get_closed_trade_stats(365)
    return {
        "total_trades": total,
        "winning_trades": len(wins),
        "losing_trades": len(losses),
        "net_profit": round(net, 2),
        "gross_profit": round(gross_profit, 2),
        "gross_loss": round(gross_loss, 2),
        "daily_pnl": round(daily_pnl, 2),
        "win_rate": round(len(wins) / total * 100, 2) if total else 0,
        "profit_factor": round(gross_profit / gross_loss, 2) if gross_loss > 0 else (None if gross_profit > 0 else 0),
        "expectancy": round(net / total, 2) if total else 0,
        "sharpe_ratio": 0,
        "sortino_ratio": 0,
        "avg_rr": 0,
        "max_drawdown": round(max_drawdown, 2),
        "recovery_factor": round(net / max_drawdown, 2) if max_drawdown > 0 else 0,
        "annual_return": round(net / baseline * 100, 2) if baseline > 0 else 0,
        "equity_curve": equity_curve,
        "monthly_returns": monthly_returns,
        "strategy_breakdown": strategy_breakdown,
        "hourly_heatmap": hourly_heatmap,
        "recent_trades": [
            {"ticket": t["position_id"], "symbol": t["symbol"], "type": t["side"], "profit": round(t["profit"], 2),
             "close_time": t["close_datetime"].isoformat(), "volume": t["volume"]}
            for t in sorted(trades, key=lambda t: t["close_time"], reverse=True)[:50]
        ],
    }


@router.get("/strategy-stats")
def get_strategy_stats():
    return get_analytics_overview()
