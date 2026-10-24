"""Process-wide MetaTrader 5 connection manager using encrypted Accounts storage.

The MetaTrader5 Python package uses one terminal session per Python process.
This worker intentionally manages one account on the laptop running AlgoGuardian.
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
        return bool(actual_server) and actual_server.casefold() == str(credentials["server"]).strip().casefold()

    @classmethod
    def _initialize_terminal(cls, credentials) -> bool:
        """Initialize MT5 on this laptop, attempting the saved credentials immediately."""
        terminal_path = detect_terminal_path()
        login_options = {
            "login": int(credentials["login"]),
            "password": credentials["password"],
            "server": credentials["server"],
        }

        initialized = (
            mt5.initialize(path=terminal_path, **login_options)
            if terminal_path
            else mt5.initialize(**login_options)
        )
        if initialized:
            return True

        # Some existing terminal installations initialize successfully only before
        # login is requested. Retry initialization first, then perform mt5.login().
        initialization_error = mt5.last_error()
        try:
            mt5.shutdown()
        except (RuntimeError, TypeError):
            pass

        initialized = mt5.initialize(path=terminal_path) if terminal_path else mt5.initialize()
        if not initialized:
            cls._last_connection_error = mt5.last_error() or initialization_error
            return False
        return True

    _last_connection_error = None

    @classmethod
    def connect(cls) -> bool:
        with cls._lock:
            cls._last_connection_error = None
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
                    if not cls._initialize_terminal(credentials):
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
                    cls._last_connection_error = mt5.last_error()
                    cls._connected = False
                    return False

                account = mt5.account_info()
                cls._connected = cls._matches_account(account, credentials)
                if not cls._connected:
                    cls._last_connection_error = mt5.last_error()
                return cls._connected
            except (RuntimeError, TypeError, ValueError, CredentialStorageError) as exc:
                cls._last_connection_error = str(exc)
                cls._connected = False
                return False

    @classmethod
    def reconnect(cls) -> bool:
        """Refresh the Python MT5 session and connect using the currently saved account."""
        with cls._lock:
            try:
                mt5.shutdown()
            except (RuntimeError, TypeError):
                pass
            cls._connected = False
            return cls.connect()

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
                if cls._last_connection_error:
                    status["reason"] += f" MT5 error: {cls._last_connection_error}"
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
