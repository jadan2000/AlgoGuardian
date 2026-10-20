# AlgoGuardian standalone STK service

This service is intentionally isolated from Mulastar and from the AlgoGuardian trading engine. It only starts an M-Pesa STK prompt and records verified payment outcomes. It does not activate user accounts.

## API

- `GET /health` — service health check.
- `POST /api/stk-push` — initiates a fixed KSh 1,000 AlgoGuardian activation payment. Requires `X-API-Key: <STK_API_KEY>`.
- `POST /api/payments/callback` — Safaricom callback; checks Daraja transaction status and validates amount, phone, and receipt before marking the record paid.

Request body for STK Push:

```json
{"phone_number":"0712345678"}
```

Do not put `STK_API_KEY`, Daraja secrets, or the Supabase service-role key in frontend code.

## Deploy on Render

1. Push the `feature/mt5-demo-connection` branch to GitHub.
2. In Render, create a new **Web Service** from repository `jadan2000/BOT`.
3. Set the root directory to `STK-SERVICE`, runtime to Python, build command `pip install -r requirements.txt`, start command `uvicorn app:app --host 0.0.0.0 --port $PORT`.
4. Set the environment variables listed in `.env.example`. Use the real production Daraja credentials and your existing Till configuration; never commit secrets.
5. Once Render gives the service its public URL, set:
   - `PUBLIC_BASE_URL=https://YOUR-SERVICE.onrender.com`
   - `STK_CALLBACK_URL=https://YOUR-SERVICE.onrender.com/api/payments/callback`
6. Run `schema.sql` in the Supabase SQL Editor for the Supabase project used by AlgoGuardian.
7. Check `https://YOUR-SERVICE.onrender.com/health` before attempting any payment.

## Important limitations before live use

- The API currently requires a server-side API key for payment initiation. Keep it out of browser code; a trusted backend must call this service.
- This service records payments only. It does not authenticate end users or activate accounts.
- Safaricom production configuration must be approved and correctly mapped for your Buy Goods Till. Confirm that the configured Business Short Code and passkey are the values issued for your Daraja production integration.
- Do not test with real money until environment variables, database schema, callback delivery, and the production transaction flow have been checked end to end.
