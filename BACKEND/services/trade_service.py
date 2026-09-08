import json
from pathlib import Path
from datetime import datetime, timedelta

import MetaTrader5 as mt5

from config import (
    MT5_LOGIN,
    MT5_PASSWORD,
    MT5_SERVER,
    MT5_PATH,
)

STORAGE_PATH = Path(__file__).resolve().parents[1] / "storage" / "trades.json"


def get_trades() -> list:
    STORAGE_PATH.parent.mkdir(parents=True, exist_ok=True)

    if not STORAGE_PATH.exists():
        return []

    try:
        with STORAGE_PATH.open("r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def save_trade(trade_data: dict) -> dict:
    STORAGE_PATH.parent.mkdir(parents=True, exist_ok=True)

    trades = get_trades()
    trades.append(trade_data)

    with STORAGE_PATH.open("w", encoding="utf-8") as f:
        json.dump(trades, f, indent=2)

    return trade_data


def log_closed_trade(
    ticket: int,
    symbol: str,
    trade_type: str,
    volume: float,
    profit: float,
):
    trade = {
        "ticket": ticket,
        "symbol": symbol,
        "type": trade_type,
        "volume": volume,
        "profit": profit,
        "close_time": datetime.now().isoformat(),
    }

    return save_trade(trade)


def calculate_stats():

    if not mt5.initialize(path=MT5_PATH):
        return {
            "total_trades": 0,
            "win_rate": 0,
            "profit_factor": 0,
            "expectancy": 0,
            "drawdown": 0,
        }

    if not mt5.login(
        MT5_LOGIN,
        password=MT5_PASSWORD,
        server=MT5_SERVER
    ):
        return {
            "total_trades": 0,
            "win_rate": 0,
            "profit_factor": 0,
            "expectancy": 0,
            "drawdown": 0,
        }

    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)

    deals = mt5.history_deals_get(
        start_date,
        end_date
    )

    if deals is None:
        return {
            "total_trades": 0,
            "win_rate": 0,
            "profit_factor": 0,
            "expectancy": 0,
            "drawdown": 0,
        }

    trades = []

    for deal in deals:

        if not deal.symbol:
            continue

        if deal.volume <= 0:
            continue

        # Ignore opening records that cause double-counting
        if round(float(deal.profit), 2) == 0:
            continue

        trades.append({
            "profit": float(deal.profit)
        })

    if not trades:
        return {
            "total_trades": 0,
            "win_rate": 0,
            "profit_factor": 0,
            "expectancy": 0,
            "drawdown": 0,
        }

    wins = [t for t in trades if t["profit"] > 0]
    losses = [t for t in trades if t["profit"] < 0]

    total_trades = len(trades)

    win_rate = round(
        (len(wins) / total_trades) * 100,
        2
    )

    gross_profit = sum(
        t["profit"] for t in wins
    )

    gross_loss = abs(
        sum(t["profit"] for t in losses)
    )

    profit_factor = (
        round(gross_profit / gross_loss, 2)
        if gross_loss > 0
        else 0
    )

    net_profit = sum(
        t["profit"] for t in trades
    )

    expectancy = round(
        net_profit / total_trades,
        2
    )

    balance = 100.0
    peak = balance
    max_drawdown = 0

    for trade in trades:

        balance += trade["profit"]

        if balance > peak:
            peak = balance

        drawdown = (
            ((peak - balance) / peak) * 100
            if peak > 0
            else 0
        )

        if drawdown > max_drawdown:
            max_drawdown = drawdown

    return {
        "total_trades": total_trades,
        "win_rate": win_rate,
        "profit_factor": profit_factor,
        "expectancy": expectancy,
        "drawdown": round(max_drawdown, 2),
    }