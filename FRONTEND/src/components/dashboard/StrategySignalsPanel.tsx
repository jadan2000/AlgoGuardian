import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, Clock3, Gauge, Layers3, ShieldCheck, Target, TrendingUp, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { API_BASE } from "@/config/api";

type Signal = {
  symbol?: string;
  status?: string;
  timestamp?: string;
  signal?: string;
  reason?: string;
  confidence?: number;
};

type StrategyConfig = {
  trading_pairs?: string[];
  trend_tf?: string;
  entry_tf?: string;
  ema_fast?: number;
  ema_slow?: number;
  entry_ema?: number;
  risk_per_trade?: number;
  max_open_positions?: number;
  allow_london?: boolean;
  allow_ny?: boolean;
  allow_asia?: boolean;
  trend_filter?: boolean;
  entry_ema_filter?: boolean;
  adx_filter?: boolean;
  atr_filter?: boolean;
  atr_extension_filter?: boolean;
  momentum_filter?: boolean;
  spread_filter?: boolean;
  breakout_filter?: boolean;
};

const filterLabels: { key: keyof StrategyConfig; label: string }[] = [
  { key: "trend_filter", label: "Trend alignment" },
  { key: "entry_ema_filter", label: "EMA entry confirmation" },
  { key: "adx_filter", label: "ADX strength" },
  { key: "atr_filter", label: "Volatility / ATR" },
  { key: "atr_extension_filter", label: "ATR extension guard" },
  { key: "momentum_filter", label: "Candle momentum" },
  { key: "spread_filter", label: "Spread protection" },
  { key: "breakout_filter", label: "Breakout confirmation" },
];

const sessionLabels = [
  { key: "allow_london" as const, label: "London" },
  { key: "allow_ny" as const, label: "New York" },
  { key: "allow_asia" as const, label: "Asia / Tokyo" },
];

