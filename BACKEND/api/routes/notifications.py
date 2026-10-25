"""Secure QR-based phone pairing for one local AlgoGuardian installation."""
import base64
import io
import json
import os
import socket

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from api.auth import require_authenticated_user
from services.notification_devices import (
    NotificationRegistryError, list_devices, register_device, remove_device,
)
from services.notification_pairing import consume_code, create_code
from services.notification_relay import (
    NotificationRelayError, ensure_registered, register_remote_device, remove_remote_device,
)

router = APIRouter()


class PairClaim(BaseModel):
    code: str = Field(min_length=8, max_length=128)
    token: str = Field(min_length=20, max_length=4096)
    device_name: str = Field(default="Android device", min_length=1, max_length=120)


class DeviceRemoval(BaseModel):
    token: str = Field(min_length=20, max_length=4096)


@router.post("/pairing-session")
def create_pairing_session(request: Request, _user: dict = Depends(require_authenticated_user)):
    """Create a short-lived code for a QR displayed by the signed-in Windows dashboard."""
    if not (os.getenv("NOTIFICATION_RELAY_URL") or "").strip().startswith("https://"):
        raise HTTPException(status_code=503, detail="Firebase notification relay is not configured. Set NOTIFICATION_RELAY_URL in the private backend .env and restart.")
    base_url = str(request.base_url).rstrip("/")
    hostname = request.url.hostname or ""
    if hostname.lower() in {"localhost", "127.0.0.1", "::1", "0.0.0.0"}:
        try:
            probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            try:
                probe.connect(("8.8.8.8", 80))
                hostname = probe.getsockname()[0]
            finally:
                probe.close()
            base_url = f"{request.url.scheme}://{hostname}:{request.url.port or 8000}"
        except OSError:
            # Keep the configured host if local interface discovery is unavailable.
            pass
    pairing = create_code(base_url)
    payload = json.dumps({
        "type": "algoguardian-pair",
        "backendUrl": pairing["backend_url"],
        "code": pairing["code"],
    }, separators=(",", ":"))
    try:
        import qrcode
        image = qrcode.make(payload)
        output = io.BytesIO()
        image.save(output, format="PNG")
    except Exception as exc:
        raise HTTPException(status_code=503, detail="QR generation is unavailable. Install the backend QR-code dependency and restart.") from exc
    return {
        "qr_data_url": "data:image/png;base64," + base64.b64encode(output.getvalue()).decode("ascii"),
        "expires_in_seconds": pairing["expires_in_seconds"],
    }


@router.post("/pair/claim")
def claim_pairing(payload: PairClaim):
    """Claim a one-time code; the code is consumed before remote calls to prevent replay."""
    pairing = consume_code(payload.code)
    if not pairing:
        raise HTTPException(status_code=401, detail="This QR pairing code expired or has already been used. Generate a new QR code on Windows.")
    try:
        ensure_registered()
        register_remote_device(payload.token, payload.device_name)
        result = register_device(payload.token, payload.device_name)
        return {"paired": True, **result}
    except NotificationRelayError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except NotificationRegistryError as exc:
        raise HTTPException(status_code=500, detail="Could not save the paired device on this PC.") from exc


@router.delete("/pair/unpair")
def unpair_device(payload: DeviceRemoval):
    """Remove the caller's current FCM token from this installation and the relay."""
    try:
        remove_remote_device(payload.token)
    except NotificationRelayError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    try:
        return {"removed": remove_device(payload.token)}
    except NotificationRegistryError as exc:
        raise HTTPException(status_code=500, detail="Could not update this PC's paired-device registry.") from exc


@router.get("/status")
def notification_status(_user: dict = Depends(require_authenticated_user)):
    try:
        return {"configured": (os.getenv("NOTIFICATION_RELAY_URL") or "").strip().startswith("https://"), "paired_devices": len(list_devices())}
    except NotificationRegistryError as exc:
        raise HTTPException(status_code=500, detail="Notification registry is unreadable.") from exc


@router.get("/devices")
def get_devices(_user: dict = Depends(require_authenticated_user)):
    try:
        return {"devices": list_devices()}
    except NotificationRegistryError as exc:
        raise HTTPException(status_code=500, detail="Notification registry is unreadable.") from exc
