from fastapi import APIRouter
import MetaTrader5 as mt5
from datetime import datetime, timedelta

from config import MT5_LOGIN, MT5_PASSWORD, MT5_SERVER, MT5_PATH

router = APIRouter()


@router.get("/")
def list_trades():

    if not mt5.initialize(path=MT5_PATH):
        print("MT5 INIT ERROR:", mt5.last_error())
        return []

    if not mt5.login(
        MT5_LOGIN,
        password=MT5_PASSWORD,
        server=MT5_SERVER
    ):
        print("MT5 LOGIN ERROR:", mt5.last_error())
        return []

    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)

    deals = mt5.history_deals_get(
        start_date,
        end_date
    )

    orders = mt5.history_orders_get(
        start_date,
        end_date
    )

    if deals is None:
        print("MT5 HISTORY ERROR:", mt5.last_error())
        return []

    # Map orders by position_id for SL/TP lookup
    order_map = {}

    if orders:
        for order in orders:
            if order.position_id not in order_map:
                order_map[order.position_id] = order

    # Group deals by position
    positions = {}

    for deal in deals:

        if not deal.symbol:
            continue

        if deal.volume <= 0:
            continue

        position_id = deal.position_id

        if position_id not in positions:
            positions[position_id] = []

        positions[position_id].append(deal)

    trades = []

    for position_id, position_deals in positions.items():

        position_deals.sort(key=lambda d: d.time)

        entry_deal = position_deals[0]
        exit_deal = position_deals[-1]

        total_profit = sum(
            d.profit for d in position_deals
        )

        # Skip open positions / deposits etc.
        if round(total_profit, 2) == 0:
            continue

        order = order_map.get(position_id)

        trades.append({
            "ticket": exit_deal.ticket,
            "symbol": exit_deal.symbol,

            "type": (
                "SELL"
                if entry_deal.type == mt5.DEAL_TYPE_BUY
                else "BUY"
            ),

            "volume": entry_deal.volume,

            "profit": round(total_profit, 2),

            "entry_price": entry_deal.price,

            "exit_price": exit_deal.price,

            "sl": (
                order.sl
                if order else 0
            ),

            "tp": (
                order.tp
                if order else 0
            ),

            "time": exit_deal.time
        })

    trades.sort(
        key=lambda x: x["time"],
        reverse=True
    )

    return trades[:100]