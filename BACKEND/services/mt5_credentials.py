"""Encrypted storage for the single MT5 account managed through Accounts."""
import json
import os
from pathlib import Path
from threading import RLock

from cryptography.fernet import Fernet, InvalidToken

_STORAGE_FILE = Path(__file__).resolve().parents[1] / "storage" / "mt5_credentials.enc"
_LOCK = RLock()


class CredentialStorageError(RuntimeError):
    pass


def _fernet():
    key = (os.getenv("MT5_CREDENTIALS_ENCRYPTION_KEY") or "").strip()
    if not key:
        raise CredentialStorageError("MT5_CREDENTIALS_ENCRYPTION_KEY is missing. Configure it in the backend environment.")
    try:
        return Fernet(key.encode("ascii"))
    except (ValueError, UnicodeEncodeError) as exc:
        raise CredentialStorageError("MT5_CREDENTIALS_ENCRYPTION_KEY is invalid.") from exc


def credentials_configured() -> bool:
    return _STORAGE_FILE.is_file()


def load_credentials() -> dict | None:
    with _LOCK:
        if not _STORAGE_FILE.exists():
            return None
        try:
            decoded = _fernet().decrypt(_STORAGE_FILE.read_bytes())
            value = json.loads(decoded.decode("utf-8"))
            login, password, server = int(value["login"]), str(value["password"]), str(value["server"]).strip()
            if login <= 0 or not password or not server:
                raise ValueError("invalid credential fields")
            return {"login": login, "password": password, "server": server}
        except InvalidToken as exc:
            raise CredentialStorageError("Saved credentials could not be decrypted. Check that the encryption key has not changed.") from exc
        except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
            raise CredentialStorageError("Saved MT5 credentials are unreadable.") from exc


def save_credentials(login: int, password: str, server: str) -> None:
    if login <= 0 or not password.strip() or not server.strip():
        raise ValueError("Account number, password and server are required.")
    payload = json.dumps({"login": login, "password": password, "server": server.strip()}, separators=(",", ":")).encode("utf-8")
    encrypted = _fernet().encrypt(payload)
    with _LOCK:
        _STORAGE_FILE.parent.mkdir(parents=True, exist_ok=True)
        temporary = _STORAGE_FILE.with_suffix(".tmp")
        try:
            with temporary.open("wb") as handle:
                handle.write(encrypted)
                handle.flush()
                os.fsync(handle.fileno())
            try:
                os.chmod(temporary, 0o600)
            except OSError:
                pass
            temporary.replace(_STORAGE_FILE)
            try:
                os.chmod(_STORAGE_FILE, 0o600)
            except OSError:
                pass
        finally:
            if temporary.exists():
                temporary.unlink(missing_ok=True)


def public_credentials() -> dict:
    credentials = load_credentials()
    if not credentials:
        return {"configured": False, "login": None, "server": None}
    return {"configured": True, "login": credentials["login"], "server": credentials["server"]}
