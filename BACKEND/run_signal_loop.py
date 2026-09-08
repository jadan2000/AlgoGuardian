"""Optional standalone signal diagnostic loop.

The production backend uses engine.bot_runner.run_bot. This file only runs
signal generation for manual diagnostics and does not execute trades.
"""

import time

from engine.signal_engine import SignalEngine


def main():
    engine = SignalEngine()
    while True:
        print("\n" + "=" * 60)
        signal = engine.generate_signal()
        print("RESULT:", signal)
        time.sleep(5)


if __name__ == "__main__":
    main()
