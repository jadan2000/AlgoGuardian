from datetime import datetime, timedelta

import MetaTrader5 as mt5

from services.mt5_service import MT5Service


class RiskManager:
    """Central pre-trade risk controls."""

    def validate(self, signal, config):
        if not signal or signal.get("status") != "EXECUTED":
            return False, "INVALID SIGNAL"

        if not MT5Service.connect():
            return False, "MT5 CONNECTION FAILED"

        account = mt5.account_info()
        if account is None or account.balance <= 0:
            return False, "ACCOUNT UNAVAILABLE"

        symbol = signal.get("symbol")
        positions = mt5.positions_get(symbol=symbol) or []
        max_open = int(config.get("max_open_positions", 1))
        if len(positions) >= max_open:
            return False, "MAX OPEN POSITIONS"

        # Count entry deals for the configured trading day.
        now = datetime.now()
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        deals = mt5.history_deals_get(start, now) or []
        entry_deals = [
            d for d in deals
            if getattr(d, "entry", None) in (mt5.DEAL_ENTRY_IN, mt5.DEAL_ENTRY_INOUT)
            and getattr(d, "volume", 0) > 0
        ]
        max_daily_trades = int(config.get("max_trades_per_day", 0))
        if max_daily_trades > 0 and len(entry_deals) >= max_daily_trades:
            return False, "MAX TRADES PER DAY"

        # Enforce daily loss from closed deals plus floating account P/L.
        max_daily_loss_pct = float(config.get("max_daily_loss", 0))
        if max_daily_loss_pct > 0:
            closed_pnl = sum(float(getattr(d, "profit", 0.0)) for d in deals)
            daily_pnl = closed_pnl + float(getattr(account, "profit", 0.0))
            allowed_loss = account.balance * max_daily_loss_pct / 100.0
            if daily_pnl <= -allowed_loss:
                return False, "MAX DAILY LOSS"

        stop_distance = abs(float(signal.get("stop_loss", 0)))
        take_distance = abs(float(signal.get("take_profit", 0)))
        if stop_distance <= 0 or take_distance <= 0:
            return False, "INVALID SL/TP"

        return True, "OK"
