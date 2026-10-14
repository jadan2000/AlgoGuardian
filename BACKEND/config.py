"""Environment configuration for the single-account MT5 development worker.

Keep real credentials in BACKEND/.env or the deployment secret store. Never commit
that file. Customer-specific credentials will require isolated worker processes and
must not be added to this process-wide configuration.
"""
from dotenv import load_dotenv
import os

load_dotenv()

_raw_login = (os.getenv("MT5_LOGIN") or "").strip()
try:
    MT5_LOGIN = int(_raw_login) if _raw_login else None
except ValueError:
    MT5_LOGIN = None

MT5_PASSWORD = os.getenv("MT5_PASSWORD") or None
MT5_SERVER = (os.getenv("MT5_SERVER") or "").strip() or None
MT5_PATH = (os.getenv("MT5_PATH") or "").strip() or None
