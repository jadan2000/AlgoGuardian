import MetaTrader5 as mt5

from engine.mt5_connector import MT5Connector
from services.config_service import load_config


class ExecutionEngine:

    def __init__(self):

        self.mt5 = MT5Connector()

    def execute(self, signal):

        if signal is None:
            return False

        config = load_config()

        symbol = signal["symbol"]

        if not self.mt5.connect():
            return False

        # MAX OPEN POSITIONS CHECK
        positions = mt5.positions_get(symbol=symbol)

        if positions is None:
            positions = []

        max_positions = config.get("max_open_positions", 1)

        if len(positions) >= max_positions:

            print(
                f"BLOCKED | MAX OPEN POSITIONS "
                f"({len(positions)}/{max_positions})"
            )

            return False

        tick = mt5.symbol_info_tick(symbol)

        if tick is None:
            return False

        if signal["signal"] == "BUY":

            order_type = mt5.ORDER_TYPE_BUY

            price = tick.ask

            sl = price - signal["stop_loss"]

            tp = price + signal["take_profit"]

        else:

            order_type = mt5.ORDER_TYPE_SELL

            price = tick.bid

            sl = price + signal["stop_loss"]

            tp = price - signal["take_profit"]

        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": symbol,
            "volume": 0.01,
            "type": order_type,
            "price": price,
            "sl": round(sl, 2),
            "tp": round(tp, 2),
            "deviation": 20,
            "magic": 20250620,
            "comment": "AlgoGuardian",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_FOK,
        }

        result = mt5.order_send(request)

        if result is None:
            print("ORDER FAILED: result is None")
            print("MT5 ERROR:", mt5.last_error())
            return False

        if result.retcode != mt5.TRADE_RETCODE_DONE:

            print("ORDER FAILED")
            print("RETCODE:", result.retcode)
            print("COMMENT:", result.comment)
            print("MT5 ERROR:", mt5.last_error())
            print("REQUEST:", request)
            return False

        print(
            f"ORDER OPENED | "
            f"{signal['signal']} | "
            f"Ticket={result.order}"
        )

        return True