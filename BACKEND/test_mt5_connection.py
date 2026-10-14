"""Verify the configured MT5 connection and require a confirmed demo account.

Run from the BACKEND directory:
    python test_mt5_connection.py

This diagnostic does not place trades.
"""
import json
import sys

import MetaTrader5 as mt5

from services.mt5_service import MT5Service


def main() -> int:
    if not MT5Service.connect():
        print(json.dumps({
            "connected": False,
            "error": "MT5 connection failed or configured account/server did not match",
            "mt5_error": str(MT5Service.last_error()),
        }, indent=2))
        return 1

    account = mt5.account_info()
    if account is None:
        print(json.dumps({
            "connected": False,
            "error": "MT5 connected but account information is unavailable",
            "mt5_error": str(MT5Service.last_error()),
        }, indent=2))
        return 1

    demo_mode = getattr(mt5, "ACCOUNT_TRADE_MODE_DEMO", None)
    is_demo = demo_mode is not None and getattr(account, "trade_mode", None) == demo_mode
    result = {
        "connected": True,
        "login": int(account.login),
        "server": str(account.server),
        "company": str(getattr(account, "company", "") or ""),
        "currency": str(getattr(account, "currency", "") or ""),
        "balance": float(account.balance),
        "equity": float(account.equity),
        "trade_allowed": bool(getattr(account, "trade_allowed", False)),
        "account_type": "demo" if is_demo else "not-confirmed-demo",
        "orders_sent": False,
    }
    print(json.dumps(result, indent=2))

    if not is_demo:
        print("REFUSED: this first-stage diagnostic requires a confirmed demo account.", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    finally:
        MT5Service.shutdown()
