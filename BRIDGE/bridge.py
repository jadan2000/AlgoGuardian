"""Local-only AlgoGuardian bridge prototype. Does not place trades."""
from __future__ import annotations
import json, os, subprocess, time
from pathlib import Path
from typing import Any
from urllib.request import Request, urlopen
import psutil, uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    import MetaTrader5 as mt5
except ImportError:
    mt5 = None

ROOT = Path(__file__).resolve().parent
CONFIG_PATH = ROOT / "config.json"
DEFAULTS: dict[str, Any] = {"mt5_terminal_path": r"C:\Program Files\MetaTrader 5\terminal64.exe", "dashboard_origin": "http://localhost:5173", "port": 8765}

def load_config() -> dict[str, Any]:
    if CONFIG_PATH.exists():
        try:
            return {**DEFAULTS, **json.loads(CONFIG_PATH.read_text(encoding="utf-8"))}
        except (OSError, json.JSONDecodeError) as exc:
            raise RuntimeError(f"Invalid bridge config: {exc}") from exc
    return DEFAULTS.copy()

config = load_config()
_last_broker_connected: bool | None = None


def send_phone_alert(event: str, message: str) -> None:
    """Send an optional phone alert through the separately configured relay."""
    relay_url = str(config.get("notification_relay_url", "")).strip().rstrip("/")
    relay_key = str(config.get("notification_relay_api_key", "")).strip()
    device_token = str(config.get("notification_device_token", "")).strip()
    if not (relay_url and relay_key and device_token):
        return
    payload = json.dumps({"deviceToken": device_token, "event": event, "message": message}).encode("utf-8")
    request = Request(
        relay_url + "/v1/notify",
        data=payload,
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + relay_key},
        method="POST",
    )
    try:
        with urlopen(request, timeout=3) as response:
            if response.status >= 300:
                print("Phone alert relay returned HTTP", response.status)
    except Exception as exc:
        # Notification failures must never take down bridge status or MT5 checks.
        print("Phone alert could not be delivered:", type(exc).__name__)


def notify_connection_change(connected: bool) -> None:
    global _last_broker_connected
    previous = _last_broker_connected
    _last_broker_connected = connected
    if previous is None or previous == connected:
        return
    if connected:
        send_phone_alert("mt5_reconnected", "Your MT5 broker connection is available again.")
    else:
        send_phone_alert("mt5_disconnected", "Your MT5 broker connection was lost. Check MT5 on your laptop.")


app = FastAPI(title="AlgoGuardian Local Bridge", version="0.2.0")
app.add_middleware(CORSMiddleware, allow_origins=[str(config["dashboard_origin"])], allow_credentials=False, allow_methods=["GET", "POST", "OPTIONS"], allow_headers=["Content-Type"])

def mt5_processes() -> list[dict[str, Any]]:
    found = []
    configured = str(Path(str(config["mt5_terminal_path"])).resolve()).lower()
    for process in psutil.process_iter(["pid", "name", "exe"]):
        try:
            name = (process.info.get("name") or "").lower()
            exe = str(process.info.get("exe") or "")
            if name in {"terminal.exe", "terminal64.exe"} and (not exe or exe.lower() == configured):
                found.append({"pid": process.info["pid"], "name": process.info.get("name"), "path": exe})
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    return found

def launch_terminal() -> dict[str, Any]:
    path = Path(str(config["mt5_terminal_path"])).expanduser()
    if not path.is_file():
        raise HTTPException(status_code=409, detail="MT5 terminal not found. Install MT5 or configure mt5_terminal_path.")
    try:
        subprocess.Popen([str(path)], cwd=str(path.parent), close_fds=True, creationflags=getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0))
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Could not launch MT5: {exc}") from exc
    return {"launched": True}

def probe_mt5_connection() -> dict[str, Any]:
    if mt5 is None:
        return {"account_verified": False, "broker_connected": False, "verification_message": "Install the MetaTrader5 Python package in the Windows bridge environment to verify terminal/account status."}
    path = str(Path(str(config["mt5_terminal_path"])).expanduser())
    initialized = False
    try:
        initialized = bool(mt5.initialize(path=path, timeout=10000))
        if not initialized:
            return {"account_verified": False, "broker_connected": False, "verification_message": "MT5 API initialization failed. Open MT5 and check its login/server, then retry."}
        terminal = mt5.terminal_info()
        account = mt5.account_info()
        connected = bool(terminal and getattr(terminal, "connected", False))
        verified = bool(connected and account and getattr(account, "login", 0) and getattr(account, "server", ""))
        return {"account_verified": verified, "broker_connected": connected, "verification_message": "MT5 account and broker connection verified." if verified else "MT5 is open, but a logged-in broker account connection could not be verified."}
    except Exception:
        return {"account_verified": False, "broker_connected": False, "verification_message": "MT5 connection verification failed; check the terminal and retry."}
    finally:
        if initialized:
            mt5.shutdown()

@app.middleware("http")
async def validate_origin(request: Request, call_next):
    origin = request.headers.get("origin")
    if origin and origin != str(config["dashboard_origin"]):
        raise HTTPException(status_code=403, detail="Unapproved dashboard origin.")
    return await call_next(request)

@app.get("/health")
async def health():
    return {"status": "ok", "service": "algoguardian-local-bridge", "trading_enabled": False}

@app.get("/v1/status")
async def status():
    processes = mt5_processes()
    connection = probe_mt5_connection() if processes else {"account_verified": False, "broker_connected": False, "verification_message": "Configured MT5 terminal is not running."}
    return {"bridge": "ready", "mt5_process_detected": bool(processes), "mt5_processes": processes, **connection, "trading_enabled": False}

class EnsureTerminalRequest(BaseModel):
    launch_if_missing: bool = True

@app.post("/v1/ensure-terminal")
async def ensure_terminal(payload: EnsureTerminalRequest):
    processes = mt5_processes()
    launched = False
    if not processes:
        if not payload.launch_if_missing:
            return {"status": "stopped", "launched": False, "account_verified": False, "broker_connected": False, "trading_enabled": False}
        launch_terminal()
        launched = True
        for _ in range(20):
            time.sleep(0.5)
            processes = mt5_processes()
            if processes:
                break
    connection = probe_mt5_connection() if processes else {"account_verified": False, "broker_connected": False, "verification_message": "MT5 process did not appear before timeout."}
    state = "connected" if connection["account_verified"] else ("starting" if processes else "launch_failed")
    return {"status": state, "launched": launched, "mt5_processes": processes, **connection, "trading_enabled": False}

if __name__ == "__main__":
    if os.name != "nt": print("Warning: intended for Windows; process detection is platform-dependent.")
    uvicorn.run(app, host="127.0.0.1", port=int(config["port"]), log_level="info")
