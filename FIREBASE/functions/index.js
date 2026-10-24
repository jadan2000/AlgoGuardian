const crypto = require("node:crypto");
const express = require("express");
const admin = require("firebase-admin");
const { onRequest } = require("firebase-functions/v2/https");

admin.initializeApp();
const db = admin.firestore();
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));

const EVENTS = new Set([
  "engine_started", "engine_stopped", "trade_opened", "trade_closed",
  "risk_limit_reached", "daily_trade_limit_reached", "mt5_disconnected",
  "mt5_reconnected", "notification_error",
]);
const TITLES = {
  engine_started: "AlgoGuardian started",
  engine_stopped: "AlgoGuardian stopped",
  trade_opened: "Trade opened",
  trade_closed: "Trade closed",
  risk_limit_reached: "Risk limit reached",
  daily_trade_limit_reached: "Daily trade limit reached",
  mt5_disconnected: "MT5 connection lost",
  mt5_reconnected: "MT5 reconnected",
  notification_error: "AlgoGuardian needs attention",
};
const TOKEN_MAX = 4096;
const INSTALLATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}
function identityFrom(req) {
  const installationId = String(req.body?.installation_id || "");
  const secret = String(req.body?.installation_secret || "");
  if (!INSTALLATION_ID.test(installationId) || secret.length < 40 || secret.length > 256) {
    return null;
  }
  return { installationId, secret, ref: db.collection("notificationInstallations").doc(installationId) };
}
function hashSecret(secret) {
  return crypto.createHash("sha256").update(secret, "utf8").digest("hex");
}
function equalHash(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}
async function authenticate(req, res) {
  const identity = identityFrom(req);
  if (!identity) {
    sendError(res, 401, "Invalid installation identity.");
    return null;
  }
  const snapshot = await identity.ref.get();
  if (!snapshot.exists || !equalHash(snapshot.get("secret_hash"), hashSecret(identity.secret))) {
    sendError(res, 401, "Installation is not registered or its secret is invalid.");
    return null;
  }
  return { ...identity, data: snapshot.data() || {} };
}

app.get("/health", (_req, res) => res.json({ ok: true, service: "notification-only" }));

app.post("/v1/installations/register", async (req, res) => {
  const identity = identityFrom(req);
  if (!identity) return sendError(res, 400, "Invalid installation identity.");
  try {
    const suppliedHash = hashSecret(identity.secret);
    const result = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(identity.ref);
      if (!snapshot.exists) {
        transaction.create(identity.ref, {
          secret_hash: suppliedHash,
          device_tokens: [],
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        return "created";
      }
      if (!equalHash(snapshot.get("secret_hash"), suppliedHash)) return "conflict";
      transaction.update(identity.ref, { updated_at: admin.firestore.FieldValue.serverTimestamp() });
      return "existing";
    });
    if (result === "conflict") return sendError(res, 409, "Installation identity conflict. Do not reset local identity automatically.");
    return res.status(200).json({ registered: true, status: result });
  } catch (error) {
    console.error("installation registration failed", error?.message || "unknown");
    return sendError(res, 500, "Could not register installation.");
  }
});

app.post("/v1/devices/register", async (req, res) => {
  const token = String(req.body?.token || "").trim();
  const deviceName = String(req.body?.device_name || "Android device").trim().slice(0, 80) || "Android device";
  if (token.length < 20 || token.length > TOKEN_MAX) return sendError(res, 400, "Invalid FCM token.");
  try {
    const identity = await authenticate(req, res);
    if (!identity) return;
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(identity.ref);
      const devices = Array.isArray(snapshot.get("device_tokens")) ? snapshot.get("device_tokens") : [];
      const existing = devices.findIndex((item) => item?.token === token);
      if (existing >= 0) devices[existing] = { token, device_name: deviceName };
      else {
        if (devices.length >= 10) throw Object.assign(new Error("DEVICE_LIMIT"), { code: "DEVICE_LIMIT" });
        devices.push({ token, device_name: deviceName });
      }
      transaction.update(identity.ref, { device_tokens: devices, updated_at: admin.firestore.FieldValue.serverTimestamp() });
    });
    return res.json({ registered: true });
  } catch (error) {
    if (error?.code === "DEVICE_LIMIT") return sendError(res, 409, "This installation can register at most 10 phones.");
    console.error("device registration failed", error?.message || "unknown");
    return sendError(res, 500, "Could not register device.");
  }
});

app.post("/v1/devices/remove", async (req, res) => {
  const token = String(req.body?.token || "").trim();
  if (token.length < 20 || token.length > TOKEN_MAX) return sendError(res, 400, "Invalid FCM token.");
  try {
    const identity = await authenticate(req, res);
    if (!identity) return;
    const devices = Array.isArray(identity.data.device_tokens) ? identity.data.device_tokens : [];
    const filtered = devices.filter((item) => item?.token !== token);
    await identity.ref.update({ device_tokens: filtered, updated_at: admin.firestore.FieldValue.serverTimestamp() });
    return res.json({ removed: filtered.length !== devices.length });
  } catch (error) {
    console.error("device removal failed", error?.message || "unknown");
    return sendError(res, 500, "Could not remove device.");
  }
});

app.post("/v1/notifications/send", async (req, res) => {
  const event = String(req.body?.event || "");
  const message = String(req.body?.message || "").slice(0, 240);
  if (!EVENTS.has(event)) return sendError(res, 400, "Unsupported notification event.");
  try {
    const identity = await authenticate(req, res);
    if (!identity) return;
    const devices = Array.isArray(identity.data.device_tokens) ? identity.data.device_tokens : [];
    if (!devices.length) return res.json({ sent: 0, failed: 0 });
    const tokens = devices.map((item) => item?.token).filter((token) => typeof token === "string" && token.length >= 20);
    if (!tokens.length) return res.json({ sent: 0, failed: 0 });
    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title: TITLES[event], body: message },
      data: { event },
      android: { priority: "high", notification: { channelId: "algoguardian-alerts", sound: "default" } },
    });
    const invalid = new Set();
    response.responses.forEach((item, index) => {
      const code = item.error?.code || "";
      if (code.includes("registration-token-not-registered") || code.includes("invalid-registration-token")) invalid.add(tokens[index]);
    });
    if (invalid.size) {
      const fresh = (Array.isArray(identity.data.device_tokens) ? identity.data.device_tokens : [])
        .filter((item) => !invalid.has(item?.token));
      await identity.ref.update({ device_tokens: fresh, updated_at: admin.firestore.FieldValue.serverTimestamp() });
    }
    return res.json({ sent: response.successCount, failed: response.failureCount });
  } catch (error) {
    console.error("notification send failed", error?.message || "unknown");
    return sendError(res, 500, "Could not send notification.");
  }
});

exports.notificationRelay = onRequest({ region: "us-central1", cors: false, maxInstances: 10 }, app);
