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

        requested_volume = float(requested_volume)
        # Never silently raise a risk-sized request to the broker minimum:
        # that could exceed the risk configured in Settings.
        if requested_volume < min_volume or requested_volume > max_volume:
            return None
        volume = min(max_volume, requested_volume)
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

        if not MT5Service.connect():
            print("[MT5] Connection failed")
            return False

        account = mt5.account_info()
        if account is None:
            print("[MT5] Account unavailable")
            return False

        # Paper experiments use real MT5 orders on a DEMO account so we get
        # genuine fills, spread/slippage and realized P&L without risking
        # live capital. Refuse to send an order from the experiment runner
        # unless MT5 explicitly reports a demo account.
        paper_trading = os.getenv("PAPER_TRADING", "0").strip() == "1"
        if paper_trading:
            demo_trade_mode = getattr(mt5, "ACCOUNT_TRADE_MODE_DEMO", None)
            account_trade_mode = getattr(account, "trade_mode", None)
            if demo_trade_mode is None or account_trade_mode != demo_trade_mode:
                print("[PAPER] BLOCKED | MT5 account is not confirmed as DEMO")
                return False

        symbol = signal["symbol"]
        if not MT5Service.ensure_symbol(symbol):
            print(f"[MT5] Symbol unavailable: {symbol}")
            return False

        positions = mt5.positions_get(symbol=symbol)
        if positions is None:
            print(f"[ORDER] BLOCKED | Cannot verify existing positions: {mt5.last_error()}")
            return False
        max_positions = int(config["max_open_positions"])
        if len(positions) >= max_positions:
            print(f"BLOCKED | MAX OPEN POSITIONS ({len(positions)}/{max_positions})")
            return False

        tick = mt5.symbol_info_tick(symbol)
        info = mt5.symbol_info(symbol)
        if tick is None or info is None:
            return False

        side = signal.get("signal")
        stop_distance = float(config["stop_loss"])
        take_distance = float(config["take_profit"])
        if stop_distance <= 0 or take_distance <= 0:
            print("[ORDER] BLOCKED | Stop Loss and Take Profit must be positive Settings values")
            return False

        if side == "BUY":
            order_type = mt5.ORDER_TYPE_BUY
            price = tick.ask
            sl = price - stop_distance
            tp = price + take_distance
        elif side == "SELL":
            order_type = mt5.ORDER_TYPE_SELL
            price = tick.bid
            sl = price + stop_distance
            tp = price - take_distance
        else:
            print(f"[ORDER] Invalid signal side: {side}")
            return False

        min_stop = float(getattr(info, "trade_stops_level", 0)) * float(info.point)
        if min_stop > 0 and (stop_distance < min_stop or take_distance < min_stop):
            print(
                "[ORDER] BLOCKED | Configured Stop Loss/Take Profit is below broker minimum "
                f"| configured_sl={stop_distance} configured_tp={take_distance} "
                f"| broker_minimum={min_stop}"
            )
            return False

        risk_percent = float(config["risk_per_trade"])
        if risk_percent > 0:
            requested_volume = self._risk_based_volume(
                symbol,
                stop_distance,
                risk_percent,
                float(account.balance),
            )
            if requested_volume is None:
                print("[ORDER] BLOCKED | Cannot calculate volume from configured risk percentage")
                return False
            configured_lot_cap = float(config["lot_size"])
            if configured_lot_cap <= 0:
                print("[ORDER] BLOCKED | lot_size must be greater than zero when risk sizing is enabled")
                return False
            requested_volume = min(requested_volume, configured_lot_cap)
        else:
            requested_volume = float(config["lot_size"])

        volume = self._normalize_volume(symbol, requested_volume)
        if volume is None or volume <= 0:
            print("[ORDER] Invalid normalized volume")
            return False

        # Check required margin before submitting. A $10 account may not
        # support the broker's minimum XAUUSD volume; fail clearly rather than
        # repeatedly sending orders the broker must reject.
        required_margin = mt5.order_calc_margin(order_type, symbol, volume, price)
        if required_margin is None:
            print(f"[ORDER] Cannot calculate margin for {symbol}: {mt5.last_error()}")
            return False
        free_margin = float(getattr(account, "margin_free", 0.0) or 0.0)
        if float(required_margin) > free_margin:
            print(
                "[ORDER] BLOCKED | INSUFFICIENT FREE MARGIN "
                f"| required={float(required_margin):.2f} "
                f"| free={free_margin:.2f} "
                f"| volume={volume} {symbol}"
            )
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
            "deviation": int(config["deviation"]),
            "magic": int(config["magic"]),
            "comment": str(config["order_comment"]),
            "type_time": mt5.ORDER_TIME_GTC,
        }

        # SYMBOL_FILLING_* values are capability flags, not ORDER_FILLING_*
        # enum values. Passing info.filling_mode directly can send 3 (BOC),
        # which is unsupported for market orders on many MT5 symbols.
        filling_flags = int(getattr(info, "filling_mode", 0) or 0)
        filling_candidates = []
        if filling_flags & int(getattr(mt5, "SYMBOL_FILLING_IOC", 2)):
            filling_candidates.append(mt5.ORDER_FILLING_IOC)
        if filling_flags & int(getattr(mt5, "SYMBOL_FILLING_FOK", 1)):
            filling_candidates.append(mt5.ORDER_FILLING_FOK)

        # RETURN is not permitted for Market Execution; for other execution
        # modes it is an available fallback.
        execution_mode = getattr(info, "trade_exemode", None)
        market_execution = getattr(mt5, "SYMBOL_TRADE_EXECUTION_MARKET", 2)
        if execution_mode != market_execution:
            filling_candidates.append(mt5.ORDER_FILLING_RETURN)

        # Keep order deterministic and avoid duplicate enum values.
        filling_candidates = list(dict.fromkeys(filling_candidates))
        if not filling_candidates:
            # Safe default for symbols that advertise no explicit flags.
            filling_candidates = [mt5.ORDER_FILLING_FOK, mt5.ORDER_FILLING_IOC]

        result = None
        for index, filling_mode in enumerate(filling_candidates):
            request["type_filling"] = filling_mode
            result = mt5.order_send(request)

            if result is None:
                print("ORDER FAILED: result is None")
                print("MT5 ERROR:", mt5.last_error())
                return False

            if result.retcode == mt5.TRADE_RETCODE_DONE:
                break

            unsupported_filling = getattr(mt5, "TRADE_RETCODE_INVALID_FILL", 10030)
            if result.retcode == unsupported_filling and index + 1 < len(filling_candidates):
                print(
                    f"[ORDER] Filling mode {filling_mode} unsupported for {symbol}; "
                    f"retrying with {filling_candidates[index + 1]}"
                )
                continue

            print("ORDER FAILED")
            print("RETCODE:", result.retcode)
            print("COMMENT:", result.comment)
            print("MT5 ERROR:", mt5.last_error())
            print("REQUEST:", request)
            return False

        if result is None or result.retcode != mt5.TRADE_RETCODE_DONE:
            print("ORDER FAILED: no supported filling mode succeeded")
            return False

        print(f"ORDER OPENED | {side} | Ticket={result.order} | Volume={volume}")
        return True
