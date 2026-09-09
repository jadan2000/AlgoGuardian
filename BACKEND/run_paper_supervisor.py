"""Paper-trading supervisor with a GitHub review handshake.

The bot runs for one hour, stops, publishes the completed experiment, and then
waits. While stopped it polls GitHub once per minute. A new REVIEW_COMPLETE
marker is required before the next test starts. This prevents clock drift from
causing a test to start before the completed cycle has been reviewed.

PAPER_TRADING is always forced to 1.
"""

import os
import signal
import subprocess
import sys
import time
from pathlib import Path

BASE = Path(__file__).resolve().parent
ROOT = BASE.parent
INTERVAL_SECONDS = int(os.getenv("PAPER_EXPERIMENT_SECONDS", "3600"))
POLL_SECONDS = 60
RUNTIME_PREFIX = "BACKEND/storage/"
JOURNAL_DIR = "BACKEND/storage/experiment_history"
CYCLE_GLOB = f"{JOURNAL_DIR}/cycle_*.json"
REVIEW_GLOB = f"{JOURNAL_DIR}/review_*.json"


def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, text=True, capture_output=True)


def current_commit():
    result = git("rev-parse", "HEAD")
    return result.stdout.strip() if result.returncode == 0 else None


def fetch_remote():
    result = git("fetch", "origin", "main", "--prune")
    if result.returncode != 0:
        print(f"[SUPERVISOR] git fetch failed: {result.stderr.strip()}")
        return False
    return True


def latest_remote_commit():
    if not fetch_remote():
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
        from services.experiment_journal import finish_cycle, _read, STATE_FILE
        state = _read(STATE_FILE, {})
        active = state.get("active_cycle")
        if active:
            finish_cycle(active)
            return int(active)
    except Exception as exc:
        print(f"[SUPERVISOR] Could not finalize journal: {exc}")
    return None


def publish_completed_cycle(cycle_id):
    """Publish exactly the finished cycle; do not publish running/state files."""
    if cycle_id is None:
        return False

    cycle_path = f"{JOURNAL_DIR}/cycle_{int(cycle_id):06d}.json"
    add = git("add", "-f", cycle_path)
    if add.returncode != 0:
        print(f"[SUPERVISOR] Could not stage completed cycle: {add.stderr.strip()}")
        return False

    staged = git("diff", "--cached", "--name-only", "--", cycle_path)
    if staged.returncode != 0 or not staged.stdout.strip():
        print("[SUPERVISOR] Completed cycle was not staged; refusing to continue.")
        return False

    commit = git("commit", "-m", f"PAPER DATA cycle {int(cycle_id):06d}")
    if commit.returncode != 0:
        print(f"[SUPERVISOR] Could not commit completed cycle: {commit.stderr.strip()}")
        return False

    push = git("push", "origin", "main")
    if push.returncode != 0:
        print(f"[SUPERVISOR] Could not publish cycle to GitHub: {push.stderr.strip()}")
        return False

    print(f"[SUPERVISOR] Published completed cycle {int(cycle_id):06d} to GitHub.")
    return True


def latest_review_for_cycle(cycle_id):
    if cycle_id is None:
        return None
    result = git("ls-tree", "-r", "--name-only", "origin/main", JOURNAL_DIR)
    if result.returncode != 0:
        return None
    prefix = f"{JOURNAL_DIR}/review_{int(cycle_id):06d}_"
    matches = [line.strip() for line in result.stdout.splitlines() if line.strip().startswith(prefix) and line.strip().endswith(".json")]
    return matches[-1] if matches else None


def wait_for_review(cycle_id):
    """Wait until the remote contains a review marker for this exact cycle."""
    print(f"[SUPERVISOR] Waiting for review of cycle {int(cycle_id):06d}...")
    while True:
        remote = latest_remote_commit()
        if remote:
            review = latest_review_for_cycle(cycle_id)
            if review:
                print(f"[SUPERVISOR] Review detected: {review}")
                return remote
        print("[SUPERVISOR] No review yet; checking GitHub again in 60 seconds.")
        time.sleep(POLL_SECONDS)


def main():
    print("=" * 70)
    print("PAPER TRADING SUPERVISOR STARTED")
    print(f"Experiment window: {INTERVAL_SECONDS} seconds")
    print("After each window: STOP -> PUBLISH -> WAIT FOR REVIEW -> PULL -> START")
    print("GitHub is polled every 60 seconds while waiting")
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

            print("[SUPERVISOR] Experiment window complete; STOPPING server.")
            stop_server(process)

            cycle_id = finalize_active_cycle()
            if not publish_completed_cycle(cycle_id):
                print("[SUPERVISOR] Publish failed. Staying stopped; will retry every minute.")
                while not publish_completed_cycle(cycle_id):
                    time.sleep(POLL_SECONDS)

            # Do not start another test until a reviewer has acknowledged this
            # exact completed cycle. A code update and a no-change review both
            # satisfy the handshake via review_XXXXXX_*.json.
            wait_for_review(cycle_id)

            print("[SUPERVISOR] Review complete; pulling latest code before restart.")
            if not update_to_remote():
                print("[SUPERVISOR] Pull failed. Staying stopped; retrying in 60 seconds.")
                while not update_to_remote():
                    time.sleep(POLL_SECONDS)

            process = start_server()
            window_started = time.monotonic()
            print(f"[SUPERVISOR] New one-hour test started on commit {current_commit()}")

    except KeyboardInterrupt:
        print("[SUPERVISOR] Stopping paper trading supervisor...")
    finally:
        stop_server(process)


if __name__ == "__main__":
    main()
