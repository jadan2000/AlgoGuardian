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
            signal = SignalEngine().generate_signal()
            print("SIGNAL RESULT:", signal)

            if signal:
                if signal.get("status") == "READY":
                    print("[BOT] SIGNAL READY; ATTEMPTING EXECUTION")
                    result = ExecutionEngine().execute(signal)
                    signal["execution_status"] = "EXECUTED" if result else "REJECTED"
                    if not result:
                        signal["execution_reason"] = "Execution engine rejected the order; see [ORDER]/[RISK] logs for the precise reason."
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
