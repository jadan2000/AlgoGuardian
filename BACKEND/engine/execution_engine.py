import math
import os

import MetaTrader5 as mt5

from engine.mt5_connector import MT5Connector
from engine.risk_manager import RiskManager
from services.config_service import load_config
from services.mt5_service import MT5Service


class ExecutionEngine:
    def __init__(self):
        self.mt5 = MT5Connector()
        self.risk = RiskManager()

    def _normalize_volume(self, symbol, requested_volume):
        info = mt5.symbol_info(symbol)
        if info is None:
            return None

        min_volume = float(info.volume_min)
        max_volume = float(info.volume_max)
        step = float(info.volume_step)
        if step <= 0:
            step = min_volume or 0.01

        volume = max(min_volume, min(max_volume, float(requested_volume)))
        steps = math.floor((volume - min_volume + 1e-12) / step)
        normalized = min_volume + steps * step
        precision = max(0, len(str(step).split(".")[-1].rstrip("0"))) if "." in str(step) else 0
        return round(normalized, precision)

    def _risk_based_volume(self, symbol, stop_distance, risk_percent, balance):
        info = mt5.symbol_info(symbol)
        if info is None:
            return None

        tick_size = float(getattr(info, "trade_tick_size", 0.0) or 0.0)
        tick_value = float(getattr(info, "trade_tick_value", 0.0) or 0.0)
        if tick_size <= 0 or tick_value <= 0 or stop_distance <= 0:
            return None

        risk_money = balance * (risk_percent / 100.0)
        loss_per_lot = (stop_distance / tick_size) * tick_value
        if loss_per_lot <= 0:
            return None

        return risk_money / loss_per_lot

    def execute(self, signal):
        if not signal:
            return False

        config = load_config()
        valid, reason = self.risk.validate(signal, config)
        if not valid:
            print(f"[RISK] BLOCKED | {reason}")
            return False

        # HARD PAPER-TRADING GUARD:
        # The supervisor sets PAPER_TRADING=1 for experiment runs. In that
        # mode we deliberately never call mt5.order_send(). This keeps the
        # experiment observational/simulated even when MT5 is connected.
        paper_trading = os.getenv("PAPER_TRADING", "0").strip() == "1"
        if paper_trading:
            print(
                f"[PAPER] SIMULATED EXECUTION | {signal.get('signal')} | "
                f"{signal.get('symbol')} | SL={signal.get('stop_loss')} | "
                f"TP={signal.get('take_profit')}"
            )
            return {
                "status": "PAPER_EXECUTED",
                "paper": True,
                "symbol": signal.get("symbol"),
                "signal": signal.get("signal"),
                "stop_loss": float(signal.get("stop_loss", 0.0)),
                "take_profit": float(signal.get("take_profit", 0.0)),
            }

        if not MT5Service.connect():
            print("[MT5] Connection failed")
            return False

        symbol = signal["symbol"]
        if not MT5Service.ensure_symbol(symbol):
            print(f"[MT5] Symbol unavailable: {symbol}")
            return False

        positions = mt5.positions_get(symbol=symbol) or []
        max_positions = int(config.get("max_open_positions", 1))
        if len(positions) >= max_positions:
            print(f"BLOCKED | MAX OPEN POSITIONS ({len(positions)}/{max_positions})")
            return False

        tick = mt5.symbol_info_tick(symbol)
        info = mt5.symbol_info(symbol)
        account = mt5.account_info()
        if tick is None or info is None or account is None:
            return False

        side = signal.get("signal")
        if side == "BUY":
            order_type = mt5.ORDER_TYPE_BUY
            price = tick.ask
            sl = price - abs(float(signal["stop_loss"]))
            tp = price + abs(float(signal["take_profit"]))
        elif side == "SELL":
            order_type = mt5.ORDER_TYPE_SELL
            price = tick.bid
            sl = price + abs(float(signal["stop_loss"]))
            tp = price - abs(float(signal["take_profit"]))
        else:
            print(f"[ORDER] Invalid signal side: {side}")
            return False

        min_stop = float(getattr(info, "trade_stops_level", 0)) * float(info.point)
        if min_stop > 0:
            if abs(price - sl) < min_stop:
                sl = price - min_stop if side == "BUY" else price + min_stop
            if abs(tp - price) < min_stop:
                tp = price + min_stop if side == "BUY" else price - min_stop

        risk_percent = float(config.get("risk_per_trade", 0))
        requested_volume = None
        if risk_percent > 0:
            requested_volume = self._risk_based_volume(
                symbol,
                abs(price - sl),
                risk_percent,
                float(account.balance),
            )

        if requested_volume is None:
            requested_volume = float(config.get("lot_size", info.volume_min))

        volume = self._normalize_volume(symbol, requested_volume)
        if volume is None or volume <= 0:
            print("[ORDER] Invalid normalized volume")
            return False

        digits = int(info.digits)
        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": symbol,
            "volume": volume,
            "type": order_type,
            "price": price,
            "sl": round(sl, digits),
            "tp": round(tp, digits),
            "deviation": int(config.get("deviation", 20)),
            "magic": int(config.get("magic", 20250620)),
            "comment": str(config.get("order_comment", "AlgoGuardian")),
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": getattr(info, "filling_mode", mt5.ORDER_FILLING_FOK),
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

        print(f"ORDER OPENED | {side} | Ticket={result.order} | Volume={volume}")
        return True
