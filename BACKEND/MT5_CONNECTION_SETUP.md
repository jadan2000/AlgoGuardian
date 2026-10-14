# MT5 demo connection setup

This first implementation verifies one configured MT5 demo account from the existing
Python backend. It does not place orders and is not yet a multi-customer connection
service.

## Requirements

- Windows machine or Windows server with the broker's MetaTrader 5 desktop terminal installed.
- A broker-issued MT5 demo account (login, trading password, and exact server name).
- Python dependencies from `requirements.txt` installed in the backend environment.

The MetaTrader5 Python package connects to a locally installed terminal. A phone browser
cannot host this Python engine, and a generic Linux web host is not a replacement for the
Windows MT5 worker.

## Configure

1. Open `BACKEND`.
2. Copy `.env.example` to `.env`.
3. Replace the sample values with your demo login, trading password, and exact broker server.
4. If MT5 is installed in a non-default location, set `MT5_PATH` to the full path to
   `terminal64.exe`.
5. Open MetaTrader 5 on that machine and make sure the demo account can sign in normally.

Never paste the real password into source code, GitHub, screenshots, chat, or logs.

## Verify the connection

From PowerShell:

```powershell
cd C:\FINAL BOT\BACKEND
python -m pip install -r requirements.txt
python test_mt5_connection.py
```

A successful result reports the actual account login, broker server, account type, balance,
equity, and trading permission. The diagnostic sends no orders and exits with a non-zero
status if the connection fails or the account is not confirmed as a demo account.

## Important multi-customer boundary

The current MT5 Python API is process-wide and the existing trading engine reads a single
configured account. Do not accept customer MT5 credentials through a public endpoint yet.
Before customer onboarding, implement authentication/authorization, encrypted credential
storage with a managed key, one isolated worker process and terminal per account, ownership
checks, subscription enforcement, heartbeat/stale-worker handling, and demo-only safeguards.
