# AlgoGuardian Notifications

Android phone notification app and minimal TypeScript relay prototype. The phone is notification-only: no broker login, broker password, trading configuration, or order controls belong in this app.

Built with Expo + React Native + TypeScript for Android packaging. Production push notifications require an Expo project and configured push credentials. The relay is not a trading backend. Production needs durable device-token storage, authenticated pairing, rate limits, monitoring, and privacy/retention controls. Never send broker credentials or sensitive account details in notification payloads.

Install Node.js 20+, run npm install here, and configure the relay URL and push project. Never commit .env, signing keys, Expo access tokens, or customer push tokens.
