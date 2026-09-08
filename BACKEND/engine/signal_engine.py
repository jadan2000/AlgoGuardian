import pandas as pd
import ta
import time
import MetaTrader5 as mt5

from engine.mt5_connector import MT5Connector
from engine.session_manager import SessionManager
from services.config_service import load_config


class SignalEngine:

    def log(self, title, value=None):
        if value is None:
            print(f"[SIGNAL] {title}")
        else:
            print(f"[SIGNAL] {title}: {value}")

    def __init__(self):
        self.mt5 = MT5Connector()
        self.session = SessionManager()

    def generate_signal(self):

        config = load_config()

        self.log("STARTING ANALYSIS")

        symbols = config.get(
            "trading_pairs",
            ["XAUUSD"]
        )

        if not self.mt5.connect():
            self.log("BLOCKED", "MT5 CONNECTION FAILED")
            return None

        if not self.session.can_trade(
            config.get("allow_london", True),
            config.get("allow_ny", True),
            config.get("demo_mode", False)
        ):
            self.log("BLOCKED", "SESSION FILTER")
            return None

        cooldown_minutes = config.get("cooldown_minutes", 0)

        if cooldown_minutes > 0:
            to_time = time.time()
            from_time = to_time - (cooldown_minutes * 60)
            deals = mt5.history_deals_get(from_time, to_time)
            if deals:
                losses = [d for d in deals if getattr(d, "profit", 0) < 0]
                if losses:
                    last_loss = max(losses, key=lambda d: d.time)
                    if to_time - last_loss.time < cooldown_minutes * 60:
                        self.log("BLOCKED", "COOLDOWN AFTER LOSS")
                        return {
                            "status": "BLOCKED",
                            "reason": "COOLDOWN AFTER LOSS"
                        }

        for symbol in symbols:

            self.log("SYMBOL", symbol)

            TIMEFRAME_MAP = {
               "M1": 1,
               "M5": 5,
               "M15": 15,
               "M30": 30,
               "H1": 16385,
               "H4": 16388,
            }

            trend_tf = TIMEFRAME_MAP.get(
                config.get("trend_tf", "H1"),
                16385
            )

            entry_tf = TIMEFRAME_MAP.get(
                config.get("entry_tf", "M1"),
                1
            )

            trend_df = self.mt5.get_candles(
                symbol,
                trend_tf,
                300
            )

            entry_df = self.mt5.get_candles(
                symbol,
                entry_tf,
                300
            )

            if trend_df is None or entry_df is None:
                self.log("BLOCKED", f"{symbol} NO CANDLE DATA")
                continue

            trend_df["ema_fast"] = ta.trend.ema_indicator(
                trend_df["close"],
                window=config["ema_fast"]
            )

            trend_df["ema_slow"] = ta.trend.ema_indicator(
                trend_df["close"],
                window=config["ema_slow"]
            )

            bullish_trend = trend_df["ema_fast"].iloc[-2] > trend_df["ema_slow"].iloc[-2]
            bearish_trend = trend_df["ema_fast"].iloc[-2] < trend_df["ema_slow"].iloc[-2]

            
            if config.get("trend_filter", True) and not bullish_trend and not bearish_trend:
                return {
                    "status": "BLOCKED",
                    "symbol": symbol,
                    "reason": "TREND FILTER"
                }

            adx = ta.trend.ADXIndicator(
                entry_df["high"],
                entry_df["low"],
                entry_df["close"]
            )

            entry_df["adx"] = adx.adx()
            current_adx = entry_df["adx"].iloc[-2]
            self.log("ADX", round(current_adx, 2))

            if config.get("adx_filter", True) and current_adx < config["adx_threshold"]:
                self.log("BLOCKED", f"{symbol} ADX BELOW THRESHOLD")
                return {
                    "status": "BLOCKED",
                    "symbol": symbol,
                    "reason": "ADX BELOW THRESHOLD"
                }

            atr = ta.volatility.AverageTrueRange(
                entry_df["high"],
                entry_df["low"],
                entry_df["close"]
            )

            entry_df["atr"] = atr.average_true_range()

            current_atr = entry_df["atr"].iloc[-2]
            baseline_atr = entry_df["atr"].tail(100).mean()
            atr_ratio = current_atr / baseline_atr

            self.log("ATR_RATIO", round(atr_ratio, 2))

            if config.get("atr_filter", True) and atr_ratio < config["atr_ratio"]:
                self.log("BLOCKED", f"{symbol} ATR")
                return {
                    "status": "BLOCKED",
                    "symbol": symbol,
                    "reason": "ATR"
                }

            entry_df["body"] = (entry_df["close"] - entry_df["open"]).abs()

            avg_body = entry_df["body"].tail(20).mean()
            body_ratio = entry_df["body"].iloc[-2] / avg_body

            bearish_body = entry_df["close"].iloc[-2] < entry_df["open"].iloc[-2]
            bullish_body = entry_df["close"].iloc[-2] > entry_df["open"].iloc[-2]

            self.log("BODY_RATIO", round(body_ratio, 2))

            if config.get("momentum_filter", True):
                if body_ratio < config["momentum_multiplier"]:
                    self.log("BLOCKED", f"{symbol} MOMENTUM")
                    return {"status":"BLOCKED","symbol":symbol,"reason":"MOMENTUM"}
                if bearish_trend and not bearish_body:
                    return {"status":"BLOCKED","symbol":symbol,"reason":"BEARISH MOMENTUM"}
                if bullish_trend and not bullish_body:
                    return {"status":"BLOCKED","symbol":symbol,"reason":"BULLISH MOMENTUM"}


            spread = self.mt5.get_spread(symbol)

            self.log("SPREAD", spread)

            if config.get("spread_filter", True) and spread > config["max_spread"]:
                self.log("BLOCKED", f"{symbol} SPREAD")
                return {
                    "status": "BLOCKED",
                    "symbol": symbol,
                    "reason": "SPREAD"
                }

            current_close = entry_df["close"].iloc[-2]
            previous_high = entry_df["high"].iloc[-2:-1].max()
            previous_low = entry_df["low"].iloc[-2:-1].min()
            breakout_buffer = config["breakout_buffer"]

            print(f"Close: {current_close}")
            print(f"Prev High: {previous_high}")
            print(f"Prev Low: {previous_low}")
            print(f"Buy Trigger: {previous_high + breakout_buffer}")
            print(f"Sell Trigger: {previous_low - breakout_buffer}")

            if config.get("entry_ema_filter", True):
                entry_df["ema20"] = ta.trend.ema_indicator(
                    entry_df["close"],
                    window=config["entry_ema"]
                )
                ema20 = entry_df["ema20"].iloc[-2]

                if bullish_trend and current_close < ema20:
                    return {"status":"BLOCKED","symbol":symbol,"reason":"BELOW EMA20"}

                if bearish_trend and current_close > ema20:
                    return {"status":"BLOCKED","symbol":symbol,"reason":"ABOVE EMA20"}

            self.log("BULLISH_TREND", bullish_trend)
            self.log("BEARISH_TREND", bearish_trend)
            self.log("CURRENT_CLOSE", round(current_close, 5))
            self.log("PREVIOUS_HIGH", round(previous_high, 5))
            self.log("PREVIOUS_LOW", round(previous_low, 5))
            self.log("BREAKOUT_BUFFER", breakout_buffer)
            self.log("BUY_TRIGGER", round(previous_high + breakout_buffer, 5))
            self.log("SELL_TRIGGER", round(previous_low - breakout_buffer, 5))
            self.log("DISTANCE_TO_BUY", round((previous_high + breakout_buffer) - current_close, 5))
            self.log("DISTANCE_TO_SELL", round(current_close - (previous_low - breakout_buffer), 5))

            pullback_tolerance = config.get("breakout_buffer", 0.05)

            if config.get("entry_ema_filter", True):
                self.log("EMA20", round(ema20, 5))
                self.log("EMA_DISTANCE", round(abs(current_close - ema20), 5))
                self.log("PULLBACK_TOLERANCE", pullback_tolerance)
                self.log("BULLISH_BODY", bullish_body)
                self.log("BEARISH_BODY", bearish_body)

            buy_condition = bullish_body
            sell_condition = bearish_body

            if config.get("entry_ema_filter", True):
                prev_low = entry_df["low"].iloc[-3]
                prev_high = entry_df["high"].iloc[-3]

                buy_condition = (
                    buy_condition and
                    prev_low <= (ema20 + pullback_tolerance)
                    and current_close > ema20
                )

                sell_condition = (
                    sell_condition and
                    prev_high >= (ema20 - pullback_tolerance)
                    and current_close < ema20
                )
            self.log("BUY_CONDITION", buy_condition)
            self.log("SELL_CONDITION", sell_condition)
            if bullish_trend and buy_condition:
                self.log("SIGNAL GENERATED", f"BUY {symbol}")
                return {
                    "status":"EXECUTED",
                    "signal":"BUY",
                    "symbol":symbol,
                    "reason":"EMA PULLBACK",
                    "confidence":95,
                    "stop_loss":config["stop_loss"],
                    "take_profit":config["take_profit"]
                }

            if bearish_trend and sell_condition:
                self.log("SIGNAL GENERATED", f"SELL {symbol}")
                return {
                    "status":"EXECUTED",
                    "signal":"SELL",
                    "symbol":symbol,
                    "reason":"EMA PULLBACK",
                    "confidence":95,
                    "stop_loss":config["stop_loss"],
                    "take_profit":config["take_profit"]
                }

            return {
                "status":"BLOCKED",
                "symbol":symbol,
                "reason":"WAITING FOR EMA PULLBACK"
            }

        self.log("NO SIGNAL", "No setups found on any symbol")
        return None
