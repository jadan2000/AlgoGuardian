"""Process-wide MetaTrader 5 connection manager using encrypted Accounts storage.

The MetaTrader5 Python package uses one terminal session per Python process.
This worker intentionally manages one account.
"""
import threading

import MetaTrader5 as mt5

from services.mt5_terminal_path import detect_terminal_path
from services.mt5_credentials import CredentialStorageError, load_credentials


class MT5Service:
    _lock = threading.RLock()
    _connected = False

    @classmethod
    def _matches_account(cls, account, credentials) -> bool:
        if account is None or not credentials:
            return False
        try:
            if int(getattr(account, "login", 0)) != int(credentials["login"]):
                return False
        except (TypeError, ValueError, KeyError):
            return False
        actual_server = str(getattr(account, "server", "") or "").strip()
        return bool(actual_server) and actual_server.casefold() == str(credentials["server"]).casefold()

    @classmethod
    def connect(cls) -> bool:
        with cls._lock:
            credentials = load_credentials()
            if not credentials:
                cls._connected = False
                return False
            try:
                current_account = mt5.account_info()
                if cls._matches_account(current_account, credentials):
                    cls._connected = True
                    return True

                terminal = mt5.terminal_info()
                if terminal is None:
                    terminal_path = detect_terminal_path()\n                    initialized = mt5.initialize(path=terminal_path) if terminal_path else mt5.initialize()
                    if not initialized:
                        cls._connected = False
                        return False

                current_account = mt5.account_info()
                if cls._matches_account(current_account, credentials):
                    cls._connected = True
                    return True

                logged_in = mt5.login(
                    int(credentials["login"]),
                    password=credentials["password"],
                    server=credentials["server"],
                )
                if not logged_in:
                    cls._connected = False
                    return False

                cls._connected = cls._matches_account(mt5.account_info(), credentials)
                return cls._connected
            except (RuntimeError, TypeError, ValueError, CredentialStorageError):
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
            credentials = load_credentials()
            cls._connected = cls._matches_account(mt5.account_info(), credentials)
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
        with cls._lock:
            credentials = load_credentials()
            configured = bool(credentials)
            account = mt5.account_info() if configured else None
            connected = cls._matches_account(account, credentials)
            cls._connected = connected
            status = {
                "configured": configured,
                "connected": connected,
                "login": int(account.login) if connected else (credentials["login"] if credentials else None),
                "server": str(account.server) if connected else (credentials["server"] if credentials else None),
                "company": str(getattr(account, "company", "") or "") if connected else None,
                "currency": str(getattr(account, "currency", "") or "") if connected else None,
                "trade_allowed": bool(getattr(account, "trade_allowed", False)) if connected else False,
                "trade_mode": cls._trade_mode_label(account) if connected else None,
            }
            if not configured:
                status["reason"] = "No broker account saved. Add your MT5 credentials in Accounts."
            elif not connected:
                status["reason"] = "MT5 is not connected to the saved account."
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
