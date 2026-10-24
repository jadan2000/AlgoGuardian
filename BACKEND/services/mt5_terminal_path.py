"""Local MT5 terminal executable path, persisted on this computer."""
import json
import os
from pathlib import Path
from threading import RLock

_STORAGE_FILE = Path(__file__).resolve().parents[1] / "storage" / "mt5_terminal.json"
_LOCK = RLock()

DEFAULT_CANDIDATES = [
    r"C:\Program Files\MetaTrader 5\terminal64.exe",
    r"C:\Program Files (x86)\MetaTrader 5\terminal64.exe",
    r"C:\Program Files\MetaTrader 5\terminal.exe",
    r"C:\Program Files (x86)\MetaTrader 5\terminal.exe",
]


def detect_terminal_path() -> str | None:
    """Return a valid saved path, or the first common installation path found."""
    with _LOCK:
        if _STORAGE_FILE.is_file():
            try:
                data = json.loads(_STORAGE_FILE.read_text(encoding="utf-8"))
                saved = str(data.get("path") or "").strip()
                if saved and Path(saved).is_file():
                    return str(Path(saved))
            except (OSError, ValueError, TypeError):
                pass

    for candidate in DEFAULT_CANDIDATES:
        if Path(candidate).is_file():
            return candidate
    return None


def save_terminal_path(path: str) -> str:
    cleaned = os.path.expandvars(os.path.expanduser(path.strip().strip('"')))
    if not cleaned:
        raise ValueError("Enter the full path to terminal64.exe.")
    candidate = Path(cleaned)
    if candidate.name.casefold() not in {"terminal64.exe", "terminal.exe"}:
        raise ValueError("Select terminal64.exe (or terminal.exe for a 32-bit installation), not the folder.")
    if not candidate.is_file():
        raise ValueError("That executable was not found. Check the path and make sure MT5 is installed on this computer.")
    resolved = str(candidate.resolve())
    payload = json.dumps({"path": resolved}, indent=2)
    with _LOCK:
        _STORAGE_FILE.parent.mkdir(parents=True, exist_ok=True)
        temporary = _STORAGE_FILE.with_suffix(".tmp")
        try:
            temporary.write_text(payload, encoding="utf-8")
            temporary.replace(_STORAGE_FILE)
        finally:
            if temporary.exists():
                temporary.unlink(missing_ok=True)
    return resolved


def terminal_path_status() -> dict:
    path = detect_terminal_path()
    return {
        "path": path,
        "detected": bool(path),
        "source": "saved" if path and _STORAGE_FILE.is_file() else ("auto-detected" if path else "not-found"),
    }
