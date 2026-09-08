import threading

import MetaTrader5 as mt5

from config import MT5_LOGIN, MT5_PASSWORD, MT5_SERVER, MT5_PATH


class MT5Service:
    """Process-wide MT5 connection manager.

    MetaTrader5 exposes a process-wide API, so the backend should reuse one
    initialized terminal session instead of repeatedly initialize/login/shutdown.
    """

    _lock = threading.RLock()
    _connected = False

    @classmethod
    def connect(cls) -> bool:
        with cls._lock:
            if cls._connected and mt5.account_info() is not None:
                return True

            terminal = mt5.terminal_info()
            if terminal is None:
                if not mt5.initialize(path=MT5_PATH):
                    cls._connected = False
                    return False

            account = mt5.account_info()
            if account is not None and int(getattr(account, "login", 0)) == int(MT5_LOGIN):
                cls._connected = True
                return True

            if not mt5.login(
                MT5_LOGIN,
                password=MT5_PASSWORD,
                server=MT5_SERVER,
            ):
                cls._connected = False
                return False

            cls._connected = mt5.account_info() is not None
            return cls._connected

    @classmethod
    def shutdown(cls):
        with cls._lock:
            try:
                mt5.shutdown()
            finally:
                cls._connected = False

    @classmethod
    def is_connected(cls) -> bool:
        with cls._lock:
            if not cls._connected:
                return False
            alive = mt5.account_info() is not None
            cls._connected = alive
            return alive

    @classmethod
    def ensure_symbol(cls, symbol: str) -> bool:
        if not cls.connect():
            return False
        info = mt5.symbol_info(symbol)
        if info is None:
            return False
        if not info.visible:
            return bool(mt5.symbol_select(symbol, True))
        return True

    @classmethod
    def account_info(cls):
        return mt5.account_info() if cls.connect() else None

    @staticmethod
    def last_error():
        return mt5.last_error()
