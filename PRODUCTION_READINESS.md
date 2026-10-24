# AlgoGuardian Production Readiness

## Required architecture (preserve this constraint)

Each customer runs one AlgoGuardian Windows installation connected to that customer's own MT5 terminal and account. Strategy evaluation, risk controls, broker credentials, and trade execution stay on that customer's PC. A cloud service may transport notification events only; it must not receive broker credentials, trading commands, prices, strategy state, or perform trade execution.

## Implemented in this branch

- A per-installation FCM token registry stored under `BACKEND/storage/notification_devices.json` and excluded from Git.
- Phone pairing endpoints protected by a unique per-installation secret.
- Android pairing UI stores the backend URL and pairing secret using Android secure storage.
- A phone can register and unpair its FCM token.
- The sender reads only tokens in the current local installation's registry, not a shared comma-separated environment variable.
- Unit tests for registry add/update/remove, token privacy in list responses, capacity limits, and corrupt storage.
- CI checks Python syntax and runs the registry unit tests.

## Release blockers — do not call this production-ready yet

1. **Move Firebase Admin credentials out of customer PCs.** The current direct sender still requires a privileged Firebase service-account JSON file on the Windows machine. Do not distribute one shared service-account key to customers. Replace this with a notification-only relay that stores the FCM service account server-side and authenticates each installation. The relay must resolve the installation identity and send only to devices registered to that installation. It must not implement trading.
2. **Authenticate all local control endpoints.** Existing bot controls, configuration, trades, logs, and account endpoints are not consistently protected. A user on the same network may be able to access or control the local engine. Add authenticated sessions/short-lived local authorization and protect all state-changing endpoints before public release.
3. **Secure pairing transport.** The current pairing API can be called over HTTP. A pairing secret sent over plain HTTP can be observed on an untrusted network. Use TLS-backed pairing or a short-lived, single-use pairing code with replay protection before customer rollout.
4. **Durable notification delivery.** Current sends are best-effort background threads. Add a durable notification-only queue, bounded retries, invalid-token cleanup, deduplication, and delivery/expiry policy. Notification failure must never block trade execution.
5. **Windows service lifecycle.** Add an installer and managed startup/shutdown, health monitoring, safe updates, crash recovery, and log rotation. Never restart the trading engine blindly while a trade is being submitted.
6. **End-to-end validation.** Test with a real Android device and MT5 demo account, including app closed, token rotation, revoked device, offline PC, FCM outage, broker disconnect, duplicate events, and a second customer installation. Confirm no notification can cross between installations.
7. **Frontend and API security integration.** Verify how frontend authentication is passed to the local backend, then add tests for every protected route. Do not simply add auth dependencies without updating frontend requests and verifying the full sign-in flow.

## Acceptance gates

- Automated tests and CI pass.
- Android native build succeeds with the intended Firebase project configuration.
- No service-account private key is shipped in the installer or repository.
- Each installation has a unique identity; its notification sender cannot address another customer's registered devices.
- Every local state-changing API requires authorization and rejects unauthorized LAN requests.
- A failed notification never changes whether a trade is executed or how risk controls behave.
- Customer A and customer B run separate Windows installations and demonstrably receive only their own alerts.
- The release notes and installer explain Windows uptime, internet requirements, MT5 terminal requirements, and notification limitations.
