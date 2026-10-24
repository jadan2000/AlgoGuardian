import time
import json
import traceback
from pathlib import Path

from engine.signal_engine import SignalEngine
from engine.execution_engine import ExecutionEngine
from services import bot_state
from services.firebase_notifications import send_push
from services.experiment_journal import (
    record_error,
    record_execution,
    record_signal,
    run_checkpoint_if_due,
)


SIGNALS_FILE = Path(__file__).resolve().parents[1] / "storage" / "signals.json"

# Prevent the five-second runner from repeatedly alerting for the same blocked setup.
_NOTIFIED_SETTINGS_REJECTIONS = set()
_MAX_REJECTION_KEYS = 200


def _settings_rejection(reason):
    text = str(reason or "").upper()
    markers = (
        "RISK MANAGER BLOCKED THE ORDER:",
        "MAX OPEN POSITIONS:",
        "STOP LOSS AND TAKE PROFIT MUST BE POSITIVE SETTINGS VALUES",
        "CONFIGURED STOP LOSS/TAKE PROFIT IS BELOW BROKER MINIMUM",
        "LOT SIZE CAP MUST BE GREATER THAN ZERO",
        "CALCULATED VOLUME IS BELOW BROKER MINIMUM",
        "REQUESTED VOLUME",
        "VOLUME COULD NOT BE NORMALIZED TO BROKER STEP",
    )
    return any(marker in text for marker in markers)


def save_signal(signal):
    SIGNALS_FILE.parent.mkdir(parents=True, exist_ok=True)
    try:
        with SIGNALS_FILE.open("r", encoding="utf-8") as f:
            signals = json.load(f)
            if not isinstance(signals, list):
                signals = []
    except (json.JSONDecodeError, OSError):
        signals = []

    signal = dict(signal)
    reason = str(signal.get("reason") or "")
    # The runner scans every five seconds. Do not fill the Logs panel with
    # identical cooldown notices while the same cooldown is still active.
    if (
        signal.get("status") == "BLOCKED"
        and reason.startswith("COOLDOWN BETWEEN ENTRIES")
        and signals
        and signals[-1].get("status") == "BLOCKED"
        and signals[-1].get("reason") == reason
    ):
        return False

    signal["timestamp"] = time.strftime("%Y-%m-%d %H:%M:%S")
    signals.append(signal)

    with SIGNALS_FILE.open("w", encoding="utf-8") as f:
        json.dump(signals[-10:], f, indent=2)
    return True


def run_bot():
    print("=" * 60)
    print("BOT RUNNER STARTED")
    print("=" * 60)

    cycle_id = run_checkpoint_if_due()

    while True:
        try:
            # Checkpointing is deliberately separate from strategy execution.
            # It records the paper experiment every two hours without changing
            # the strategy or hot-reloading code inside the live process.
            cycle_id = run_checkpoint_if_due() or cycle_id

            if bot_state.KILL_SWITCH:
                print("[BOT] KILL SWITCH ACTIVE")
                time.sleep(2)
                continue

            if bot_state.BOT_PAUSED:
                print("[BOT] BOT PAUSED")
                time.sleep(2)
                continue

            if not bot_state.BOT_RUNNING:
                print("[BOT] BOT NOT RUNNING")
                time.sleep(2)
                continue

            print("[BOT] GENERATING SIGNAL...")
            signal_engine = SignalEngine()
            signal = signal_engine.generate_signal()
            print("SIGNAL RESULT:", signal)

            if signal:
                if signal.get("status") == "READY":
                    print("[BOT] SIGNAL READY; ATTEMPTING EXECUTION")
                    execution_engine = ExecutionEngine()
                    result = execution_engine.execute(signal)
                    signal["execution_status"] = "EXECUTED" if result else "REJECTED"
                    if not result:
                        reason = getattr(execution_engine, "last_error", None) or "Order was rejected; inspect the MT5 retcode and broker comment in the logs."
                        signal["execution_reason"] = reason
                        signal["fix"] = getattr(execution_engine, "last_fix", None) or "Use the rejection details to correct the relevant Settings value, account condition, or MT5 connection issue. Do not increase risk just to force an order."
                        if _settings_rejection(reason):
                            rejection_key = (str(signal.get("symbol") or signal.get("pair") or ""), str(signal.get("signal") or signal.get("type") or signal.get("direction") or ""), reason)
                            if rejection_key not in _NOTIFIED_SETTINGS_REJECTIONS:
                                if len(_NOTIFIED_SETTINGS_REJECTIONS) >= _MAX_REJECTION_KEYS:
                                    _NOTIFIED_SETTINGS_REJECTIONS.clear()
                                _NOTIFIED_SETTINGS_REJECTIONS.add(rejection_key)
                                send_push("order_rejected_settings")
                    print("EXECUTION RESULT:", result)
                    record_execution(cycle_id, signal, result)
                    if result:
                        symbol = str(signal.get("symbol") or signal.get("pair") or "trade")
                        side = str(signal.get("signal") or signal.get("type") or signal.get("direction") or "").upper()
                        send_push("trade_opened", "Automated " + side + " " + symbol + " order opened.")
                saved = save_signal(signal)
                if saved:
                    record_signal(cycle_id, signal)

        except Exception as exc:
            error_reason = f"BOT ERROR: {type(exc).__name__}: {exc}"
            error_signal = {
                "status": "BLOCKED",
                "reason": error_reason,
                "fix": "Check the backend terminal for the full traceback. Correct the reported configuration, dependency, data, or MT5 issue, then restart the backend. If this repeats, share the full error log for diagnosis.",
                "confidence": 0,
            }
            try:
                saved = save_signal(error_signal)
                if saved:
                    record_signal(cycle_id, error_signal)
            except Exception:
                pass
            record_error(cycle_id, f"{type(exc).__name__}: {exc}\\n{traceback.format_exc()}")
            print("=" * 60)
            print("BOT ERROR")
            traceback.print_exc()
            print("=" * 60)

        # Five seconds is retained for existing UI responsiveness. Signal
        # generation uses closed candles, so the same candle cannot create
        # a second signal from changing intrabar values.
        time.sleep(5)
