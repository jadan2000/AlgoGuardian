import threading
from typing import Optional

import MetaTrader5 as mt5

from config import MT5_LOGIN, MT5_PASSWORD, MT5_SERVER, MT5_PATH


class MT5Service:
    """Process-wide MT5 session with safe reuse and explicit initialization."""

    _lock = threading.RLock()
    _connected = False

    @classmethod
    def connect(cls) -> bool:
        with cls._lock:
            if cls._connected and mt5.terminal_info() is not None and mt5.account_info() is not None:
                return True

            if mt5.terminal_info() is None:
                if not mt5.initialize(path=MT5_PATH):
                    cls._connected = False
                    return False

            if not mt5.login(MT5_LOGIN, password=MT5_PASSWORD, server=MT5_SERVER):
                cls._connected = False
                return False

            cls._connected = mt5.account_info() is not None
            return cls._connected

    @classmethod
    def shutdown(cls) -> None:
        with cls._lock:
            if cls._connected:
                mt5.shutdown()
            cls._connected = False

    @classmethod
    def is_connected(cls) -> bool:
        with cls._lock:
            return cls._connected and mt5.account_info() is not None

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

    @classmethod
    def last_error(cls):
        return mt5.last_error()
