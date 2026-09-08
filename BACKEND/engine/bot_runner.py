import time
import json
import traceback
from pathlib import Path

from engine.signal_engine import SignalEngine
from engine.execution_engine import ExecutionEngine
from services import bot_state


def save_signal(signal):

    signals_file = (
        Path(__file__).resolve().parents[1]
        / "storage"
        / "signals.json"
    )

    signals_file.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    if signals_file.exists():
        try:
            with open(signals_file, "r", encoding="utf-8") as f:
                signals = json.load(f)
        except Exception:
            signals = []
    else:
        signals = []

    signal["timestamp"] = time.strftime(
        "%Y-%m-%d %H:%M:%S"
    )

    signals.append(signal)

    signals = signals[-20:]

    with open(
        signals_file,
        "w",
        encoding="utf-8"
    ) as f:
        json.dump(
            signals,
            f,
            indent=2
        )


def run_bot():

    print("=" * 60)
    print("BOT RUNNER STARTED")
    print("=" * 60)

    while True:

        print(
            f"[BOT] RUNNING={bot_state.BOT_RUNNING} | "
            f"PAUSED={bot_state.BOT_PAUSED} | "
            f"KILL={bot_state.KILL_SWITCH}"
        )

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

            else:

                print("[BOT] NO SIGNAL RETURNED")

        except Exception:

            print("=" * 60)
            print("BOT ERROR")
            traceback.print_exc()
            print("=" * 60)

        time.sleep(5)