"""Authenticated management endpoints for the owner's single MT5 account."""
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException

from api.auth import require_authenticated_user
from services.mt5_credentials import CredentialStorageError, public_credentials, save_credentials
from services.mt5_service import MT5Service

router = APIRouter(dependencies=[Depends(require_authenticated_user)])


class MT5CredentialsInput(BaseModel):
    login: int = Field(gt=0)
    password: str = Field(min_length=1, max_length=256)
    server: str = Field(min_length=1, max_length=160)


def _safe_status() -> dict:
    details = MT5Service.connection_status()
    return {
        **public_credentials(),
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
