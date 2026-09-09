"""Paper-trading supervisor.

Default experiment windows are 2 hours. For a temporary flow test, set
PAPER_EXPERIMENT_SECONDS=600 (10 minutes). The supervisor always forces
PAPER_TRADING=1 and never enables live trading.
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
INTERVAL_SECONDS = int(os.getenv("PAPER_EXPERIMENT_SECONDS", "7200"))
RUNTIME_PREFIX = "BACKEND/storage/"
JOURNAL_GLOB = "BACKEND/storage/experiment_history/cycle_*.json"


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
    return [line for line in result.stdout.splitlines() if line], None


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
            return active
    except Exception as exc:
        print(f"[SUPERVISOR] Could not finalize journal: {exc}")
    return None


def publish_completed_cycles():
    """Commit completed paper-experiment JSON files and push them to GitHub.

    The journal directory remains ignored by default so runtime state is not
    accidentally committed. Completed cycle files are explicitly force-added
    here, making them retrievable by the remote GitHub connector for analysis.
    """
    add = git("add", "-f", JOURNAL_GLOB)
    if add.returncode != 0:
        print(f"[SUPERVISOR] Could not stage experiment history: {add.stderr.strip()}")
        return False

    staged = git("diff", "--cached", "--name-only", "--", JOURNAL_GLOB)
    if staged.returncode != 0:
        print(f"[SUPERVISOR] Could not inspect staged experiment history: {staged.stderr.strip()}")
        return False

    files = [line for line in staged.stdout.splitlines() if line.strip()]
    if not files:
        print("[SUPERVISOR] No new completed experiment files to publish.")
        return True

    message = f"[PAPER DATA] Publish {len(files)} completed experiment cycle(s)"
    commit = git("commit", "-m", message)
    if commit.returncode != 0:
        print(f"[SUPERVISOR] Could not commit experiment history: {commit.stderr.strip()}")
        return False

    push = git("push", "origin", "main")
    if push.returncode != 0:
        print(f"[SUPERVISOR] GitHub publish failed: {push.stderr.strip()}")
        print("[SUPERVISOR] Completed data remains committed locally and will be retried on the next window.")
        return False

    print(f"[SUPERVISOR] Published {len(files)} completed experiment file(s) to GitHub.")
    return True


def main():
    print("=" * 70)
    print("PAPER TRADING SUPERVISOR STARTED")
    print(f"Experiment window: {INTERVAL_SECONDS} seconds")
    print("GitHub main checked at every window boundary")
    print("Completed experiment data is published to GitHub")
    print("PAPER_TRADING=1 enforced")
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
                time.sleep(min(10, remaining))
                continue

            print("[SUPERVISOR] Experiment window complete; finalizing journal.")
            finalize_active_cycle()

            # Publish first so the experiment result becomes remotely
            # retrievable. If pushing fails, do not pull/update code in the
            # same boundary; the local commit will be retried next boundary.
            published = publish_completed_cycles()
            remote = latest_remote_commit()
            local = current_commit()
            print(f"[SUPERVISOR] Local={local} Remote={remote}")

            stop_server(process)
            if published and remote and local and remote != local:
                update_to_remote()
            elif not published:
                print("[SUPERVISOR] Skipping automatic code update because experiment data was not published.")
            else:
                print("[SUPERVISOR] No new code commit; continuing current code version.")

            process = start_server()
            window_started = time.monotonic()
            print(f"[SUPERVISOR] New window started on commit {current_commit()}")

    except KeyboardInterrupt:
        print("[SUPERVISOR] Stopping paper trading supervisor...")
    finally:
        stop_server(process)


if __name__ == "__main__":
    main()
