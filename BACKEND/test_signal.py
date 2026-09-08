from engine.signal_engine import SignalEngine
from engine.execution_engine import ExecutionEngine

signal = SignalEngine().generate_signal()

print("SIGNAL:", signal)

if signal:
    result = ExecutionEngine().execute(signal)
    print("TRADE RESULT:", result)
else:
    print("NO SIGNAL")