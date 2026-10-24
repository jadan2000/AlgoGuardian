"""Authenticated management endpoints for the owner's single MT5 account."""
import os

from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException

from api.auth import require_authenticated_user
from services.mt5_credentials import CredentialStorageError, public_credentials, save_credentials
from services.mt5_service import MT5Service
from services.mt5_terminal_path import save_terminal_path, terminal_path_status

def require_mt5_admin(user: dict = Depends(require_authenticated_user)) -> dict:
    admin_email = (os.getenv("MT5_ACCOUNT_ADMIN_EMAIL") or "").strip().casefold()
    admin_user_id = (os.getenv("MT5_ACCOUNT_ADMIN_USER_ID") or "").strip()
    if not admin_email and not admin_user_id:
        raise HTTPException(status_code=503, detail="Set MT5_ACCOUNT_ADMIN_EMAIL or MT5_ACCOUNT_ADMIN_USER_ID in the backend environment before managing broker credentials.")
    if admin_email and str(user.get("email") or "").casefold() == admin_email:
        return user
    if admin_user_id and str(user.get("id") or "") == admin_user_id:
        return user
    raise HTTPException(status_code=403, detail="You are not authorized to manage this broker account.")


router = APIRouter(dependencies=[Depends(require_mt5_admin)])


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
    try:
        save_credentials(payload.login, payload.password, payload.server)
        MT5Service.shutdown()
        connected = MT5Service.connect()
        status = _safe_status()
        status["connected"] = connected
        if not connected:
            status["reason"] = "Credentials saved, but MT5 could not connect. Check the account number, password, server and terminal availability."
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
