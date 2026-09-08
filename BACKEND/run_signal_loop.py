
import time
from engine.signal_engine import SignalEngine

engine = SignalEngine()

while True:
    print("\n" + "=" * 60)
    signal = engine.generate_signal()
    print("RESULT:", signal)
    time.sleep(5)
