import express from "express";
import { z } from "zod";

const app = express();
app.use(express.json({ limit: "16kb" }));
const PORT = Number(process.env.PORT ?? 8787);
const RELAY_API_KEY = process.env.RELAY_API_KEY ?? "";
const EXPO_ACCESS_TOKEN = process.env.EXPO_ACCESS_TOKEN ?? "";

const EventSchema = z.object({
  deviceToken: z.string().min(10).max(512),
  event: z.enum(["engine_started", "engine_stopped", "trade_opened", "trade_closed", "risk_limit_reached", "daily_trade_limit_reached", "mt5_disconnected", "mt5_reconnected", "bridge_error"]),
  message: z.string().min(1).max(240)
}).strict();

const titles: Record<z.infer<typeof EventSchema>["event"], string> = {
  engine_started: "AlgoGuardian started",
  engine_stopped: "AlgoGuardian stopped",
  trade_opened: "Trade opened",
  trade_closed: "Trade closed",
  risk_limit_reached: "Risk limit reached",
  daily_trade_limit_reached: "Daily trade limit reached",
  mt5_disconnected: "MT5 connection lost",
  mt5_reconnected: "MT5 reconnected",
  bridge_error: "AlgoGuardian needs attention"
};

app.get("/health", (_req, res) => res.json({ status: "ok", service: "notification-relay" }));

app.post("/v1/notify", async (req, res) => {
  if (!RELAY_API_KEY || req.header("authorization") !== "Bearer " + RELAY_API_KEY) return res.status(401).json({ error: "Unauthorized" });
  const parsed = EventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid notification event" });
  const { deviceToken, event, message } = parsed.data;
  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(EXPO_ACCESS_TOKEN ? { Authorization: "Bearer " + EXPO_ACCESS_TOKEN } : {}) },
      body: JSON.stringify({ to: deviceToken, sound: "default", title: titles[event], body: message, data: { event }, priority: "high", channelId: "algoguardian-alerts" })
    });
    if (!response.ok) return res.status(502).json({ error: "Push provider rejected the notification", status: response.status });
    return res.status(202).json({ accepted: true, provider: await response.json() });
  } catch {
    return res.status(502).json({ error: "Push provider unavailable" });
  }
});

app.listen(PORT, "0.0.0.0", () => console.log("AlgoGuardian notification relay listening on port " + PORT));
