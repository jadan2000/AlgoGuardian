# AlgoGuardian Notifications

Android notification-only companion built with Expo + React Native and Firebase Cloud Messaging (FCM). It contains no broker login, broker passwords, trading settings, or order controls.

## Architecture

- The Android app registers a native FCM device token, not an Expo push token.
- The existing Windows AlgoGuardian backend sends notification events directly to Firebase using the Firebase Admin Python SDK.
- No local bridge process, Expo push relay, or separately hosted notification server is required.
- The trading engine and MT5 terminal remain on the Windows PC. Firebase only transports push notifications.

## One-time Firebase setup

1. Open the Firebase console and create/select an AlgoGuardian project.
2. In Project settings, add an Android app with package name `com.algoguardian.alerts`.
3. Download that app's `google-services.json` and place it at `NOTIFICATIONS/google-services.json`. Do not commit it; it is ignored by `.gitignore`.
4. Enable Cloud Messaging for the Firebase project. Build and install a native Android build; remote push notifications do not work in Expo Go.
5. From `NOTIFICATIONS/`, install dependencies with `npm install` and build using your configured Expo/EAS Android workflow. The native token shown in the app is the FCM token.

## Configure the Windows backend

1. In Firebase Console > Project settings > Service accounts, generate a Firebase Admin SDK service-account key. Store the JSON file securely outside the repository and never share it with customers or commit it.
2. Install backend dependencies from `BACKEND/` with `pip install -r requirements.txt`.
3. In the private `BACKEND/.env`, set:
   - `GOOGLE_APPLICATION_CREDENTIALS=C:/secure/path/firebase-admin.json` (use the real path to your private service-account file).
   - `FIREBASE_NOTIFICATION_DEVICE_TOKENS=FCM_TOKEN_1,FCM_TOKEN_2` (paste the FCM token shown by each registered phone; multiple tokens are comma-separated).
4. Restart the backend. The backend sends best-effort push alerts when the bot starts, pauses, or is stopped by the kill switch; when an automated order succeeds; and when a trade is manually closed. Push sends run asynchronously so notification failures do not block trading or order execution.

## Security and limitations

- Never embed Firebase Admin service-account credentials in the Android app or distribute them to users. They belong only on the trusted Windows backend.
- FCM tokens are device-specific and can rotate; refresh the configured token if delivery stops.
- This initial integration uses a private local token list. Customer self-registration at scale would require an authenticated token registry (for example, Firebase Authentication + Firestore rules); never expose the service-account key to phones.
- FCM delivery requires internet access on the Windows PC when sending and internet access on the phone. If the PC loses power before an event is sent, Firebase cannot know that event occurred.
- Firebase Cloud Messaging itself has no-cost usage, but other Firebase services or build services may have separate limits or charges.
