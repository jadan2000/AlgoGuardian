import MetaTrader5 as mt5
import pandas as pd

from services.mt5_service import MT5Service


class MT5Connector:
    """Thin adapter over the shared MT5Service."""

    def connect(self):
        return MT5Service.connect()

    def get_candles(self, symbol, timeframe, count=500):
        if not self.connect() or not MT5Service.ensure_symbol(symbol):
            print(f"[MT5] Symbol unavailable: {symbol}")
            return None

        rates = mt5.copy_rates_from_pos(symbol, timeframe, 0, count)
        if rates is None:
            print(f"[MT5] Failed to get candles for {symbol}: {mt5.last_error()}")
            return None

        return pd.DataFrame(rates)

    def get_spread(self, symbol):
        if not self.connect() or not MT5Service.ensure_symbol(symbol):
            return 999.0

        tick = mt5.symbol_info_tick(symbol)
        info = mt5.symbol_info(symbol)
        if tick is None or info is None:
            return 999.0

        # Spread is expressed in price units, preserving the existing config convention.
        return round(tick.ask - tick.bid, info.digits)

    def get_price(self, symbol):
        if not self.connect() or not MT5Service.ensure_symbol(symbol):
            return None

        tick = mt5.symbol_info_tick(symbol)
        return tick.ask if tick else None
