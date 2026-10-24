# AlgoGuardian Production Readiness

## Required architecture (preserve this constraint)

Each customer runs one AlgoGuardian Windows installation connected to that customer's own MT5 terminal and account. Strategy evaluation, risk controls, broker credentials, prices used for decisions, and trade execution stay on that customer's PC. Firebase is a notification transport only; it must not receive broker credentials, trading commands, prices, strategy state, or perform trade execution.

## Implemented in this branch

- A per-installation FCM token registry stored under `BACKEND/storage/notification_devices.json` and excluded from Git.
- An authenticated Windows dashboard action that generates a QR payload containing a random single-use code with a three-minute expiry.
- The phone app scans the QR code and submits its FCM token to the local Windows backend; the code is consumed once to prevent replay.
- Android pairing UI no longer asks customers to copy a long static secret.
- A random, persistent installation ID and secret stored locally in `BACKEND/storage/notification_identity.json`; the secret is never committed or shared between installs.
- A Firebase Cloud Functions relay that authenticates each installation, stores tokens separately in Firestore, sends only notification events, and removes invalid FCM tokens.
- Firestore rules deny direct client access to notification installation records.
- The privileged Firebase Admin SDK key is not required on customer PCs and has been removed from backend dependencies.
- Registry, one-time code expiry/replay, and local installation identity unit tests.
- CI checks Python syntax and unit tests; Firebase function syntax check is included in the workflow.

## Release blockers — do not call this production-ready yet

1. **Deploy and verify Firebase relay.** Configure the real Firebase project, deploy Cloud Functions and Firestore rules, set `NOTIFICATION_RELAY_URL`, and test installation registration, token registration, notification send, invalid-token cleanup, and secret rejection. The code is not deployed by this repository change.
2. **Secure local pairing transport.** QR pairing currently uses the local backend URL and may use HTTP on the LAN. The short-lived code and FCM token could be observed on an untrusted network. Use TLS-backed local pairing or another independently verified secure transport before public customer rollout. Never expose the local backend to the public internet.
3. **Authenticate all local control endpoints.** Existing bot controls, configuration, trades, logs, and account endpoints are not consistently protected. A user on the same network may be able to access or control the local engine. Add authenticated sessions/short-lived local authorization and protect all state-changing endpoints before public release.
4. **Durable notification delivery.** Current sends are best-effort background threads. Add a durable notification-only queue, bounded retries, deduplication, and delivery/expiry policy. Notification failure must never block trade execution.
5. **Windows service lifecycle.** Add an installer and managed startup/shutdown, health monitoring, safe updates, crash recovery, and log rotation. Never restart the trading engine blindly while a trade is being submitted.
6. **End-to-end validation.** Build the Android app with the intended Firebase project and test on a real Android device and MT5 demo account, including app closed, token rotation, revoked device, offline PC, FCM outage, broker disconnect, duplicate events, and a second customer installation. Confirm no notification can cross between installations.
7. **Frontend and API security integration.** Verify how frontend authentication is passed to the local backend, then add tests for every protected route. Do not simply add auth dependencies without updating frontend requests and verifying the full sign-in flow.
8. **Installer and configuration.** Provide a guided Firebase relay URL configuration, keep the service-account key server-side, verify per-installation identity persistence, and ensure local notification identity and token files are not included in customer backups shared with another installation.

## Acceptance gates

- Automated tests and CI pass.
- Firebase relay deployed to the correct project and Firestore rules verified.
- Android native build succeeds with the intended Firebase project configuration.
- No service-account private key is shipped in the installer, Windows backend, or repository.
- Each installation has a unique identity; its notification sender cannot address another customer's registered devices.
- Every local state-changing API requires authorization and rejects unauthorized LAN requests.
- Pairing code expires, can be consumed once, and cannot be reused.
- A failed notification never changes whether a trade is executed or how risk controls behave.
- Customer A and customer B run separate Windows installations and demonstrably receive only their own alerts.
- Release notes and installer explain Windows uptime, internet requirements, MT5 terminal requirements, and notification limitations.
