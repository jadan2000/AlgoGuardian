"""Best-effort notification-only relay client; never carries trading or broker data."""
import threading

from services.notification_devices import registered_tokens
from services.notification_relay import NotificationRelayError, send_remote_notification

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


def _send(event: str, message: str) -> None:
    try:
        send_remote_notification(event, message[:240])
    except NotificationRelayError as exc:
        # Push failures are deliberately isolated from the trading loop.
        print(f"[FCM relay] Notification send failed: {exc}")


def send_push(event: str, message: str) -> None:
    """Send a notification asynchronously; failure never blocks trade execution."""
    if event not in _EVENT_TITLES:
        print(f"[FCM relay] Ignoring unknown notification event: {event}")
        return
    try:
        if not registered_tokens():
            return
    except Exception as exc:
        print(f"[FCM relay] Device registry unavailable: {type(exc).__name__}")
        return
    threading.Thread(
        target=_send,
        args=(event, message),
        name="firebase-notification-relay",
        daemon=True,
    ).start()
