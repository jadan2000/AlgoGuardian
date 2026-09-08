import time

import MetaTrader5 as mt5
import pandas as pd
import ta

from engine.mt5_connector import MT5Connector
from engine.session_manager import SessionManager
from services.config_service import load_config


TIMEFRAME_MAP = {
    "M1": mt5.TIMEFRAME_M1,
    "M5": mt5.TIMEFRAME_M5,
    "M15": mt5.TIMEFRAME_M15,
    "M30": mt5.TIMEFRAME_M30,
    "H1": mt5.TIMEFRAME_H1,
    "H4": mt5.TIMEFRAME_H4,
}


class SignalEngine:
    def log(self, title, value=None):
        if value is None:
            print(f"[SIGNAL] {title}")
        else:
            print(f"[SIGNAL] {title}: {value}")

    def __init__(self):
        self.mt5 = MT5Connector()
        self.session = SessionManager()

    def _closed_candle(self, df):
        return df.iloc[-2]

    def generate_signal(self):
        config = load_config()
        self.log("STARTING ANALYSIS")

        symbols = config.get("trading_pairs", ["XAUUSD"])
        if not self.mt5.connect():
            self.log("BLOCKED", "MT5 CONNECTION FAILED")
            return None

        if not self.session.can_trade(
            config.get("allow_london", True),
            config.get("allow_ny", True),
            config.get("demo_mode", False),
        ):
            self.log("BLOCKED", "SESSION FILTER")
            return None

        cooldown_minutes = float(config.get("cooldown_minutes", 0))
        if cooldown_minutes > 0:
            now = time.time()
            deals = mt5.history_deals_get(now - cooldown_minutes * 60, now) or []
            losses = [d for d in deals if float(getattr(d, "profit", 0.0)) < 0]
            if losses:
                last_loss = max(losses, key=lambda d: d.time)
                if now - last_loss.time < cooldown_minutes * 60:
                    return {"status": "BLOCKED", "reason": "COOLDOWN AFTER LOSS"}

        for symbol in symbols:
            self.log("SYMBOL", symbol)

            trend_tf = TIMEFRAME_MAP.get(config.get("trend_tf", "H1"), mt5.TIMEFRAME_H1)
            entry_tf = TIMEFRAME_MAP.get(config.get("entry_tf", "M5"), mt5.TIMEFRAME_M5)

            trend_df = self.mt5.get_candles(symbol, trend_tf, 300)
            entry_df = self.mt5.get_candles(symbol, entry_tf, 300)
            if trend_df is None or entry_df is None or len(trend_df) < 60 or len(entry_df) < 120:
                self.log("BLOCKED", f"{symbol} NO/INSUFFICIENT CANDLE DATA")
                continue

            trend_df["ema_fast"] = ta.trend.ema_indicator(trend_df["close"], window=int(config["ema_fast"]))
            trend_df["ema_slow"] = ta.trend.ema_indicator(trend_df["close"], window=int(config["ema_slow"]))

            trend_candle = self._closed_candle(trend_df)
            bullish_trend = trend_candle["ema_fast"] > trend_candle["ema_slow"]
            bearish_trend = trend_candle["ema_fast"] < trend_candle["ema_slow"]

            if config.get("trend_filter", True) and not (bullish_trend or bearish_trend):
                continue

            adx = ta.trend.ADXIndicator(entry_df["high"], entry_df["low"], entry_df["close"])
            entry_df["adx"] = adx.adx()
            current_adx = float(entry_df["adx"].iloc[-2])
            self.log("ADX", round(current_adx, 2))
            if config.get("adx_filter", True) and current_adx < float(config["adx_threshold"]):
                return {"status": "BLOCKED", "symbol": symbol, "reason": "ADX BELOW THRESHOLD"}

            atr = ta.volatility.AverageTrueRange(entry_df["high"], entry_df["low"], entry_df["close"])
            entry_df["atr"] = atr.average_true_range()
            current_atr = float(entry_df["atr"].iloc[-2])
            baseline_atr = float(entry_df["atr"].iloc[-102:-2].mean())
            if baseline_atr <= 0:
                return {"status": "BLOCKED", "symbol": symbol, "reason": "INVALID ATR BASELINE"}
            atr_ratio = current_atr / baseline_atr
            self.log("ATR_RATIO", round(atr_ratio, 2))
            if config.get("atr_filter", True) and atr_ratio < float(config["atr_ratio"]):
                return {"status": "BLOCKED", "symbol": symbol, "reason": "ATR"}

            current = entry_df.iloc[-2]
            previous = entry_df.iloc[-3]
            lookback = max(1, int(config.get("breakout_lookback", 5)))
            range_df = entry_df.iloc[-2 - lookback:-2]
            previous_high = float(range_df["high"].max()) if not range_df.empty else float(previous["high"])
            previous_low = float(range_df["low"].min()) if not range_df.empty else float(previous["low"])
            breakout_buffer = abs(float(config.get("breakout_buffer", 0.0)))
            buy_trigger = previous_high + breakout_buffer
            sell_trigger = previous_low - breakout_buffer

            body = abs(float(current["close"]) - float(current["open"]))
            avg_body = float(entry_df["body"].tail(20).mean()) if "body" in entry_df else float((entry_df["close"] - entry_df["open"]).abs().tail(20).mean())
            body_ratio = body / avg_body if avg_body > 0 else 0.0
            bullish_body = float(current["close"]) > float(current["open"])
            bearish_body = float(current["close"]) < float(current["open"])

            self.log("BODY_RATIO", round(body_ratio, 2))
            if config.get("momentum_filter", True):
                if body_ratio < float(config["momentum_multiplier"]):
                    return {"status": "BLOCKED", "symbol": symbol, "reason": "MOMENTUM"}
                if bullish_trend and not bullish_body:
                    return {"status": "BLOCKED", "symbol": symbol, "reason": "BULLISH MOMENTUM"}
                if bearish_trend and not bearish_body:
                    return {"status": "BLOCKED", "symbol": symbol, "reason": "BEARISH MOMENTUM"}

            spread = self.mt5.get_spread(symbol)
            self.log("SPREAD", spread)
            if config.get("spread_filter", True) and spread > float(config["max_spread"]):
                return {"status": "BLOCKED", "symbol": symbol, "reason": "SPREAD"}

            entry_close = float(current["close"])
            ema_value = None
            if config.get("entry_ema_filter", True):
                entry_df["entry_ema"] = ta.trend.ema_indicator(entry_df["close"], window=int(config["entry_ema"]))
                ema_value = float(entry_df["entry_ema"].iloc[-2])
                if bullish_trend and entry_close < ema_value:
                    return {"status": "BLOCKED", "symbol": symbol, "reason": "BELOW ENTRY EMA"}
                if bearish_trend and entry_close > ema_value:
                    return {"status": "BLOCKED", "symbol": symbol, "reason": "ABOVE ENTRY EMA"}

            # Breakout mode is explicit. It is not merely logged: it participates in the final signal decision.
            breakout_filter = bool(config.get("breakout_filter", False))
            breakout_buy = entry_close >= buy_trigger
            breakout_sell = entry_close <= sell_trigger

            # Pullback mode remains available when breakout_filter is disabled.
            buy_condition = bullish_body
            sell_condition = bearish_body
            if config.get("entry_ema_filter", True) and ema_value is not None:
                pullback_tolerance = abs(float(config.get("breakout_buffer", 0.05)))
                buy_condition = buy_condition and float(previous["low"]) <= ema_value + pullback_tolerance and entry_close > ema_value
                sell_condition = sell_condition and float(previous["high"]) >= ema_value - pullback_tolerance and entry_close < ema_value

            if breakout_filter:
                buy_condition = buy_condition and breakout_buy
                sell_condition = sell_condition and breakout_sell

            self.log("PREVIOUS_RANGE_HIGH", round(previous_high, 5))
            self.log("PREVIOUS_RANGE_LOW", round(previous_low, 5))
            self.log("BUY_TRIGGER", round(buy_trigger, 5))
            self.log("SELL_TRIGGER", round(sell_trigger, 5))
            self.log("BREAKOUT_BUY", breakout_buy)
            self.log("BREAKOUT_SELL", breakout_sell)
            self.log("BUY_CONDITION", buy_condition)
            self.log("SELL_CONDITION", sell_condition)

            if bullish_trend and buy_condition:
                return {
                    "status": "EXECUTED",
                    "signal": "BUY",
                    "symbol": symbol,
                    "reason": "BREAKOUT + EMA PULLBACK" if breakout_filter else "EMA PULLBACK",
                    "confidence": 95,
                    "stop_loss": float(config["stop_loss"]),
                    "take_profit": float(config["take_profit"]),
                }

            if bearish_trend and sell_condition:
                return {
                    "status": "EXECUTED",
                    "signal": "SELL",
                    "symbol": symbol,
                    "reason": "BREAKOUT + EMA PULLBACK" if breakout_filter else "EMA PULLBACK",
                    "confidence": 95,
                    "stop_loss": float(config["stop_loss"]),
                    "take_profit": float(config["take_profit"]),
                }

            return {"status": "BLOCKED", "symbol": symbol, "reason": "WAITING FOR SETUP"}

        self.log("NO SIGNAL", "No setups found on any symbol")
        return None
