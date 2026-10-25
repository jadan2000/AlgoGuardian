"""Local per-installation registry for FCM tokens.

This registry is deliberately stored on the customer's Windows PC, not shared
between customers. Never log device tokens or copy this file between installs.
"""
import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path

_REGISTRY_FILE = Path(__file__).resolve().parents[1] / "storage" / "notification_devices.json"
_LOCK = threading.RLock()
_MAX_DEVICES = 10


class NotificationRegistryError(RuntimeError):
    pass


def _read() -> list[dict]:
    if not _REGISTRY_FILE.exists():
        return []
    try:
        value = json.loads(_REGISTRY_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise NotificationRegistryError("Notification device registry is unreadable.") from exc
    if not isinstance(value, list):
        raise NotificationRegistryError("Notification device registry has an invalid format.")
    return [item for item in value if isinstance(item, dict) and isinstance(item.get("token"), str)]


def _write(devices: list[dict]) -> None:
    _REGISTRY_FILE.parent.mkdir(parents=True, exist_ok=True)
    temporary = _REGISTRY_FILE.with_suffix(".tmp")
    try:
        with temporary.open("w", encoding="utf-8") as handle:
            json.dump(devices, handle, indent=2)
            handle.flush()
            os.fsync(handle.fileno())
        try:
            os.chmod(temporary, 0o600)
        except OSError:
            pass
        temporary.replace(_REGISTRY_FILE)
        try:
            os.chmod(_REGISTRY_FILE, 0o600)
        except OSError:
            pass
    finally:
        temporary.unlink(missing_ok=True)


def register_device(token: str, device_name: str = "Android device") -> dict:
    token = token.strip()
    device_name = " ".join(device_name.split())[:80] or "Android device"
    if not 20 <= len(token) <= 4096:
        raise ValueError("The FCM device token is invalid.")
    now = datetime.now(timezone.utc).isoformat()
    with _LOCK:
        devices = _read()
        existing = next((item for item in devices if item.get("token") == token), None)
        if existing:
            existing["device_name"] = device_name
            existing["updated_at"] = now
            _write(devices)
            return {"registered": True, "device_name": device_name, "device_count": len(devices)}
        if len(devices) >= _MAX_DEVICES:
            raise ValueError(f"This installation can register at most {_MAX_DEVICES} phones.")
        devices.append({"token": token, "device_name": device_name, "created_at": now, "updated_at": now})
        _write(devices)
        return {"registered": True, "device_name": device_name, "device_count": len(devices)}


def remove_device(token: str) -> bool:
    with _LOCK:
        devices = _read()
        filtered = [item for item in devices if item.get("token") != token]
        if len(filtered) == len(devices):
            return False
        _write(filtered)
        return True


def list_devices() -> list[dict]:
    with _LOCK:
        return [
            {"device_name": item.get("device_name", "Android device"),
             "created_at": item.get("created_at"), "updated_at": item.get("updated_at")}
            for item in _read()
        ]


def registered_tokens() -> list[str]:
    with _LOCK:
        return [item["token"] for item in _read()]


def pairing_secret_configured() -> bool:
    return len((os.getenv("NOTIFICATION_PAIRING_SECRET") or "").strip()) >= 32
