import time
import json
import traceback
from pathlib import Path

from engine.signal_engine import SignalEngine
from engine.execution_engine import ExecutionEngine
from services import bot_state


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

    while True:
        try:
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
                save_signal(signal)
                if signal.get("status") == "EXECUTED":
                    print("[BOT] EXECUTING SIGNAL")
                    result = ExecutionEngine().execute(signal)
                    print("EXECUTION RESULT:", result)

        except Exception:
            print("=" * 60)
            print("BOT ERROR")
            traceback.print_exc()
            print("=" * 60)

        # Five seconds is retained for the existing UI responsiveness, but the
        # signal engine uses only closed candles so the same candle cannot create
        # a second signal based on changing intrabar values.
        time.sleep(5)
