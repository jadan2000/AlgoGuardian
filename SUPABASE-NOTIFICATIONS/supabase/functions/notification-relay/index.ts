import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { GoogleAuth } from "npm:google-auth-library@9.15.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const EVENTS: Record<string, string> = {
  engine_started: "AlgoGuardian trading engine was started.",
  engine_stopped: "AlgoGuardian trading engine was stopped or paused.",
  trade_opened: "A trade was opened by your local trading engine.",
  trade_closed: "A trade was closed by your local trading engine.",
  order_rejected_settings: "An order was blocked by AlgoGuardian settings or risk rules.",
};
const encoder = new TextEncoder();

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function validUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Relay storage is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function authenticate(body: Record<string, unknown>) {
  if (!validUuid(body.installation_id) || typeof body.installation_secret !== "string" ||
      body.installation_secret.length < 40 || body.installation_secret.length > 256) return null;
  const db = serviceClient();
  const { data, error } = await db.from("notification_installations")
    .select("installation_id,secret_hash,device_tokens")
    .eq("installation_id", body.installation_id).maybeSingle();
  if (error) throw new Error("Could not access relay registry.");
  if (!data || await sha256(body.installation_secret) !== data.secret_hash) return null;
  return { db, row: data };
}
async function firebaseAccessToken(): Promise<{ token: string; projectId: string }> {
  const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new Error("Push delivery is not configured.");
  let account: { project_id?: string; client_email?: string; private_key?: string };
  try { account = JSON.parse(raw); } catch { throw new Error("Push delivery credentials are invalid."); }
  if (!account.project_id || !account.client_email || !account.private_key) throw new Error("Push delivery credentials are incomplete.");
  const auth = new GoogleAuth({
    credentials: { client_email: account.client_email, private_key: account.private_key, project_id: account.project_id },
    scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new Error("Could not authenticate push delivery.");
  return { token: token.token, projectId: account.project_id };
}
async function sendPush(token: string, event: string) {
  const { token: accessToken, projectId } = await firebaseAccessToken();
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: {
      token, notification: { title: "AlgoGuardian", body: EVENTS[event] }, data: { event },
      android: { priority: "high", notification: { channel_id: "algoguardian-alerts" } },
    } }),
  });
  if (!response.ok) throw new Error(`Push provider rejected delivery (HTTP ${response.status}).`);
}
function parseTokens(value: unknown): Array<{ token: string; device_name: string }> {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item.token === "string" &&
    typeof item.device_name === "string") as Array<{ token: string; device_name: string }>;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ error: "Invalid request." }, 400);
    body = parsed as Record<string, unknown>;
  } catch { return json({ error: "Invalid JSON." }, 400); }

  const action = body.action;
  // Phone pairing is claimed over HTTPS through this relay, never by reaching the PC's LAN address.
  if (action === "claim_pairing") {
    if (typeof body.code !== "string" || body.code.length < 32 || body.code.length > 128 ||
        typeof body.token !== "string" || body.token.length < 20 || body.token.length > 4096 ||
        typeof body.device_name !== "string" || !body.device_name.trim() || body.device_name.length > 120) {
      return json({ error: "Invalid pairing request." }, 400);
    }
    try {
      const db = serviceClient();
      const codeHash = await sha256(body.code);
      const { data: session, error: claimError } = await db.from("notification_pairing_sessions")
        .update({ status: "claimed", claimed_at: new Date().toISOString() })
        .eq("code_hash", codeHash).eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .select("installation_id").maybeSingle();
      if (claimError) throw new Error("Pairing lookup failed.");
      if (!session) return json({ error: "This QR code expired or was already used. Generate a fresh QR on Windows." }, 401);
      const { data: installation, error: readError } = await db.from("notification_installations")
        .select("device_tokens").eq("installation_id", session.installation_id).maybeSingle();
      if (readError || !installation) throw new Error("Installation not found.");
      const tokens = parseTokens(installation.device_tokens).filter((device) => device.token !== body.token);
      if (tokens.length >= 10) return json({ error: "This installation has reached its device limit." }, 409);
      tokens.push({ token: body.token, device_name: body.device_name.trim() });
      const { error: saveError } = await db.from("notification_installations")
        .update({ device_tokens: tokens, updated_at: new Date().toISOString() })
        .eq("installation_id", session.installation_id);
      if (saveError) throw new Error("Could not register device.");
      return json({ paired: true, installation_id: session.installation_id });
    } catch {
      return json({ error: "Pairing relay temporarily unavailable." }, 503);
    }
  }
  if (action === "remove_device_public") {
    if (!validUuid(body.installation_id) || typeof body.token !== "string" ||
        body.token.length < 20 || body.token.length > 4096) return json({ error: "Invalid unpair request." }, 400);
    try {
      const db = serviceClient();
      const { data, error } = await db.from("notification_installations").select("device_tokens")
        .eq("installation_id", body.installation_id).maybeSingle();
      if (error || !data) return json({ error: "Installation not found." }, 404);
      const tokens = parseTokens(data.device_tokens);
      const next = tokens.filter((device) => device.token !== body.token);
      const { error: updateError } = await db.from("notification_installations")
        .update({ device_tokens: next, updated_at: new Date().toISOString() })
        .eq("installation_id", body.installation_id);
      if (updateError) throw new Error("Could not remove device.");
      return json({ removed: next.length !== tokens.length });
    } catch { return json({ error: "Unpair relay temporarily unavailable." }, 503); }
  }
  if (action === "register_installation") {
    if (!validUuid(body.installation_id) || typeof body.installation_secret !== "string" ||
        body.installation_secret.length < 40 || body.installation_secret.length > 256) return json({ error: "Invalid installation identity." }, 400);
    try {
      const db = serviceClient();
      const secretHash = await sha256(body.installation_secret);
      const { data, error } = await db.from("notification_installations")
        .select("secret_hash").eq("installation_id", body.installation_id).maybeSingle();
      if (error) throw new Error("Registry lookup failed.");
      if (data && data.secret_hash !== secretHash) return json({ error: "Installation identity conflict." }, 409);
      if (!data) {
        const { error: insertError } = await db.from("notification_installations").insert({
          installation_id: body.installation_id, secret_hash: secretHash, device_tokens: [],
        });
        if (insertError) {
          const { data: saved, error: retryError } = await db.from("notification_installations")
            .select("secret_hash").eq("installation_id", body.installation_id).maybeSingle();
          if (retryError || !saved || saved.secret_hash !== secretHash) throw new Error("Could not register installation.");
        }
      }
      return json({ registered: true });
    } catch { return json({ error: "Relay registration failed." }, 503); }
  }

  try {
    const auth = await authenticate(body);
    if (!auth) return json({ error: "Unauthorized installation." }, 401);
    if (action === "create_pairing") {
      const code = crypto.randomUUID() + crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 3 * 60 * 1000).toISOString();
      const { error } = await auth.db.from("notification_pairing_sessions").insert({
        code_hash: await sha256(code),
        installation_id: auth.row.installation_id,
        status: "pending",
        expires_at: expiresAt,
      });
      if (error) return json({ error: "Could not create pairing code." }, 503);
      return json({ code, expires_in_seconds: 180 });
    }
    const tokens = parseTokens(auth.row.device_tokens);
    if (action === "register_device") {
      if (typeof body.token !== "string" || body.token.length < 20 || body.token.length > 4096 ||
          typeof body.device_name !== "string" || !body.device_name.trim() || body.device_name.length > 120) return json({ error: "Invalid device registration." }, 400);
      const next = tokens.filter((device) => device.token !== body.token);
      if (next.length >= 10) return json({ error: "This installation has reached its device limit." }, 409);
      next.push({ token: body.token, device_name: body.device_name.trim() });
      const { error } = await auth.db.from("notification_installations")
        .update({ device_tokens: next, updated_at: new Date().toISOString() }).eq("installation_id", body.installation_id);
      if (error) return json({ error: "Could not register device." }, 503);
      return json({ registered: true });
    }
    if (action === "remove_device") {
      if (typeof body.token !== "string") return json({ error: "Invalid device token." }, 400);
      const next = tokens.filter((device) => device.token !== body.token);
      const { error } = await auth.db.from("notification_installations")
        .update({ device_tokens: next, updated_at: new Date().toISOString() }).eq("installation_id", body.installation_id);
      if (error) return json({ error: "Could not remove device." }, 503);
      return json({ removed: next.length !== tokens.length });
    }
    if (action === "send_notification") {
      if (typeof body.event !== "string" || !Object.hasOwn(EVENTS, body.event)) return json({ error: "Unsupported notification event." }, 400);
      let sent = 0, failed = 0;
      for (const device of tokens) {
        try { await sendPush(device.token, body.event); sent++; } catch { failed++; }
      }
      return json({ sent, failed });
    }
    return json({ error: "Unsupported action." }, 400);
  } catch { return json({ error: "Notification relay temporarily unavailable." }, 503); }
});
