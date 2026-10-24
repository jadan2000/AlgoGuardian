"""Pair and manage phone notifications for this local Windows installation."""
import hmac
import os

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from services.notification_devices import (
    NotificationRegistryError, list_devices, pairing_secret_configured,
    register_device, remove_device,
)

router = APIRouter()


class DeviceRegistration(BaseModel):
    token: str = Field(min_length=20, max_length=4096)
    device_name: str = Field(default="Android device", min_length=1, max_length=120)


class DeviceRemoval(BaseModel):
    token: str = Field(min_length=20, max_length=4096)


def _require_pairing_secret(supplied: str | None) -> None:
    expected = (os.getenv("NOTIFICATION_PAIRING_SECRET") or "").strip()
    if len(expected) < 32:
        raise HTTPException(status_code=503, detail="Phone pairing is not configured. Set a long random NOTIFICATION_PAIRING_SECRET in the private backend .env.")
    if not supplied or not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="Phone pairing code is invalid.")


@router.get("/status")
def notification_status():
    if not pairing_secret_configured():
        return {"configured": False, "paired_devices": 0}
    return {"configured": True, "paired_devices": len(list_devices())}


@router.get("/devices")
def get_devices(x_notification_pairing_secret: str | None = Header(default=None)):
    _require_pairing_secret(x_notification_pairing_secret)
    return {"devices": list_devices()}


@router.post("/devices")
def add_device(payload: DeviceRegistration, x_notification_pairing_secret: str | None = Header(default=None)):
    _require_pairing_secret(x_notification_pairing_secret)
    try:
        return register_device(payload.token, payload.device_name)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except NotificationRegistryError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.delete("/devices")
def delete_device(payload: DeviceRemoval, x_notification_pairing_secret: str | None = Header(default=None)):
    _require_pairing_secret(x_notification_pairing_secret)
    try:
        return {"removed": remove_device(payload.token)}
    except NotificationRegistryError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
