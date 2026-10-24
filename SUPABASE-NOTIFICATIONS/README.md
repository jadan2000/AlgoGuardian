# AlgoGuardian Supabase push-notification relay

This service sends generic push alerts only. Trading execution, broker credentials, strategies, and risk decisions remain on each customer's PC. The Android app never receives a Supabase service-role key or Firebase service-account key.

## Free-plan deployment

1. Use the existing Supabase project if suitable, or create a separate project on the Free plan. Do not enable billing.
2. Run `migrations/001_notification_installations.sql` in the Supabase SQL Editor.
3. In Supabase Edge Function secrets, set `FIREBASE_SERVICE_ACCOUNT_JSON` to the full Firebase service-account JSON for the Firebase project used by the Android app. Ensure that service account can send Firebase Cloud Messaging messages. The Supabase runtime supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; if your environment does not, set the service-role key as a server-side secret.
4. Install the Supabase CLI, sign in, and deploy:
   ```powershell
   supabase link --project-ref YOUR_PROJECT_REF
   supabase functions deploy notification-relay --no-verify-jwt
   ```
5. Set `NOTIFICATION_RELAY_URL=https://YOUR_PROJECT_REF.supabase.co/functions/v1/notification-relay` in private `BACKEND/.env`, then restart the backend.
6. Build and install the native Android app. Expo Go is not sufficient for remote push notifications.

## Security and reliability

- Never commit the Firebase service-account JSON, Android `google-services.json`, Supabase service-role key, or local installation identity file.
- The endpoint is public by design; all installation actions require a random per-installation secret sent over HTTPS. The secret hash is stored in the database, and client roles have no table access.
- The relay validates an allowlist of events and generates generic notification text itself. Caller-provided message text is ignored.
- Up to 10 device tokens are stored per installation. QR pairing and the local device registry remain on the PC.
- Supabase Free has quotas and projects may pause after inactivity; this avoids Firebase Cloud Functions' Blaze requirement but cannot guarantee unlimited or uninterrupted delivery. Do not enable billing.
- This is an initial implementation, not yet production-certified. Test Android background delivery, unpair/re-pair, two-installation isolation, rate limits, and network failures before customer release.
