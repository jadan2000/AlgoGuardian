"""Autonomous paper-trading supervisor.

Runs one-hour paper experiments. At each boundary it stops the bot, publishes
that experiment to GitHub, then waits for a new GitHub commit from the review
loop. Once a new commit appears, it pulls the update and starts the next
one-hour experiment. PAPER_TRADING is always forced to 1.
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
INTERVAL_SECONDS = int(os.getenv("PAPER_EXPERIMENT_SECONDS", "3600"))
POLL_SECONDS = int(os.getenv("PAPER_UPDATE_POLL_SECONDS", "60"))
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

    print("[SUPERVISOR] Pulled latest origin/main; runtime state preserved.")
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
    """Commit completed paper-experiment JSON files and push them to GitHub."""
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


def wait_for_review_commit(baseline_commit):
    """Poll GitHub until the review loop publishes a new commit."""
    print("[SUPERVISOR] Waiting for the next review/update commit on GitHub...")
    while True:
        remote = latest_remote_commit()
        if remote and remote != baseline_commit:
            print(f"[SUPERVISOR] New remote commit detected: {remote}")
            return remote
        print(f"[SUPERVISOR] No update yet; checking again in {POLL_SECONDS}s.")
        time.sleep(POLL_SECONDS)


def main():
    print("=" * 70)
    print("AUTONOMOUS PAPER TRADING SUPERVISOR STARTED")
    print(f"Experiment window: {INTERVAL_SECONDS} seconds")
    print(f"GitHub update polling: every {POLL_SECONDS} seconds while stopped")
    print("Flow: TEST -> STOP -> PUBLISH -> WAIT FOR REVIEW COMMIT -> PULL -> TEST")
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

            if not publish_completed_cycles():
                print("[SUPERVISOR] Could not publish this cycle; stopping for safety.")
                stop_server(process)
                while not publish_completed_cycles():
                    time.sleep(POLL_SECONDS)

            # The bot stays stopped until the external review loop publishes a
            # new commit. This prevents it from starting another test against
            # stale code before the analysis/update has happened.
            stop_server(process)
            baseline = current_commit()
            wait_for_review_commit(baseline)

            if not update_to_remote():
                print("[SUPERVISOR] Update failed; keeping bot stopped and retrying in 60s.")
                while not update_to_remote():
                    time.sleep(POLL_SECONDS)

            process = start_server()
            window_started = time.monotonic()
            print(f"[SUPERVISOR] New one-hour window started on commit {current_commit()}")

    except KeyboardInterrupt:
        print("[SUPERVISOR] Stopping autonomous paper trading supervisor...")
    finally:
        stop_server(process)


if __name__ == "__main__":
    main()
