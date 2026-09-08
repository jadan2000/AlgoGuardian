import MetaTrader5 as mt5
import pandas as pd
from config import MT5_LOGIN, MT5_PASSWORD, MT5_SERVER, MT5_PATH


class MT5Connector:

    def connect(self):

        print("[MT5] Initializing...")

        if not mt5.initialize(path=MT5_PATH):
            print("[MT5] Initialize failed:", mt5.last_error())
            return False

        print("[MT5] Logging in...")

        if not mt5.login(
            MT5_LOGIN,
            password=MT5_PASSWORD,
            server=MT5_SERVER
        ):
            print("[MT5] Login failed:", mt5.last_error())
            mt5.shutdown()
            return False

        account = mt5.account_info()

        if account:
            print(f"[MT5] Connected! Login: {account.login} | Server: {account.server}")
        else:
            print("[MT5] Connected but account_info() returned None")

        return True


    def get_candles(self, symbol, timeframe, count=500):

        rates = mt5.copy_rates_from_pos(
            symbol,
            timeframe,
            0,
            count
        )

        if rates is None:
            print(f"[MT5] Failed to get candles for {symbol}")
            print(mt5.last_error())
            return None

        return pd.DataFrame(rates)


    def get_spread(self, symbol):

        tick = mt5.symbol_info_tick(symbol)

        if tick is None:
            return 999

        return round(tick.ask - tick.bid, 2)


    def get_price(self, symbol):

        tick = mt5.symbol_info_tick(symbol)

        if tick is None:
            return None

        return tick.ask