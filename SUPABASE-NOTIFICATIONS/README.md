# AlgoGuardian Supabase relay

The relay transports generic push alerts, read-only account snapshots, and narrowly scoped `start`/`pause` engine commands. Trading execution, broker credentials, strategy configuration, and risk decisions remain on each customer's Windows PC. The Android app never receives the Supabase service-role key or Firebase service-account key.

## Free-plan deployment

1. Use the existing Supabase project if suitable, or create a separate project on the Free plan. Do not enable billing.
2. Apply every migration in `supabase/migrations/` in filename order. The remote-monitoring migration adds per-installation snapshots and the engine command queue. Prefer `supabase db push` after linking the intended project; alternatively, run each SQL migration in order in the SQL Editor.
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
- The endpoint is public by design. Windows actions require the per-installation secret; phone snapshot and command actions require a separate per-phone secret stored only as a hash in the installation device registry. Client roles have no direct table access.
- The relay validates an allowlist of events and generates generic notification text itself. Caller-provided message text is ignored.
- Up to 10 phone registrations are stored per installation. QR pairing codes are single-use and expire after three minutes. The phone receives only its own access secret, never the Windows installation secret.
- Supabase Free has quotas and projects may pause after inactivity; this avoids Firebase Cloud Functions' Blaze requirement but cannot guarantee unlimited or uninterrupted delivery. Do not enable billing.
- Snapshots publish about every five seconds. The Windows worker processes only `start`/`pause` commands. Start is refused locally if MT5 is unavailable, configuration is missing, or the local kill switch is active. Pause stops new trading and does not close open positions.
- Commands expire after 90 seconds and the relay limits outstanding commands. The Windows PC must remain online for snapshots and commands to work.
- This is an initial implementation, not yet production-certified. Test Android background delivery, unpair/re-pair, two-installation isolation, concurrent command claims, stale snapshots, network failures, and actual local risk validation before customer release.
