"""Persistent per-installation identity for the notification-only Firebase relay."""
import json
import os
import secrets
import threading
import uuid
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

_IDENTITY_FILE = Path(__file__).resolve().parents[1] / "storage" / "notification_identity.json"
_LOCK = threading.RLock()


class NotificationRelayError(RuntimeError):
    pass


def _read_or_create_identity() -> dict:
    with _LOCK:
        if _IDENTITY_FILE.exists():
            try:
                data = json.loads(_IDENTITY_FILE.read_text(encoding="utf-8"))
                if isinstance(data, dict) and data.get("installation_id") and data.get("installation_secret"):
                    return data
            except (OSError, json.JSONDecodeError):
                raise NotificationRelayError("Local notification identity is unreadable; refusing to replace it.")
        data = {
            "installation_id": str(uuid.uuid4()),
            "installation_secret": secrets.token_urlsafe(48),
        }
        _IDENTITY_FILE.parent.mkdir(parents=True, exist_ok=True)
        temporary = _IDENTITY_FILE.with_suffix(".tmp")
        try:
            with temporary.open("w", encoding="utf-8") as handle:
                json.dump(data, handle)
                handle.flush()
                os.fsync(handle.fileno())
            try:
                os.chmod(temporary, 0o600)
            except OSError:
                pass
            temporary.replace(_IDENTITY_FILE)
        finally:
            temporary.unlink(missing_ok=True)
        return data


def _relay_url() -> str:
    value = (os.getenv("NOTIFICATION_RELAY_URL") or "").strip().rstrip("/")
    if not value.startswith("https://"):
        raise NotificationRelayError("Set NOTIFICATION_RELAY_URL to the HTTPS URL of the deployed Firebase notification relay.")
    return value


def relay_post(path: str, payload: dict) -> dict:
    identity = _read_or_create_identity()
    body = {**payload, **identity}
    request = Request(
        _relay_url() + path,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=8) as response:
            result = json.loads(response.read().decode("utf-8") or "{}")
            return result if isinstance(result, dict) else {}
    except HTTPError as exc:
        detail = exc.read(1024).decode("utf-8", errors="replace")
        raise NotificationRelayError(f"Notification relay rejected the request (HTTP {exc.code}).") from exc
    except (URLError, TimeoutError, OSError, json.JSONDecodeError) as exc:
        raise NotificationRelayError(f"Notification relay is unavailable: {type(exc).__name__}.") from exc


def ensure_registered() -> None:
    relay_post("/v1/installations/register", {})


def register_remote_device(token: str, device_name: str) -> None:
    relay_post("/v1/devices/register", {"token": token, "device_name": device_name})


def remove_remote_device(token: str) -> None:
    relay_post("/v1/devices/remove", {"token": token})


def send_remote_notification(event: str, message: str) -> None:
    relay_post("/v1/notifications/send", {"event": event, "message": message[:240]})
