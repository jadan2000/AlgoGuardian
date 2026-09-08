from dotenv import load_dotenv
import os

load_dotenv()

login = os.getenv("MT5_LOGIN")

if login is None:
    raise ValueError("MT5_LOGIN is not set in your .env file")

MT5_LOGIN = int(login)

MT5_PASSWORD = os.getenv("MT5_PASSWORD")
MT5_SERVER = os.getenv("MT5_SERVER")
MT5_PATH = os.getenv("MT5_PATH")