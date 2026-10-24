# AlgoGuardian local MT5 bridge

Windows-only local companion for the AlgoGuardian dashboard. It checks whether the configured MT5 terminal is running and whether the Python MT5 integration can verify a logged-in, connected account. It **does not place trades** and the trading engine remains disabled.

## Setup

1. Install 64-bit Python on the Windows laptop that runs MT5.
2. In PowerShell, from this folder, run `python -m venv .venv`, then `.\.venv\Scripts\Activate.ps1`.
3. Run `pip install -r requirements.txt`.
4. Copy `config.example.json` to `config.json` and update `mt5_terminal_path` and `dashboard_origin` to match the laptop and the dashboard origin. Keep `config.json` private; it is ignored by Git.
5. Run `python bridge.py`. The bridge binds only to `127.0.0.1:8765`.
6. Open the dashboard on the same laptop. The Local MT5 Bridge panel checks the bridge every 10 seconds. Use **Open MT5** to launch the terminal if it is not running, then verify the broker connection.

## Optional phone alerts

See [NOTIFICATIONS/README.md](../NOTIFICATIONS/README.md). Configure the relay URL, relay API key, and phone's Expo push token in local `config.json` to enable MT5 disconnected/reconnected alerts. Leave these fields blank to disable alerts. Do not commit `config.json` or any API keys.

## Safety and limitations

- The bridge is local-only and reports status; it does not enable order execution.
- The browser dashboard must be allowed by `dashboard_origin`. For a deployed dashboard, configure the exact trusted origin and restart the bridge.
- If MT5 or the laptop loses power/network, an immediate alert cannot be guaranteed.
- The current bridge emits phone alerts only for observed MT5 connection changes. Trade-opened/closed, risk-limit, and daily-limit alerts require a real local trading engine to emit those events; that engine is not wired into this prototype.
- Test the connection and notification path on a demo account first. Never put broker passwords or trading commands in phone notification payloads.
