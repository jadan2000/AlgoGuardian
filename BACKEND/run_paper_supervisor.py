"""Two-hour paper-trading supervisor.

Run this process instead of `python main.py` for unattended paper testing.
It keeps the API/bot process alive for two-hour experiment windows, records
an immutable journal checkpoint, checks origin/main, and restarts on a new
commit. Runtime JSON state is preserved across code updates.
"""

import os
import signal
import subprocess
import sys
import time
from pathlib import Path

from services.experiment_journal import finish_cycle

BASE = Path(__file__).resolve().parent
ROOT = BASE.parent
INTERVAL_SECONDS = 7200
RUNTIME_PREFIX = "BACKEND/storage/"


def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, text=True, capture_output=True)


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


def runtime_status_lines():
    result = git("status", "--porcelain")
    if result.returncode != 0:
        return None, result.stderr.strip()
    lines = [line for line in result.stdout.splitlines() if line]
    return lines, None


def update_to_remote():
    lines, error = runtime_status_lines()
    if error:
        print(f"[SUPERVISOR] Could not inspect git state: {error}")
        return False

    runtime_changes = [line for line in lines if line[3:].startswith(RUNTIME_PREFIX)]
    source_changes = [line for line in lines if not line[3:].startswith(RUNTIME_PREFIX)]

    if source_changes:
        print("[SUPERVISOR] Source tree has local changes; refusing automatic code update.")
        print("[SUPERVISOR] Source changes:", source_changes)
        return False

    had_runtime_changes = bool(runtime_changes)
    if had_runtime_changes:
        stash = git("stash", "push", "-m", "paper-runtime-before-update", "--", RUNTIME_PREFIX)
        if stash.returncode != 0:
            print(f"[SUPERVISOR] Runtime stash failed: {stash.stderr.strip()}")
            return False

    pull = git("pull", "--ff-only", "origin", "main")
    if pull.returncode != 0:
        print(f"[SUPERVISOR] git pull failed: {pull.stderr.strip()}")
        if had_runtime_changes:
            git("stash", "pop")
        return False

    if had_runtime_changes:
        restore = git("stash", "pop")
        if restore.returncode != 0:
            print("[SUPERVISOR] WARNING: runtime stash could not be restored automatically.")
            print(restore.stderr.strip())
            return False

    print("[SUPERVISOR] Updated to latest origin/main; runtime state preserved.")
    return True


def finalize_active_cycle():
    try:
        from services.experiment_journal import _read, STATE_FILE
        state = _read(STATE_FILE, {})
        active = state.get("active_cycle")
        if active:
            finish_cycle(active)
    except Exception as exc:
        print(f"[SUPERVISOR] Could not finalize journal: {exc}")


def main():
    print("=" * 70)
    print("PAPER TRADING SUPERVISOR STARTED")
    print("Two-hour immutable experiment windows enabled")
    print("GitHub main checked at every window boundary")
    print("=" * 70)

    process = start_server()
    window_started = time.monotonic()

    try:
        while True:
            if process.poll() is not None:
                print(f"[SUPERVISOR] Server exited with code {process.returncode}; restarting.")
                process = start_server()
                window_started = time.monotonic()

            remaining = INTERVAL_SECONDS - (time.monotonic() - window_started)
            if remaining > 0:
                time.sleep(min(30, remaining))
                continue

            finalize_active_cycle()
            remote = latest_remote_commit()
            local = current_commit()
            print(f"[SUPERVISOR] Local={local} Remote={remote}")

            stop_server(process)
            if remote and local and remote != local:
                update_to_remote()
            else:
                print("[SUPERVISOR] No new commit; continuing current code version.")

            process = start_server()
            window_started = time.monotonic()
            print(f"[SUPERVISOR] New window started on commit {current_commit()}")

    except KeyboardInterrupt:
        print("[SUPERVISOR] Stopping paper trading supervisor...")
    finally:
        stop_server(process)


if __name__ == "__main__":
    main()
