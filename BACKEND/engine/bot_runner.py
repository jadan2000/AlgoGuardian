import time
import json
import traceback
from pathlib import Path

from engine.signal_engine import SignalEngine
from engine.execution_engine import ExecutionEngine
from services import bot_state
from services.experiment_journal import (
    record_error,
    record_execution,
    record_signal,
    run_checkpoint_if_due,
)


SIGNALS_FILE = Path(__file__).resolve().parents[1] / "storage" / "signals.json"


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
    signal["timestamp"] = time.strftime("%Y-%m-%d %H:%M:%S")
    signals.append(signal)

    with SIGNALS_FILE.open("w", encoding="utf-8") as f:
        json.dump(signals[-20:], f, indent=2)


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
                    print("EXECUTION RESULT:", result)
                    record_execution(cycle_id, signal, result)
                save_signal(signal)
                record_signal(cycle_id, signal)

        except Exception as exc:
            record_error(cycle_id, f"{type(exc).__name__}: {exc}\n{traceback.format_exc()}")
            print("=" * 60)
            print("BOT ERROR")
            traceback.print_exc()
            print("=" * 60)

        # Five seconds is retained for existing UI responsiveness. Signal
        # generation uses closed candles, so the same candle cannot create a
        # second signal from changing intrabar values.
        time.sleep(5)
