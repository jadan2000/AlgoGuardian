from datetime import datetime

import MetaTrader5 as mt5

from services.config_service import load_config
from services.mt5_service import MT5Service


class RiskManager:
    """Central pre-trade risk controls and safety limits."""

    def validate(self, signal, config=None):
        config = config or load_config()

        if not signal or signal.get("status") != "EXECUTED":
            return False, "INVALID SIGNAL"
        if not MT5Service.connect():
            return False, "MT5 CONNECTION FAILED"

        account = mt5.account_info()
        if account is None or float(account.balance) <= 0:
            return False, "ACCOUNT UNAVAILABLE"

        symbol = signal.get("symbol")
        positions = mt5.positions_get(symbol=symbol) or []
        max_open = int(config.get("max_open_positions", 1))
        if len(positions) >= max_open:
            return False, "MAX OPEN POSITIONS"

        now = datetime.now()
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        deals = mt5.history_deals_get(day_start, now) or []

        entry_deals = [
            deal for deal in deals
            if getattr(deal, "entry", None) in (mt5.DEAL_ENTRY_IN, mt5.DEAL_ENTRY_INOUT)
            and float(getattr(deal, "volume", 0.0)) > 0
        ]
        max_daily_trades = int(config.get("max_trades_per_day", 0))
        if max_daily_trades > 0 and len(entry_deals) >= max_daily_trades:
            return False, "MAX TRADES PER DAY"

        # Closed deal P/L for the current day. Floating P/L comes from account.profit.
        closed_pnl = sum(
            float(getattr(deal, "profit", 0.0))
            for deal in deals
            if getattr(deal, "entry", None) in (mt5.DEAL_ENTRY_OUT, mt5.DEAL_ENTRY_INOUT)
        )
        floating_pnl = float(getattr(account, "profit", 0.0))
        daily_pnl = closed_pnl + floating_pnl

        max_daily_loss_pct = float(config.get("max_daily_loss", 0.0))
        if max_daily_loss_pct > 0:
            allowed_loss = float(account.balance) * max_daily_loss_pct / 100.0
            if daily_pnl <= -allowed_loss:
                return False, "MAX DAILY LOSS"

        if float(config.get("max_drawdown", 0.0)) > 0 and float(account.balance) > 0:
            equity_drawdown_pct = max(
                0.0,
                (float(account.balance) - float(account.equity)) / float(account.balance) * 100.0,
            )
            if equity_drawdown_pct >= float(config["max_drawdown"]):
                return False, "MAX DRAWDOWN"

        stop_distance = abs(float(signal.get("stop_loss", 0.0)))
        take_distance = abs(float(signal.get("take_profit", 0.0)))
        if stop_distance <= 0 or take_distance <= 0:
            return False, "INVALID SL/TP"

        return True, "OK"
