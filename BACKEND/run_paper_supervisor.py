"""Two-hour paper-trading supervisor.

Run this process instead of `python main.py` for unattended paper testing.
It keeps the API/bot process alive for two-hour experiment windows, records
an immutable journal checkpoint, checks origin/main, and only restarts after a
new clean commit is available. It never deploys to live trading.

Requirements:
- the working tree must be clean for automatic updates
- git authentication for the private repository must already work locally
- run from BACKEND or with this file's directory as the working directory
"""

import os
import signal
import subprocess
import sys
import time
from pathlib import Path

from services.experiment_journal import finish_cycle

BASE = Path(__file__).resolve().parent
INTERVAL_SECONDS = 7200


def git(*args):
    return subprocess.run(
        ["git", *args], cwd=BASE, text=True, capture_output=True
    )


def current_commit():
    result = git("rev-parse", "HEAD")
    return result.stdout.strip() if result.returncode == 0 else None


def latest_remote_commit():
    fetch = git("fetch", "origin", "main", "--prune")
    if fetch.returncode != 0:
        print(f"[SUPERVISOR] git fetch failed: {fetch.stderr.strip()}")
        return None
    result = git("rev-parse", "origin/main")
    return result.stdout.strip() if result.returncode == 0 else None


def working_tree_clean():
    result = git("status", "--porcelain")
    return result.returncode == 0 and not result.stdout.strip()


def start_server():
    env = os.environ.copy()
    env["PAPER_TRADING"] = "1"
    return subprocess.Popen([sys.executable, "main.py"], cwd=BASE, env=env)


def stop_server(process):
    if process.poll() is not None:
        return
    if os.name == "nt":
        process.terminate()
    else:
        process.send_signal(signal.SIGTERM)
    try:
        process.wait(timeout=20)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=10)


def update_to_remote():
    if not working_tree_clean():
        print("[SUPERVISOR] Working tree is not clean; refusing automatic git pull.")
        return False
    result = git("pull", "--ff-only", "origin", "main")
    if result.returncode != 0:
        print(f"[SUPERVISOR] git pull failed: {result.stderr.strip()}")
        return False
    print("[SUPERVISOR] Updated to latest origin/main.")
    return True


def main():
    print("=" * 70)
    print("PAPER TRADING SUPERVISOR STARTED")
    print("Two-hour immutable experiment windows enabled")
    print("=" * 70)

    process = start_server()
    window_started = time.monotonic()
    last_commit = current_commit()

    try:
        while True:
            if process.poll() is not None:
                print(f"[SUPERVISOR] Server exited with code {process.returncode}; restarting.")
                process = start_server()
                window_started = time.monotonic()
                last_commit = current_commit()

            remaining = INTERVAL_SECONDS - (time.monotonic() - window_started)
            if remaining > 0:
                time.sleep(min(30, remaining))
                continue

            # Complete the current journal window before changing code.
            try:
                from services.experiment_journal import _read, STATE_FILE
                state = _read(STATE_FILE, {})
                active = state.get("active_cycle")
                if active:
                    finish_cycle(active)
            except Exception as exc:
                print(f"[SUPERVISOR] Could not finalize journal: {exc}")

            remote = latest_remote_commit()
            local = current_commit()
            print(f"[SUPERVISOR] Local={local} Remote={remote}")

            stop_server(process)

            if remote and local and remote != local:
                if not update_to_remote():
                    print("[SUPERVISOR] Keeping current version because update was unsafe/failed.")
            else:
                print("[SUPERVISOR] No new commit; starting another window on the same version.")

            process = start_server()
            window_started = time.monotonic()
            last_commit = current_commit()
            print(f"[SUPERVISOR] New window started on commit {last_commit}")

    except KeyboardInterrupt:
        print("[SUPERVISOR] Stopping paper trading supervisor...")
    finally:
        stop_server(process)


if __name__ == "__main__":
    main()
