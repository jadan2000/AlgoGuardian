"""Non-secret environment configuration for the MT5 development worker."""
from dotenv import load_dotenv
import os

load_dotenv()

# Optional absolute path to terminal64.exe; credentials are managed in Accounts.
MT5_PATH = (os.getenv("MT5_PATH") or "").strip() or None
