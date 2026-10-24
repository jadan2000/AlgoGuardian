"""Best-effort notification-only relay client; never carries trading or broker data."""
import threading

from services.notification_relay import NotificationRelayError, send_remote_notification

_EVENT_MESSAGES = {
    "engine_started": "AlgoGuardian trading engine was started.",
    "engine_paused": "AlgoGuardian bot was paused.",
    "kill_switch_activated": "AlgoGuardian kill switch was activated. Trading is disabled.",
    "trade_opened": "A trade was opened by your local trading engine.",
    "trade_closed": "A trade was closed by your local trading engine.",
    "order_rejected_settings": "An order was blocked by AlgoGuardian settings or risk rules.",
}


def _send(event: str) -> None:
    try:
        # The Supabase relay is the source of truth for remotely paired phones.
        # Only fixed generic messages leave the PC; never forward symbols,
        # order tickets, prices, strategy details, or caller-provided text.
        result = send_remote_notification(event, _EVENT_MESSAGES[event])
        print(f"[FCM relay] Send request completed for {event}: {result}")
    except NotificationRelayError as exc:
        # Push failures are deliberately isolated from the trading loop.
        print(f"[FCM relay] Notification send failed for {event}: {exc}")
    except Exception as exc:
        # Unexpected notification failures must also never stop trading.
        print(f"[FCM relay] Unexpected send failure for {event}: {type(exc).__name__}")


def send_push(event: str, _message: str = "") -> None:
    """Send a generic event through the remote relay, without local-token gating."""
    if event not in _EVENT_MESSAGES:
        print(f"[FCM relay] Ignoring unknown notification event: {event}")
        return
    threading.Thread(
        target=_send,
        args=(event,),
        name="firebase-notification-relay",
        daemon=True,
    ).start()
