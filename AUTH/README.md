# AlgoGuardian Authentication

Implemented frontend flow:
- `/register`: create account with full name, email and password.
- `/login`: sign in using email and password.
- `/activation`: authenticated users remain here until their profile activation status is `active`.
- `/forgot-password`: request a password-reset email.
- `/`: trading dashboard protected by authentication and activation status.

## 1. Configure Supabase

In Supabase Dashboard:
1. Open **Authentication → Sign In / Providers → Email** (labels may vary).
2. Turn **Confirm email OFF**. The app intentionally expects signup to return a session immediately; it does not require users to verify email.
3. Under **Authentication → URL Configuration**, add the local frontend URL (for example `http://localhost:8080`) and the deployed website URL to the allowed redirect URLs.
4. In **SQL Editor**, run `AUTH/supabase_profiles.sql`.

## 2. Configure frontend

Copy `FRONTEND/.env.example` to `FRONTEND/.env.local` (or merge these values into the existing local env file), then set:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (Supabase publishable/anon key only)

Never put a Supabase service-role/secret key in the frontend or commit real secrets. Add the same two `VITE_` variables to the frontend hosting environment and redeploy.

## 3. Install dependency and run

From PowerShell:
```powershell
cd "C:\\FINAL BOT\\FRONTEND"
npm install
npm run dev
```

The dependency was added to `package.json`; run `npm install` to synchronize `package-lock.json` before building/deploying.

## 4. Activation

New profiles default to `pending`. This is deliberate: creating a login must not automatically grant access to paid trading functionality. The dashboard remains locked until a trusted administrator or a future verified subscription/payment workflow marks the profile active. Do not let a user set their own activation status.

For a controlled test only, an administrator can activate a test user in Supabase SQL Editor:
```sql
update public.profiles
set activation_status = 'active', updated_at = now()
where id = 'THE_AUTH_USER_UUID';
```
Get the UUID from **Authentication → Users**. Never activate an account based only on a browser-supplied user ID.

## Important security boundary

This implements frontend authentication and an activation gate. The existing trading API endpoints still need server-side JWT verification and per-user resource isolation before the website is exposed to multiple customers. Frontend route protection alone is not an API security boundary. MT5 account credentials must remain server-side and must never be stored in a public profile.

The trading engine, settings defaults, and MT5-sourced trade history are not changed by this authentication work.
