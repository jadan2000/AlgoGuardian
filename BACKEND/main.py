from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from threading import Thread
import os
from pathlib import Path
from dotenv import load_dotenv
from zoneinfo import ZoneInfo

# Load backend-local environment variables before importing services that read them.
load_dotenv(Path(__file__).resolve().parent / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes.account import router as account_router
from api.routes.analytics import router as analytics_router
from api.routes.bot import router as bot_router
from api.routes.config import router as config_router
from api.routes.logs import router as logs_router
from api.routes.mt5_account import router as mt5_account_router
from api.routes.notifications import router as notifications_router
from api.routes.payments import router as payments_router
from api.routes.trades import router as trades_router
from engine.bot_runner import run_bot
from engine.session_manager import SessionManager
from services import bot_state
from services.config_service import load_config
from services.remote_monitoring import start_remote_monitoring, stop_remote_monitoring
from engine.mt5_connector import MT5Connector
import MetaTrader5 as mt5


@asynccontextmanager
async def lifespan(app: FastAPI):
    bot_thread = Thread(target=run_bot, name="trading-bot-runner", daemon=True)
    bot_thread.start()
    print("BOT RUNNER STARTED")
    yield


app = FastAPI(title="Trading Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(filter(None, (os.getenv("FRONTEND_ORIGINS", "")).split(","))) + [
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://192.168.100.159:8080",
        "http://192.168.100.36:8080",
        "http://192.168.0.103:8080",
    ],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):8080",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(bot_router, prefix="/bot", tags=["bot"])
app.include_router(config_router, prefix="/config", tags=["config"])
app.include_router(trades_router, prefix="/trades", tags=["trades"])
app.include_router(logs_router, prefix="/logs", tags=["logs"])
app.include_router(mt5_account_router, prefix="/api/mt5-account", tags=["MT5 account"])
app.include_router(notifications_router, prefix="/api/notifications", tags=["notifications"])
app.include_router(analytics_router, prefix="/analytics", tags=["analytics"])
app.include_router(account_router, prefix="/api/trading", tags=["account"])
app.include_router(payments_router, prefix="/api/payments", tags=["payments"])


@app.get("/api/bot/session-info")
def bot_session_info():
    """Return current session and the next enabled session start for Logs."""
    connected = MT5Connector().connect()
    account = mt5.account_info() if connected else None
    manager = SessionManager()
    config = load_config()
    now_utc = datetime.now(timezone.utc)
    current_session = manager.current_session() or "CLOSED"

    # Session starts use each market's own timezone so daylight-saving changes
    # are handled correctly. Only sessions enabled in Settings are considered.
    session_windows = [
        ("LONDON", "Europe/London", 8, bool(config.get("allow_london", False))),
        ("NEW YORK", "America/New_York", 8, bool(config.get("allow_ny", False))),
        ("ASIA", "Asia/Tokyo", 9, bool(config.get("allow_asia", False))),
    ]
    upcoming = []
    for name, tz_name, start_hour, enabled in session_windows:
        if not enabled:
            continue
        local_now = now_utc.astimezone(ZoneInfo(tz_name))
        for day_offset in (0, 1, 2):
            start_local = (local_now + timedelta(days=day_offset)).replace(
                hour=start_hour, minute=0, second=0, microsecond=0
            )
            start_utc = start_local.astimezone(timezone.utc)
            if start_utc > now_utc:
                upcoming.append((start_utc, name, start_local))
                break

    if upcoming:
        next_start_utc, next_name, next_start_local = min(upcoming, key=lambda item: item[0])
        seconds = max(0, int((next_start_utc - now_utc).total_seconds()))
        hours, remainder = divmod(seconds, 3600)
        minutes = remainder // 60
        if hours:
            countdown = f"in {hours}h {minutes}m"
        else:
            countdown = f"in {minutes}m"
        next_session_start = next_start_utc.isoformat()
        time_until_next_session = f"{next_name} — {next_start_local.strftime('%H:%M %Z')} ({countdown})"
    else:
        next_session_start = ""
        time_until_next_session = "No enabled sessions in Settings"

    return {
        "connected": account is not None,
        "session": current_session,
        "current_time_utc": now_utc.isoformat(),
        "is_trading": current_session not in ("", "CLOSED", "OFFLINE", "NONE"),
        "current_session": current_session,
        "next_session_start": next_session_start,
        "time_until_next_session": time_until_next_session,
        "london_hours": "08:00–17:00 Europe/London",
        "ny_hours": "08:00–17:00 America/New_York",
        "asia_hours": "09:00–18:00 Asia/Tokyo",
        "running": bot_state.BOT_RUNNING,
        "paused": bot_state.BOT_PAUSED,
        "kill_switch": bot_state.KILL_SWITCH,
        "account_type": (
            "demo" if account and getattr(account, "trade_mode", None) == getattr(mt5, "ACCOUNT_TRADE_MODE_DEMO", object())
            else "real" if account else None
        ),
    }


@app.get("/")
def health_check():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
