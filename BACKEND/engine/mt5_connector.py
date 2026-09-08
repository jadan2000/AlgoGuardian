import pandas as pd
import MetaTrader5 as mt5

from services.mt5_service import MT5Service


class MT5Connector:
    """Thin adapter around the process-wide MT5 service."""

    def connect(self):
        return MT5Service.connect()

    def get_candles(self, symbol, timeframe, count=500):
        if not MT5Service.ensure_symbol(symbol):
            print(f"[MT5] Symbol unavailable: {symbol}")
            return None

        rates = mt5.copy_rates_from_pos(symbol, timeframe, 0, count)
        if rates is None:
            print(f"[MT5] Failed to get candles for {symbol}: {mt5.last_error()}")
            return None

        return pd.DataFrame(rates)

    def get_spread(self, symbol):
        if not MT5Service.ensure_symbol(symbol):
            return 999.0

        tick = mt5.symbol_info_tick(symbol)
        info = mt5.symbol_info(symbol)
        if tick is None or info is None:
            return 999.0

        return float(tick.ask - tick.bid)

    def get_price(self, symbol):
        if not MT5Service.ensure_symbol(symbol):
            return None

        tick = mt5.symbol_info_tick(symbol)
        return tick.ask if tick else None
