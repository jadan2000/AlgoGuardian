import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, CircleHelp, Eye, EyeOff, KeyRound, LoaderCircle, LockKeyhole, RefreshCw, Server, ShieldCheck, Unplug, WalletCards, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";

import { API_BASE } from "@/config/api";
import { supabase } from "@/auth/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type AccountStatus = {
  configured: boolean;
  connected: boolean;
  login: number | null;
  server: string | null;
  company?: string | null;
  currency?: string | null;
  trade_mode?: string | null;
  trade_allowed?: boolean;
  reason?: string | null;
};

export default function AccountsPage() {
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [server, setServer] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [action, setAction] = useState<"connect" | "disconnect" | "refresh" | null>(null);
  const [error, setError] = useState("");

  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    const sessionResult = await supabase?.auth.getSession();
    const token = sessionResult?.data.session?.access_token;
    if (!token) throw new Error("Your session has expired. Please sign in again.");
    const response = await fetch(`${API_BASE}/api/mt5-account${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `Request failed (${response.status})`);
    return data;
  }, []);

  const loadStatus = useCallback(async (showToast = false) => {
    setError("");
    try {
      const data = await request("/status");
      setStatus(data);
      if (data.login && !login) setLogin(String(data.login));
      if (data.server && !server) setServer(data.server);
      if (showToast) toast.success(data.connected ? "MT5 is connected." : "Connection status refreshed.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load broker account status.";
      setError(message);
      if (showToast) toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [request, login, server]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const connect = async () => {
    setAction("connect");
    setError("");
    try {
      const data = await request("/connect", { method: "POST" });
      setStatus(data);
      if (data.connected) toast.success("Broker account connected.");
      else {
        const message = data.reason || "MT5 could not connect. Check your account details and MT5 terminal.";
        setError(message);
        toast.error(message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection failed.";
      setError(message);
      toast.error(message);
    } finally {
      setAction(null);
    }
  };

  const disconnect = async () => {
    setAction("disconnect");
    setError("");
    try {
      const data = await request("/disconnect", { method: "POST" });
      setStatus(data);
      toast.success("MT5 disconnected.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not disconnect MT5.";
      setError(message);
      toast.error(message);
    } finally {
      setAction(null);
    }
  };

  const saveCredentials = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const data = await request("/credentials", {
        method: "POST",
        body: JSON.stringify({ login: Number(login), password, server: server.trim() }),
      });
      setStatus(data);
      setPassword("");
      if (data.connected) toast.success("Broker credentials encrypted and account connected.");
      else {
        const message = data.reason || "Credentials saved securely, but MT5 is not connected yet.";
        setError(message);
        toast.warning("Credentials saved, but connection needs attention.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save broker credentials.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || action !== null;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground"><WalletCards className="h-4 w-4" /> Account management</div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Broker Accounts</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Manage the single MetaTrader 5 account used by this AlgoGuardian backend.</p>
        </div>
        <Button variant="outline" onClick={() => void loadStatus(true)} disabled={busy || loading}>
          {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Refresh status
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-center gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${status?.connected ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
              {status?.connected ? <Wifi className="h-6 w-6" /> : <WifiOff className="h-6 w-6" />}
            </div>
            <div>
              <h2 className="font-semibold">MetaTrader 5 connection</h2>
              <p className="text-sm text-muted-foreground">{status?.connected ? "The backend is connected to your saved broker account." : status?.configured ? "Credentials are saved, but the account is currently offline." : "No broker account has been configured yet."}</p>
            </div>
          </div>
          <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${status?.connected ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
            <span className={`h-2 w-2 rounded-full ${status?.connected ? "bg-emerald-500" : "bg-muted-foreground"}`} />
            {loading ? "Checking…" : status?.connected ? "Connected" : status?.configured ? "Disconnected" : "Not configured"}
          </span>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
          <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Account number</p><p className="mt-1 font-semibold">{status?.login ?? "—"}</p></div>
          <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Broker server</p><p className="mt-1 break-words font-semibold">{status?.server || "—"}</p></div>
          <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Account type</p><p className="mt-1 font-semibold capitalize">{status?.trade_mode || "—"}</p></div>
          <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Currency / company</p><p className="mt-1 break-words font-semibold">{[status?.currency, status?.company].filter(Boolean).join(" · ") || "—"}</p></div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border bg-muted/20 p-4 sm:px-6">
          <Button onClick={() => void connect()} disabled={busy || !status?.configured}>
            {action === "connect" ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Wifi className="mr-2 h-4 w-4" />} Connect
          </Button>
          <Button variant="outline" onClick={() => void disconnect()} disabled={busy || !status?.connected}>
            {action === "disconnect" ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Unplug className="mr-2 h-4 w-4" />} Disconnect
          </Button>
        </div>
      </Card>

      {error && <div role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /><p>{error}</p></div>}
      {status?.connected && <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><div><p className="font-semibold">Account connection verified</p><p className="mt-1 text-muted-foreground">{status.trade_allowed ? "The terminal reports trading is allowed for this account." : "The terminal is connected. Trading permission may be disabled in the terminal or broker account."}</p></div></div>}

      <Card className="p-5 sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary"><KeyRound className="h-5 w-5" /></div>
          <div><h2 className="font-semibold">{status?.configured ? "Update broker credentials" : "Connect your broker account"}</h2><p className="mt-1 text-sm text-muted-foreground">Your credentials are encrypted on the backend. The password is never returned to this page.</p></div>
        </div>
        <form onSubmit={saveCredentials} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">MT5 account number<input required inputMode="numeric" pattern="[0-9]+" value={login} onChange={e => setLogin(e.target.value)} placeholder="e.g. 12345678" className="w-full rounded-md border border-input bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" /></label>
            <label className="space-y-2 text-sm font-medium">Broker server<input required value={server} onChange={e => setServer(e.target.value)} placeholder="e.g. BrokerName-Demo" autoComplete="organization" className="w-full rounded-md border border-input bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" /></label>
          </div>
          <label className="block space-y-2 text-sm font-medium">MT5 trading password<div className="relative"><input required type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" placeholder="Enter the trading password" className="w-full rounded-md border border-input bg-background px-3 py-2.5 pr-11 font-normal outline-none focus:ring-2 focus:ring-ring" /><button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:bg-muted">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></label>
          <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" /><p>Only enter your broker's trading password, never your investor/read-only password. Use a demo account while testing. The encrypted credential file is kept out of Git.</p></div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4" /> Server-side encryption · authenticated requests</p>
            <Button type="submit" disabled={busy || !login || !password || !server.trim()}>
              {saving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Server className="mr-2 h-4 w-4" />} {saving ? "Saving securely…" : "Save & connect"}
            </Button>
          </div>
        </form>
      </Card>

      <div className="flex items-start gap-2 text-xs text-muted-foreground"><CircleHelp className="mt-0.5 h-4 w-4 shrink-0" /><p>MT5's Python integration requires a compatible MT5 terminal and backend environment. Saving credentials does not install or start a terminal that is missing.</p></div>
    </div>
  );
}
