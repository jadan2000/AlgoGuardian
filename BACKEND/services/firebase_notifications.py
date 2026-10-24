"""Best-effort notification-only relay client; never carries trading or broker data."""
import threading

from services.notification_devices import registered_tokens
from services.notification_relay import NotificationRelayError, send_remote_notification

_EVENT_MESSAGES = {
    "engine_started": "AlgoGuardian trading engine was started.",
    "engine_stopped": "AlgoGuardian trading engine was stopped or paused.",
    "trade_opened": "A trade was opened by your local trading engine.",
    "trade_closed": "A trade was closed by your local trading engine.",
    "risk_limit_reached": "A configured risk limit was reached.",
    "daily_trade_limit_reached": "The daily trade limit was reached.",
    "mt5_disconnected": "The MT5 connection was lost.",
    "mt5_reconnected": "The MT5 connection was restored.",
    "notification_error": "The trading engine needs attention.",
}


def _send(event: str) -> None:
    try:
        # Only fixed generic messages leave the PC; never forward symbols,
        # order tickets, prices, strategy details, or caller-provided text.
        send_remote_notification(event, _EVENT_MESSAGES[event])
    except NotificationRelayError as exc:
        # Push failures are deliberately isolated from the trading loop.
        print(f"[FCM relay] Notification send failed: {exc}")


def send_push(event: str, _message: str = "") -> None:
    """Send a generic event asynchronously; ignore potentially sensitive caller text."""
    if event not in _EVENT_MESSAGES:
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
        args=(event,),
        name="firebase-notification-relay",
        daemon=True,
    ).start()
