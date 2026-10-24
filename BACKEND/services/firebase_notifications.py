"""Firebase Cloud Messaging sender for this local AlgoGuardian installation.

Device tokens are read from a per-installation registry on the Windows PC.
Never use a shared token list across customers or copy the registry between PCs.
"""
import os
import threading
from functools import lru_cache

from services.notification_devices import registered_tokens

_EVENT_TITLES = {
    "engine_started": "AlgoGuardian started",
    "engine_stopped": "AlgoGuardian stopped",
    "trade_opened": "Trade opened",
    "trade_closed": "Trade closed",
    "risk_limit_reached": "Risk limit reached",
    "daily_trade_limit_reached": "Daily trade limit reached",
    "mt5_disconnected": "MT5 connection lost",
    "mt5_reconnected": "MT5 reconnected",
    "notification_error": "AlgoGuardian needs attention",
}


@lru_cache(maxsize=1)
def _firebase_app():
    import firebase_admin
    from firebase_admin import credentials

    credential_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    if not credential_path:
        raise RuntimeError("GOOGLE_APPLICATION_CREDENTIALS is not configured")
    credential = credentials.Certificate(credential_path)
    try:
        return firebase_admin.get_app()
    except ValueError:
        return firebase_admin.initialize_app(credential)


def _send(event: str, message: str) -> None:
    try:
        tokens = registered_tokens()
        if not tokens:
            return
        from firebase_admin import messaging

        app = _firebase_app()
        title = _EVENT_TITLES.get(event, "AlgoGuardian alert")
        # The registry is local to this Windows installation. Every phone here
        # belongs to the customer who owns this engine/account.
        for start in range(0, len(tokens), 500):
            chunk = tokens[start : start + 500]
            payload = messaging.MulticastMessage(
                tokens=chunk,
                notification=messaging.Notification(title=title, body=message[:240]),
                data={"event": event},
                android=messaging.AndroidConfig(
                    priority="high",
                    notification=messaging.AndroidNotification(
                        channel_id="algoguardian-alerts",
                        sound="default",
                    ),
                ),
            )
            result = messaging.send_each_for_multicast(payload, app=app)
            for index, response in enumerate(result.responses):
                if not response.success:
                    print(f"[FCM] Delivery failed for local device index {start + index}: {response.exception}")
    except Exception as exc:
        print(f"[FCM] Notification send failed: {type(exc).__name__}: {exc}")


def send_push(event: str, message: str) -> None:
    """Start a best-effort push send without blocking trading logic."""
    if event not in _EVENT_TITLES:
        print(f"[FCM] Ignoring unknown notification event: {event}")
        return
    try:
        if not registered_tokens():
            return
    except Exception as exc:
        print(f"[FCM] Device registry unavailable: {type(exc).__name__}: {exc}")
        return
    threading.Thread(
        target=_send,
        args=(event, message),
        name="firebase-push-notification",
        daemon=True,
    ).start()
