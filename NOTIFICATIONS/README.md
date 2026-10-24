# AlgoGuardian Notifications

Android notification-only companion for a customer-owned AlgoGuardian Windows installation. It contains no broker login, broker passwords, trading settings, or order controls.

## Architecture

- Each customer runs AlgoGuardian, the trading engine, and their own MT5 terminal/account locally on their Windows PC.
- The Windows backend generates a QR code containing a random, single-use pairing code that expires after three minutes.
- The phone scans that QR code and sends its FCM token to that Windows backend. The backend consumes the code once, then registers the phone with the notification-only Firebase relay.
- Every Windows installation has a separate random installation ID and secret stored in `BACKEND/storage/notification_identity.json`. That file is excluded from Git and must never be copied between PCs.
- Firebase Cloud Messaging transports notifications only. The cloud relay stores each installation's device tokens separately and does not execute trades or receive broker credentials, prices, strategies, or trading commands.
- The Firebase Admin SDK service-account key stays in Firebase's server-side runtime. It is not installed on customer PCs.

## Deploy the Firebase notification relay (one-time developer setup)

Prerequisites: a Firebase project, Node.js 20+, and Firebase CLI. Cloud Functions deployment may require the Firebase project's billing plan to support it.

1. In the Firebase Console, create or select the project used by the Android app. Enable Cloud Firestore.
2. In `FIREBASE/`, select the project with the Firebase CLI:

   ```powershell
   npm install -g firebase-tools
   firebase login
   firebase use --add
   ```

3. Deploy the relay and Firestore rules:

   ```powershell
   cd FIREBASE
   npm --prefix functions install
   firebase deploy --only functions,firestore:rules
   ```

4. Copy the deployed `notificationRelay` HTTPS function URL. Set it as `NOTIFICATION_RELAY_URL` in each Windows installation's private `BACKEND/.env`, for example:

   ```dotenv
   NOTIFICATION_RELAY_URL=https://us-central1-YOUR_FIREBASE_PROJECT.cloudfunctions.net/notificationRelay
   ```

5. Keep the Firebase Admin service account within the Firebase/Google Cloud managed runtime. Do not download it to customer PCs, commit it, or distribute it.

The relay uses Firestore's server-side Admin SDK. Its rules explicitly deny client SDK access to installation records.

## Configure and run a Windows installation

1. Copy `BACKEND/.env.example` to `BACKEND/.env` and configure the existing local MT5, Supabase, encryption, and `NOTIFICATION_RELAY_URL` settings.
2. Install backend dependencies from `BACKEND/` with `pip install -r requirements.txt`, then restart the local backend.
3. Sign in to the AlgoGuardian Windows dashboard and open **Broker Accounts**.
4. Select **Generate pairing QR**. Open the AlgoGuardian phone app on a physical Android phone, grant notification and camera permissions, then scan the QR.
5. Pair while the phone and PC are on the same trusted local network. The QR code expires after three minutes and can be used once; generate a new one if it expires.
6. For a native Android build, register the Android app in the same Firebase project, place its `google-services.json` in `NOTIFICATIONS/` (never commit it), then build with the Expo/EAS workflow. Remote push does not work in Expo Go.

## Event delivery and operational limits

- The Windows backend sends best-effort alerts for existing engine lifecycle and trade events. Push sends run asynchronously; notification failures must not block trade execution.
- The Windows PC needs internet access when it sends an alert; the phone needs internet to receive it.
- If the PC is powered off or offline, new events are not queued durably.
- The current local QR claim uses the Windows backend's LAN URL. Pair only on a trusted network; plain HTTP can expose the short-lived code and FCM token to a network observer. Do not expose the local backend to the public internet. TLS-backed local pairing remains a release gate.

## Security status — not ready for public customer rollout

The branch now includes a notification-only relay and QR pairing implementation, but it has not been deployed or verified end-to-end. Do not distribute it as a production installer yet. Remaining gates include:

- Configure and deploy the relay in the intended Firebase project, and test installation registration and notification delivery.
- Build the Android app with the correct Firebase project and test QR scanning, token rotation, app-closed delivery, and unpairing on a real phone.
- Secure the local Windows API consistently. Existing bot controls, configuration, trades, logs, and account endpoints still need a full authenticated-route review.
- Replace the LAN HTTP pairing transport with TLS or another verified secure local pairing transport before public rollout.
- Add durable notification retry/deduplication and robust invalid-token handling.
- Test two separate Windows installations and two phones; verify there is no cross-installation delivery.
- Build a Windows installer and verify safe startup, shutdown, recovery, updates, and log rotation.

See `PRODUCTION_READINESS.md` for acceptance gates.
