import React, { useCallback, useEffect, useState } from "react";
import { LoaderCircle, MonitorCog, RefreshCw, ShieldCheck, WifiOff } from "lucide-react";

const BRIDGE_BASE = "http://127.0.0.1:8765";

type BridgeStatus = {
  bridge?: string;
  mt5_process_detected?: boolean;
  account_verified?: boolean;
  broker_connected?: boolean;
  verification_message?: string;
  trading_enabled?: boolean;
};

export default function LocalBridgeStatus() {
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`${BRIDGE_BASE}/v1/status`, { method: "GET", cache: "no-store" });
      if (!response.ok) throw new Error(`Local bridge returned HTTP ${response.status}`);
      const data = (await response.json()) as BridgeStatus;
      setStatus(data);
      setError("");
    } catch {
      setStatus(null);
      setError("Local bridge not detected. Start the AlgoGuardian Bridge on this Windows laptop.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 10000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const startTerminal = async () => {
    setStarting(true);
    setError("");
    try {
      const response = await fetch(`${BRIDGE_BASE}/v1/ensure-terminal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ launch_if_missing: true }),
      });
      const data = (await response.json()) as BridgeStatus & { status?: string; detail?: string };
      if (!response.ok) throw new Error(data.detail || `Local bridge returned HTTP ${response.status}`);
      setStatus(data);
      if (!data.account_verified) setError(data.verification_message || "MT5 opened, but the broker account could not be verified yet. Check MT5 on the laptop.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not contact the local bridge.");
    } finally {
      setStarting(false);
      await refresh();
    }
  };

  const connected = Boolean(status?.account_verified && status?.broker_connected);
  const terminalRunning = Boolean(status?.mt5_process_detected);

  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-5 space-y-4" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-secondary p-2"><MonitorCog className="h-5 w-5" /></div>
          <div>
            <h2 className="font-semibold">This laptop · MT5 bridge</h2>
            <p className="mt-1 text-sm text-muted-foreground">Local connection check. Broker credentials and trading remain on this computer.</p>
          </div>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading || starting} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-60">
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Local bridge</p>
          <p className={`mt-1 font-medium ${status ? "text-emerald-500" : "text-amber-500"}`}>{loading ? "Checking…" : status ? "Available" : "Not detected"}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">MT5 terminal</p>
          <p className={`mt-1 font-medium ${terminalRunning ? "text-emerald-500" : "text-muted-foreground"}`}>{terminalRunning ? "Running" : "Not detected"}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Broker account</p>
          <p className={`mt-1 inline-flex items-center gap-1.5 font-medium ${connected ? "text-emerald-500" : "text-amber-500"}`}>
            {connected ? <ShieldCheck className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            {connected ? "Verified connection" : "Not verified"}
          </p>
        </div>
      </div>

      {error ? <p role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-600 dark:text-amber-300">{error}</p> : null}
      {!error && status?.verification_message ? <p className="text-sm text-muted-foreground">{status.verification_message}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Trading is disabled in this bridge prototype. This panel does not start the trading engine.</p>
        <button type="button" onClick={() => void startTerminal()} disabled={!status || starting} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
          {starting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <MonitorCog className="h-4 w-4" />}
          {starting ? "Checking MT5…" : terminalRunning ? "Verify MT5 connection" : "Open MT5"}
        </button>
      </div>
    </section>
  );
}