function prettyDate(value?: string) {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function StrategySignalsPanel() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [config, setConfig] = useState<StrategyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      try {
        const [signalResponse, configResponse] = await Promise.all([
          fetch(`${API_BASE}/bot/signals?limit=20`),
          fetch(`${API_BASE}/config`),
        ]);
        if (!signalResponse.ok) throw new Error(`Signals request failed (${signalResponse.status})`);
        if (!configResponse.ok) throw new Error(`Configuration request failed (${configResponse.status})`);
        const [signalData, configData] = await Promise.all([signalResponse.json(), configResponse.json()]);
        if (!active) return;
        setSignals(Array.isArray(signalData) ? signalData.slice().reverse() : []);
        setConfig(configData || {});
        setLastUpdated(new Date());
        setLoadError("");
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message : "Could not load strategy data.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadData();
    const interval = window.setInterval(loadData, 10000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const enabledFilters = useMemo(
    () => filterLabels.filter(({ key }) => Boolean(config?.[key])),
    [config],
  );
  const enabledSessions = sessionLabels.filter(({ key }) => Boolean(config?.[key]));
  const executedCount = signals.filter(signal => (signal.status || "").toUpperCase() === "EXECUTED").length;
  const blockedCount = signals.filter(signal => (signal.status || "").toUpperCase() !== "EXECUTED").length;
  const pairs = config?.trading_pairs || [];

  return (
    <div className="w-full space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-2 text-sm text-primary"><Layers3 className="h-4 w-4" /> Strategy workspace</div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Trading Strategies</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Review the strategy currently running on this AlgoGuardian installation, the rules guarding entries, and the latest decisions from your trading engine.</p>
          </div>
          <div className="flex items-center gap-2 self-start rounded-full border border-border bg-background/80 px-3 py-2 text-xs font-medium md:self-auto">
            <span className={`h-2 w-2 rounded-full ${config ? "bg-emerald-500" : "bg-muted-foreground"}`} />
            {config ? "Configuration loaded" : loading ? "Loading strategy…" : "Strategy unavailable"}
          </div>
        </div>
      </section>

      {loadError && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Strategy data could not be refreshed: {loadError}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground"><span>Recent decisions</span><Activity className="h-4 w-4" /></div>
          <div className="mt-3 text-3xl font-bold tabular-nums">{signals.length}</div>
          <p className="mt-1 text-xs text-muted-foreground">Latest signal records returned by the engine</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground"><span>Executed</span><ArrowUpRight className="h-4 w-4 text-emerald-500" /></div>
          <div className="mt-3 text-3xl font-bold tabular-nums">{executedCount}</div>
          <p className="mt-1 text-xs text-muted-foreground">Marked EXECUTED in recent decisions</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground"><span>Other outcomes</span><ArrowDownRight className="h-4 w-4 text-amber-500" /></div>
          <div className="mt-3 text-3xl font-bold tabular-nums">{blockedCount}</div>
          <p className="mt-1 text-xs text-muted-foreground">Other statuses; not all necessarily mean a rejected trade</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground"><span>Enabled safeguards</span><ShieldCheck className="h-4 w-4" /></div>
          <div className="mt-3 text-3xl font-bold tabular-nums">{enabledFilters.length}<span className="text-base font-medium text-muted-foreground"> / {filterLabels.length}</span></div>
          <p className="mt-1 text-xs text-muted-foreground">Entry filters enabled in current configuration</p>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-border p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-primary/10 p-3 text-primary"><TrendingUp className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">Fast XAUUSD Scalper</h2>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">Current strategy</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">EMA trend and entry confirmation with configurable momentum, volatility, spread and breakout filters.</p>
              </div>
            </div>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><BarChart3 className="h-4 w-4" /> Trend timeframe</div>
              <div className="mt-2 text-xl font-semibold">{config?.trend_tf || "—"}</div>
              <p className="mt-1 text-xs text-muted-foreground">EMA {config?.ema_fast ?? "—"} / {config?.ema_slow ?? "—"} trend periods</p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Zap className="h-4 w-4" /> Entry timeframe</div>
              <div className="mt-2 text-xl font-semibold">{config?.entry_tf || "—"}</div>
              <p className="mt-1 text-xs text-muted-foreground">Entry EMA {config?.entry_ema ?? "—"}</p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Gauge className="h-4 w-4" /> Risk per trade</div>
              <div className="mt-2 text-xl font-semibold">{config?.risk_per_trade == null ? "—" : `${config.risk_per_trade}%`}</div>
              <p className="mt-1 text-xs text-muted-foreground">Configured risk budget for each entry</p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Target className="h-4 w-4" /> Position cap</div>
              <div className="mt-2 text-xl font-semibold">{config?.max_open_positions ?? "—"}</div>
              <p className="mt-1 text-xs text-muted-foreground">Maximum open positions per symbol</p>
            </div>
          </div>
          <div className="border-t border-border p-5">
            <div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-semibold">Entry safeguards</h3><span className="text-xs text-muted-foreground">{enabledFilters.length} enabled</span></div>
            {enabledFilters.length ? (
              <div className="flex flex-wrap gap-2">
                {enabledFilters.map(filter => <span key={filter.key} className="rounded-full border border-emerald-500/25 bg-emerald-500/5 px-3 py-1.5 text-xs text-emerald-700 dark:text-emerald-300">{filter.label}</span>)}
              </div>
            ) : <p className="text-sm text-muted-foreground">No optional entry filters are enabled in the current configuration.</p>}
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2"><Target className="h-5 w-5 text-primary" /><h2 className="font-semibold">Markets & sessions</h2></div>
            <div className="mb-4">
              <p className="mb-2 text-xs text-muted-foreground">Configured trading symbols</p>
              <div className="flex flex-wrap gap-2">
                {pairs.length ? pairs.map(pair => <span key={pair} className="rounded-md bg-muted px-2.5 py-1.5 text-xs font-medium">{pair}</span>) : <span className="text-sm text-muted-foreground">No symbols configured</span>}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs text-muted-foreground">Enabled sessions</p>
              <div className="flex flex-wrap gap-2">
                {enabledSessions.length ? enabledSessions.map(session => <span key={session.key} className="rounded-md border border-border px-2.5 py-1.5 text-xs">{session.label}</span>) : <span className="text-sm text-muted-foreground">No sessions enabled</span>}
              </div>
            </div>
            <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">Change symbols, sessions, filters and risk controls in Settings.</p>
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2"><Clock3 className="h-5 w-5 text-primary" /><h2 className="font-semibold">Strategy activity</h2></div>
            <p className="text-sm text-muted-foreground">The latest decision records refresh automatically every 10 seconds.</p>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-muted/50 p-3 text-xs">
              <span className="text-muted-foreground">Last successful refresh</span>
              <span className="font-medium">{lastUpdated ? lastUpdated.toLocaleTimeString() : "Waiting…"}</span>
            </div>
            <Button variant="outline" className="mt-3 w-full" onClick={() => window.location.reload()}>Refresh workspace</Button>
          </Card>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-lg font-semibold">Recent strategy decisions</h2><p className="mt-1 text-sm text-muted-foreground">Signal, status, timestamp and reason reported by the trading engine.</p></div>
          <span className="text-xs text-muted-foreground">{loading ? "Loading decisions…" : `Showing ${signals.length} records`}</span>
        </div>
        {signals.length === 0 ? (
          <div className="p-8 text-center">
            <Activity className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-medium">No strategy decisions yet</p>
            <p className="mt-1 text-sm text-muted-foreground">When the engine reports decisions, they will appear here automatically.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {signals.map((signal, index) => {
              const status = (signal.status || "UNKNOWN").toUpperCase();
              const executed = status === "EXECUTED";
              return (
                <div key={`${signal.timestamp || "signal"}-${signal.symbol || "symbol"}-${index}`} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{signal.symbol || "Unknown symbol"}</span>
                      <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">{signal.signal || "No signal label"}</span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${executed ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>{status}</span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{signal.reason || "No reason was provided by the engine."}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{prettyDate(signal.timestamp)}</p>
                  </div>
                  {signal.confidence != null && <div className="text-left sm:text-right"><p className="text-lg font-semibold tabular-nums">{signal.confidence}%</p><p className="text-xs text-muted-foreground">Reported confidence</p></div>}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
