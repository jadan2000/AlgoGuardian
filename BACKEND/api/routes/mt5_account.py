"""Authenticated management endpoints for the local MT5 account."""
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException

from api.auth import require_authenticated_user
from services.mt5_credentials import CredentialStorageError, public_credentials, save_credentials
from services.mt5_service import MT5Service
from services.mt5_terminal_path import save_terminal_path, terminal_path_status


# Each local AlgoGuardian installation manages the MT5 account configured on that
# machine. Require a verified signed-in session, not a developer-maintained allowlist.
router = APIRouter(dependencies=[Depends(require_authenticated_user)])


class MT5TerminalPathInput(BaseModel):
    path: str = Field(min_length=1, max_length=1024)


class MT5CredentialsInput(BaseModel):
    login: int = Field(gt=0)
    password: str = Field(min_length=1, max_length=256)
    server: str = Field(min_length=1, max_length=160)


def _safe_status() -> dict:
    details = MT5Service.connection_status()
    return {
        **public_credentials(),
        "terminal": terminal_path_status(),
        "connected": bool(details.get("connected")),
        "company": details.get("company"),
        "currency": details.get("currency"),
        "trade_mode": details.get("trade_mode"),
        "trade_allowed": bool(details.get("trade_allowed", False)),
        "reason": details.get("reason"),
    }


@router.get("/status")
def account_status():
    try:
        MT5Service.connect()
        return _safe_status()
    except CredentialStorageError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/credentials")
def update_credentials(payload: MT5CredentialsInput):
    """Save encrypted credentials, refresh the MT5 session, and log into that account."""
    try:
        save_credentials(payload.login, payload.password, payload.server)
        connected = MT5Service.reconnect()
        status = _safe_status()
        status["connected"] = connected
        if not connected and not status.get("reason"):
            status["reason"] = "Credentials were saved securely, but MT5 could not connect. Check the account number, password, server and terminal installation."
        return status
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except CredentialStorageError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/connect")
def connect_account():
    try:
        connected = MT5Service.connect()
        status = _safe_status()
        status["connected"] = connected
        if not connected and not status.get("reason"):
            status["reason"] = "Could not connect to MT5. Check saved credentials and ensure the MT5 desktop terminal is installed and available to this backend."
        return status
    except CredentialStorageError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/disconnect")
def disconnect_account():
    MT5Service.shutdown()
    status = _safe_status()
    status["connected"] = False
    status["reason"] = "Disconnected by request."
    return status


@router.get("/terminal-path")
def get_terminal_path():
    """Return the locally saved or auto-detected MT5 terminal path."""
    return terminal_path_status()


@router.post("/terminal-path")
def update_terminal_path(payload: MT5TerminalPathInput):
    """Validate and save the MT5 executable path on the machine running this backend."""
    try:
        path = save_terminal_path(payload.path)
        # Do not restart an active terminal session just because its preferred path changed.
        return {"success": True, "terminal": {"path": path, "detected": True, "source": "saved"}}
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
