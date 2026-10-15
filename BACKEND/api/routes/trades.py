from datetime import datetime, timedelta

import MetaTrader5 as mt5
from fastapi import APIRouter

from services.mt5_service import MT5Service

router = APIRouter()


@router.get("")
def list_trades():
    if not MT5Service.connect():
        print("MT5 CONNECTION ERROR:", MT5Service.last_error())
        return []

    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)
    deals = mt5.history_deals_get(start_date, end_date) or []
    orders = mt5.history_orders_get(start_date, end_date) or []

    # Keep the best historical order per position. History may contain several
    # orders for one position; a later order can have empty SL/TP fields.
    orders_by_position = {}
    for order in orders:
        position_id = int(getattr(order, "position_id", 0) or 0)
        if position_id <= 0:
            continue
        previous = orders_by_position.get(position_id)
        score = int(float(getattr(order, "sl", 0.0) or 0.0) != 0) + int(float(getattr(order, "tp", 0.0) or 0.0) != 0)
        previous_score = (
            int(float(getattr(previous, "sl", 0.0) or 0.0) != 0)
            + int(float(getattr(previous, "tp", 0.0) or 0.0) != 0)
        ) if previous else -1
        if score > previous_score:
            orders_by_position[position_id] = order

    grouped = {}
    for deal in deals:
        position_id = int(getattr(deal, "position_id", 0) or 0)
        if position_id <= 0 or not getattr(deal, "symbol", None):
            continue
        if float(getattr(deal, "volume", 0.0)) <= 0:
            continue
        grouped.setdefault(position_id, []).append(deal)

    trades = []
    for position_id, position_deals in grouped.items():
        position_deals.sort(key=lambda d: d.time)
        exits = [
            d for d in position_deals
            if getattr(d, "entry", None) in (mt5.DEAL_ENTRY_OUT, mt5.DEAL_ENTRY_INOUT)
        ]
        entries = [
            d for d in position_deals
            if getattr(d, "entry", None) in (mt5.DEAL_ENTRY_IN, mt5.DEAL_ENTRY_INOUT)
        ]
        if not exits or not entries:
            continue

        entry_deal = entries[0]
        exit_deal = exits[-1]
        total_profit = sum(sum(float(getattr(d, field, 0.0) or 0.0) for field in ("profit", "commission", "swap", "fee")) for d in exits)
        order = orders_by_position.get(position_id)

        entry_side = "BUY" if entry_deal.type == mt5.DEAL_TYPE_BUY else "SELL"

        trades.append({
            "ticket": int(exit_deal.ticket),
            "position_ticket": position_id,
            "position_id": position_id,
            "symbol": exit_deal.symbol,
            "type": entry_side,
            "volume": float(entry_deal.volume),
            "profit": round(total_profit, 2),
            "entry_price": float(entry_deal.price),
            "exit_price": float(exit_deal.price),
            "sl": float(getattr(order, "sl", 0.0) or 0.0) if order else 0,
            "tp": float(getattr(order, "tp", 0.0) or 0.0) if order else 0,
            "time": int(exit_deal.time),
            "close_time": datetime.fromtimestamp(int(exit_deal.time)).isoformat(),
        })

    trades.sort(key=lambda x: x["time"], reverse=True)
    return trades[:100]
