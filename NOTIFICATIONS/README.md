# AlgoGuardian Notifications

Android notification-only companion built with Expo + React Native. It contains no broker login, broker passwords, trading settings, or order controls.

## Current integration

- The app requests notification permission and obtains an Expo push token on a physical device when an Expo EAS project ID is configured.
- The TypeScript relay exposes `GET /health` and authenticated `POST /v1/notify`.
- The local Windows bridge can send `mt5_disconnected` and `mt5_reconnected` events to the relay when the configured MT5 connection changes.
- Trade, engine, and risk-limit events are defined in the relay schema but are not emitted by the bridge prototype because there is not yet a local execution engine connected to those events.

## Setup

1. Install Node.js 20+.
2. From this directory, run `npm install`.
3. Configure an Expo EAS project and set its project ID in `app.json` / Expo config, then run `npm run start` and test on a physical Android device.
4. Deploy the relay as a separate HTTPS Node service using `npm run relay`. Configure server-side `RELAY_API_KEY` and, if required by your Expo setup, `EXPO_ACCESS_TOKEN`. Never expose these secrets in the mobile app or browser.
5. In the phone app, copy the displayed Expo push token. On the Windows laptop, copy `BRIDGE/config.example.json` to `BRIDGE/config.json` and set `notification_relay_url`, `notification_relay_api_key`, and `notification_device_token`. Keep that file local and private.
6. Test by opening and disconnecting/reconnecting the demo MT5 terminal. The bridge observes status on dashboard refresh and sends a push on a detected connection-state change.

## Important

- Push notifications require a working relay, Expo project configuration, network access, and OS notification permission.
- No alert can be delivered if the laptop or network abruptly loses power/connectivity before sending it.
- Store push tokens and relay secrets securely. Never commit local `config.json`, `.env`, signing keys, or customer tokens.
- This is a prototype integration, not a production-certified alerting service. Before production, add authenticated device pairing, durable token storage, rate limits, relay monitoring, retry/queueing, and end-to-end tests.
