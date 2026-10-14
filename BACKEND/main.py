from contextlib import asynccontextmanager
from datetime import datetime, timezone
from threading import Thread

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes.account import router as account_router
from api.routes.analytics import router as analytics_router
from api.routes.bot import router as bot_router
from api.routes.config import router as config_router
from api.routes.logs import router as logs_router
from api.routes.trades import router as trades_router
from engine.bot_runner import run_bot
from engine.session_manager import SessionManager
from services import bot_state
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
    allow_origins=[
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
app.include_router(analytics_router, prefix="/analytics", tags=["analytics"])
app.include_router(account_router, prefix="/api/trading", tags=["account"])


@app.get("/api/bot/session-info")
def bot_session_info():
    """Compatibility endpoint used by the dashboard session indicator."""
    connected = MT5Connector().connect()
    account = mt5.account_info() if connected else None
    return {
        "connected": account is not None,
        "session": SessionManager().current_session(),
        "current_time_utc": datetime.now(timezone.utc).isoformat(),
        "is_trading": str(SessionManager().current_session() or "").upper() not in ("", "CLOSED", "OFFLINE", "NONE"),
        "current_session": SessionManager().current_session() or "CLOSED",
        "time_until_next_session": "—",
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
