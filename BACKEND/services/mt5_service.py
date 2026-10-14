"""Process-wide MetaTrader 5 connection manager for the development worker.

The MetaTrader5 Python package talks to one terminal session per Python process.
This class intentionally supports one configured account only. Do not use it as a
multi-tenant connection manager; customer accounts need isolated worker processes.
"""
import threading

import MetaTrader5 as mt5

from config import MT5_LOGIN, MT5_PASSWORD, MT5_SERVER, MT5_PATH


class MT5Service:
    _lock = threading.RLock()
    _connected = False

    @classmethod
    def _credentials_configured(cls) -> bool:
        return (
            isinstance(MT5_LOGIN, int)
            and MT5_LOGIN > 0
            and bool(MT5_PASSWORD)
            and bool(MT5_SERVER)
        )

    @classmethod
    def _matches_configured_account(cls, account) -> bool:
        if account is None or not cls._credentials_configured():
            return False
        try:
            if int(getattr(account, "login", 0)) != MT5_LOGIN:
                return False
        except (TypeError, ValueError):
            return False
        actual_server = str(getattr(account, "server", "") or "").strip()
        return bool(actual_server) and actual_server.casefold() == MT5_SERVER.casefold()

    @classmethod
    def connect(cls) -> bool:
        """Connect to the one account configured in environment variables."""
        with cls._lock:
            if not cls._credentials_configured():
                cls._connected = False
                return False
            try:
                current_account = mt5.account_info()
                if cls._matches_configured_account(current_account):
                    cls._connected = True
                    return True

                terminal = mt5.terminal_info()
                if terminal is None:
                    initialized = mt5.initialize(path=MT5_PATH) if MT5_PATH else mt5.initialize()
                    if not initialized:
                        cls._connected = False
                        return False

                current_account = mt5.account_info()
                if cls._matches_configured_account(current_account):
                    cls._connected = True
                    return True

                logged_in = mt5.login(
                    MT5_LOGIN,
                    password=MT5_PASSWORD,
                    server=MT5_SERVER,
                )
                if not logged_in:
                    cls._connected = False
                    return False

                cls._connected = cls._matches_configured_account(mt5.account_info())
                return cls._connected
            except (RuntimeError, TypeError, ValueError):
                cls._connected = False
                return False

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
            cls._connected = cls._matches_configured_account(mt5.account_info())
            return cls._connected

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
    def connection_status(cls) -> dict:
        """Return safe diagnostic metadata; never return credentials."""
        with cls._lock:
            configured = cls._credentials_configured()
            account = mt5.account_info() if configured else None
            connected = cls._matches_configured_account(account)
            cls._connected = connected
            status = {
                "configured": configured,
                "connected": connected,
                "login": int(account.login) if connected else None,
                "server": str(account.server) if connected else None,
                "company": str(getattr(account, "company", "") or "") if connected else None,
                "currency": str(getattr(account, "currency", "") or "") if connected else None,
                "trade_allowed": bool(getattr(account, "trade_allowed", False)) if connected else False,
                "trade_mode": cls._trade_mode_label(account) if connected else None,
            }
            if not configured:
                status["reason"] = "MT5 credentials are not configured"
            elif not connected:
                status["reason"] = "MT5 is not connected to the configured account"
            return status

    @staticmethod
    def _trade_mode_label(account) -> str:
        mode = getattr(account, "trade_mode", None)
        if mode == getattr(mt5, "ACCOUNT_TRADE_MODE_DEMO", object()):
            return "demo"
        if mode == getattr(mt5, "ACCOUNT_TRADE_MODE_REAL", object()):
            return "real"
        if mode == getattr(mt5, "ACCOUNT_TRADE_MODE_CONTEST", object()):
            return "contest"
        return "unknown"

    @staticmethod
    def last_error():
        return mt5.last_error()
