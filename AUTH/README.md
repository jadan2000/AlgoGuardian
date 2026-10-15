# AlgoGuardian Authentication

This folder is the starting workspace for the authentication implementation.

## Agreed architecture

- Supabase Auth: user registration, sign-in, sign-out, and session management.
- User profiles and subscription/licence status: Supabase database, protected by Row Level Security (RLS).
- Frontend: React + TypeScript.
- Backend: Python + FastAPI; protected endpoints must verify the authenticated user rather than trust a user ID supplied by the browser.
- MT5 credentials: handled only by secure backend storage, never exposed in frontend code or placed in public profile records.

## Implementation sequence

1. Configure Supabase client and environment variables.
2. Build registration and sign-in screens.
3. Add persistent session handling and protected routes.
4. Add profile and subscription/licence checks.
5. Verify backend access tokens and enforce per-user data isolation.

Do not commit real API keys, service-role keys, broker passwords, or MT5 credentials. Use environment variables and keep secrets out of Git.
