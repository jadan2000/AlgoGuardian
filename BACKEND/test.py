import MetaTrader5 as mt5

print("Initialize:", mt5.initialize())

if mt5.initialize():
    print(mt5.account_info())
else:
    print("Error:", mt5.last_error())

mt5.shutdown()