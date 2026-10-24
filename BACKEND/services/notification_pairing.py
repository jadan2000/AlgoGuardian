"""Short-lived, single-use phone pairing codes, held only in local backend memory."""
import secrets
import threading
import time

_LOCK = threading.RLock()
_CODES: dict[str, dict] = {}
_TTL_SECONDS = 180


def create_code(backend_url: str) -> dict:
    now = time.monotonic()
    with _LOCK:
        for code in [key for key, value in _CODES.items() if value["expires_at"] <= now]:
            _CODES.pop(code, None)
        code = secrets.token_urlsafe(12)
        _CODES[code] = {"backend_url": backend_url.rstrip("/"), "expires_at": now + _TTL_SECONDS}
        return {"code": code, "backend_url": backend_url.rstrip("/"), "expires_in_seconds": _TTL_SECONDS}


def consume_code(code: str) -> dict | None:
    now = time.monotonic()
    with _LOCK:
        item = _CODES.pop(code, None)
        if not item or item["expires_at"] <= now:
            return None
        return {"backend_url": item["backend_url"]}
