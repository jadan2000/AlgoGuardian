# AlgoGuardian Notifications

Android notification-only companion for a customer-owned AlgoGuardian Windows installation. It contains no broker login, broker passwords, trading settings, or order controls.

## Architecture

- Each customer runs the trading engine and their own MT5 terminal/account locally on their Windows PC.
- Phone FCM tokens are registered in a local registry at `BACKEND/storage/notification_devices.json`; the registry is ignored by Git and must never be copied between customers.
- The phone pairs to the Windows installation using its backend URL and a unique pairing secret. The secret is stored in Android secure storage.
- Firebase Cloud Messaging transports notifications only. It does not execute trades or host the trading engine.

## Configure the Windows installation

1. Copy `BACKEND/.env.example` to `BACKEND/.env` and configure the existing MT5 and Supabase settings.
2. Generate a unique pairing secret for this installation:

   ```powershell
   python -c "import secrets; print(secrets.token_urlsafe(48))"
   ```

3. Set `NOTIFICATION_PAIRING_SECRET` to that value in `BACKEND/.env`. Never reuse the same secret for different customers or share it in support chats.
4. Configure `GOOGLE_APPLICATION_CREDENTIALS` to point to the Firebase Admin SDK JSON file. Keep it outside the repository and restrict filesystem access.
5. Install backend dependencies from `BACKEND/` with `pip install -r requirements.txt`, then restart the local backend.
6. Ensure the phone can reach the Windows backend URL while pairing. The backend must be running and reachable on the local network.

## Build and pair the Android app

1. In Firebase Console, register an Android app with package name `com.algoguardian.alerts` and place its `google-services.json` in `NOTIFICATIONS/`. Never commit that file.
2. From `NOTIFICATIONS/`, run `npm install`, then build and install a native Android build using your configured Expo/EAS workflow. Remote push does not work in Expo Go.
3. Open AlgoGuardian Notifications on a physical Android phone and grant notification permission.
4. Enter the Windows backend URL, such as `http://192.168.1.20:8000`, and the unique pairing secret configured in that PC's private `.env`.
5. Tap **Pair this phone**. A successful response registers this FCM token only in that Windows installation's local registry.
6. Pair each additional phone with that customer's own Windows installation. To stop notifications, tap **Unpair this phone** while the PC is reachable.

## Event delivery and operational limits

The Windows backend sends best-effort notifications for the existing bot lifecycle and trade events. Notification sends are asynchronous so a push failure does not block trade execution. FCM delivery requires internet on the Windows PC when the event is sent and internet on the phone. If the PC is powered off or offline, new events are not queued durably.

## Security status — not yet ready for public customer rollout

This branch adds per-installation token storage and pairing, but the direct Firebase Admin SDK sender still requires a privileged service-account credential on the Windows PC. **Do not distribute one shared Firebase Admin service-account key to customers.** Before public rollout, replace direct Admin SDK sending from customer PCs with a trusted notification-only relay that keeps the service account server-side, authenticates each installation, and sends only to devices owned by that installation. This relay must never receive broker credentials, trading commands, or strategy data.

The local pairing endpoint currently uses the local backend URL supplied by the user. Pair only on a trusted network; plain HTTP exposes the pairing secret to anyone able to inspect that network. A production pairing flow should use authenticated pairing over TLS or a one-time short-lived pairing code.
