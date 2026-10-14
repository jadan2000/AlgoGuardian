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
        self.last_error = None
        self.last_fix = None

    def _reject(self, reason, fix=None):
        self.last_error = str(reason)
        self.last_fix = fix or self._fix_for_reason(self.last_error)
        print(f"[DIAGNOSTIC] WHAT HAPPENED: {self.last_error}")
        print(f"[DIAGNOSTIC] HOW TO FIX: {self.last_fix}")
        return False

    @staticmethod
    def _fix_for_reason(reason):
        text = str(reason).upper()
        if "BELOW BROKER MINIMUM" in text or "BELOW BROKER MIN" in text:
            return "Review Stop Loss/Take Profit in Settings against the broker's minimum distance; do not widen stops without checking the resulting risk."
        if "VOLUME" in text or "LOT" in text or "RISK PERCENTAGE" in text or "RISK-SIZED" in text:
            return "Check Risk Per Trade, Lot Size Cap, and the broker's minimum lot/volume step. If the minimum lot exceeds your risk budget, use a smaller-risk symbol or do not take this trade; the bot will not raise volume automatically."
        if "MARGIN" in text or "INSUFFICIENT FREE MARGIN" in text:
            return "Check free margin and the broker's margin requirement. Do not increase leverage or deposit funds solely to force this trade; reduce exposure only if it remains within your risk plan."
        if "MT5" in text or "CONNECTION" in text or "ACCOUNT UNAVAILABLE" in text:
            return "Open MetaTrader 5, sign in to the configured account/server, confirm the terminal is connected and Algo Trading is enabled, then restart the backend."
        if "MAX OPEN POSITIONS" in text:
            return "Close or wait for an existing position to finish, or review Max Open Positions in Settings if your strategy and risk plan allow more concurrent positions."
        if "MAX DAILY LOSS" in text or "MAX DRAWDOWN" in text:
            return "Trading is blocked by a protective risk limit. Do not disable it to force trades; review account equity and wait until the limit resets or your risk plan permits resuming."
        if "MAX TRADES PER DAY" in text:
            return "The configured daily trade limit has been reached. Wait for the next trading day or review the limit in Settings if intended."
        if "SYMBOL" in text or "TICK" in text or "PRICE DATA" in text:
            return "Confirm the exact broker symbol is visible in Market Watch and has current bid/ask prices. Check the terminal connection and symbol trading permissions."
        if "STOP LOSS" in text or "TAKE PROFIT" in text or "SL/TP" in text:
            return "Check positive Stop Loss and Take Profit distances in Settings and compare them with the broker's minimum stop distance."
        if "FILL" in text or "RETCODE" in text or "ORDER SEND" in text or "BROKER" in text:
            return "Read the MT5 retcode and broker comment in the order log. Check symbol trade permissions, market hours, filling mode, price, and stops; correct the specific rejection reason before retrying."
        if "HISTORY" in text or "POSITION DATA" in text:
            return "Reconnect MT5 and verify account history/position data is available. The bot blocks trading when it cannot safely verify account state."
        return "Review the exact reason and MT5 error details above, correct the related setting or terminal/account issue, then let the bot retry. Do not bypass risk protections."


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
        self.last_error = None
        self.last_fix = None
        if not signal:
            return self._reject("No signal was supplied to the execution engine.")

        config = load_config()
        valid, reason = self.risk.validate(signal, config)
        if not valid:
            print(f"[RISK] BLOCKED | {reason}")
            return self._reject(f"Risk manager blocked the order: {reason}")

        if not MT5Service.connect():
            print("[MT5] Connection failed")
            return self._reject("MT5 connection failed.")

        account = mt5.account_info()
        if account is None:
            print("[MT5] Account unavailable")
            return self._reject("MT5 account information is unavailable.")

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
                return self._reject("Paper-trading safety check failed: the connected MT5 account is not confirmed as DEMO.")

        symbol = signal["symbol"]
        if not MT5Service.ensure_symbol(symbol):
            print(f"[MT5] Symbol unavailable: {symbol}")
            return self._reject(f"Symbol unavailable in MT5: {symbol}.")

        positions = mt5.positions_get(symbol=symbol)
        if positions is None:
            return self._reject(f"Cannot verify existing positions: {mt5.last_error()}")
        max_positions = int(config["max_open_positions"])
        if len(positions) >= max_positions:
            return self._reject(f"MAX OPEN POSITIONS: {len(positions)}/{max_positions} positions already open.")

        tick = mt5.symbol_info_tick(symbol)
        info = mt5.symbol_info(symbol)
        if tick is None or info is None:
            return self._reject(f"Current price or symbol specification is unavailable for {symbol}: {mt5.last_error()}")

        side = signal.get("signal")
        stop_distance = float(config["stop_loss"])
        take_distance = float(config["take_profit"])
        if stop_distance <= 0 or take_distance <= 0:
            return self._reject("Stop Loss and Take Profit must be positive Settings values.")

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
            return self._reject(f"Invalid signal direction: {side!r}; expected BUY or SELL.")

        min_stop = float(getattr(info, "trade_stops_level", 0)) * float(info.point)
        if min_stop > 0 and (stop_distance < min_stop or take_distance < min_stop):
            return self._reject(
                f"Configured Stop Loss/Take Profit is below broker minimum: SL={stop_distance}, TP={take_distance}, minimum={min_stop}."
            )

        risk_percent = float(config["risk_per_trade"])
        if risk_percent > 0:
            requested_volume = self._risk_based_volume(
                symbol,
                stop_distance,
                risk_percent,
                float(account.balance),
            )
            if requested_volume is None:
                return self._reject("Cannot calculate risk-sized volume because the broker tick size/value or stop distance is unavailable.")
            configured_lot_cap = float(config["lot_size"])
            if configured_lot_cap <= 0:
                return self._reject("Lot Size Cap must be greater than zero when risk-based sizing is enabled.")
            requested_volume = min(requested_volume, configured_lot_cap)
        else:
            requested_volume = float(config["lot_size"])

        min_volume = float(getattr(info, "volume_min", 0.0) or 0.0)
        max_volume = float(getattr(info, "volume_max", 0.0) or 0.0)
        if requested_volume < min_volume:
            min_lot_risk = None
            tick_size = float(getattr(info, "trade_tick_size", 0.0) or 0.0)
            tick_value = float(getattr(info, "trade_tick_value", 0.0) or 0.0)
            if tick_size > 0 and tick_value > 0:
                min_lot_risk = (stop_distance / tick_size) * tick_value * min_volume
            risk_budget = float(account.balance) * risk_percent / 100.0 if risk_percent > 0 else None
            volume_message = (
                "[ORDER] BLOCKED | Calculated volume is below broker minimum; "
                "refusing to increase it automatically"
                f" | requested_volume={requested_volume:.8f}"
                f" | broker_min_volume={min_volume}"
                f" | configured_lot_cap={config['lot_size']}"
            )
            if risk_budget is not None:
                volume_message += f" | risk_budget={risk_budget:.2f}"
            if min_lot_risk is not None:
                volume_message += f" | minimum_lot_estimated_stop_loss_risk={min_lot_risk:.2f} account currency"
            return self._reject(volume_message)
        if requested_volume > max_volume:
            return self._reject(f"Requested volume {requested_volume:.8f} exceeds broker maximum {max_volume}.")

        volume = self._normalize_volume(symbol, requested_volume)
        if volume is None or volume <= 0:
            return self._reject(
                f"Volume could not be normalized to broker step: requested={requested_volume:.8f}, min={min_volume}, max={max_volume}, step={getattr(info, 'volume_step', None)}."
            )

        # Check required margin before submitting. A $10 account may not
        # support the broker's minimum XAUUSD volume; fail clearly rather than
        # repeatedly sending orders the broker must reject.
        required_margin = mt5.order_calc_margin(order_type, symbol, volume, price)
        if required_margin is None:
            return self._reject(f"MT5 could not calculate required margin for {symbol}: {mt5.last_error()}")
        free_margin = float(getattr(account, "margin_free", 0.0) or 0.0)
        if float(required_margin) > free_margin:
            return self._reject(
                f"INSUFFICIENT FREE MARGIN: required={float(required_margin):.2f}, free={free_margin:.2f}, volume={volume} {symbol}."
            )

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
                return self._reject(f"MT5 order_send returned no result: {mt5.last_error()}")

            if result.retcode == mt5.TRADE_RETCODE_DONE:
                break

            unsupported_filling = getattr(mt5, "TRADE_RETCODE_INVALID_FILL", 10030)
            if result.retcode == unsupported_filling and index + 1 < len(filling_candidates):
                print(
                    f"[ORDER] Filling mode {filling_mode} unsupported for {symbol}; "
                    f"retrying with {filling_candidates[index + 1]}"
                )
                continue

            return self._reject(
                f"MT5 rejected the order: retcode={result.retcode}, broker_comment={result.comment!r}, last_error={mt5.last_error()}, symbol={symbol}, volume={volume}, price={price}, SL={request['sl']}, TP={request['tp']}."
            )

        if result is None or result.retcode != mt5.TRADE_RETCODE_DONE:
            return self._reject(f"No supported MT5 filling mode succeeded for {symbol}.")

        print(f"ORDER OPENED | {side} | Ticket={result.order} | Volume={volume}")
        return True
