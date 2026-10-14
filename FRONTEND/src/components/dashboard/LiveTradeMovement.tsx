import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Radio, TrendingDown, TrendingUp } from "lucide-react";
import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { API_BASE } from "@/config/api";

type LivePosition = {
  ticket: number | string;
  symbol: string;
  type: "BUY" | "SELL" | string;
  volume: number;
  entry_price: number;
  current_price: number;
  profit: number;
  sl: number;
  tp: number;
};

type Sample = { time: string; timestamp: number; price: number; profit: number };

const money = (value: number) => `${value < 0 ? "-$" : "$"}${Math.abs(value).toFixed(2)}`;
const price = (value: number) => Number.isFinite(value) ? value.toFixed(3) : "—";

export default function LiveTradeMovement() {
  const [positions, setPositions] = useState<LivePosition[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let inFlight = false;

    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await fetch(`${API_BASE}/api/trading/account`, { cache: "no-store" });
        if (!response.ok) throw new Error(`MT5 account endpoint returned HTTP ${response.status}`);
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        if (!mounted) return;

        const live: LivePosition[] = (data.trade_activity || []).map((p: any) => ({
          ticket: p.ticket,
          symbol: String(p.symbol || "UNKNOWN"),
          type: String(p.type || "UNKNOWN").toUpperCase(),
          volume: Number(p.volume) || 0,
          entry_price: Number(p.entry_price),
          current_price: Number(p.current_price),
          profit: Number(p.profit) || 0,
          sl: Number(p.sl) || 0,
          tp: Number(p.tp) || 0,
        })).filter((p: LivePosition) => Number.isFinite(p.current_price) && Number.isFinite(p.entry_price));

        setPositions(live);
        setLastUpdate(Date.now());
        setError(null);
        if (!live.length) {
          setSelectedTicket(null);
          setSamples([]);
          return;
        }

        setSelectedTicket((current) => {
          if (current && live.some((p) => String(p.ticket) === current)) return current;
          return String(live[0].ticket);
        });
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : "Unable to load live MT5 position");
      } finally {
        inFlight = false;
      }
    };

    void poll();
    const timer = window.setInterval(poll, 1500);
    return () => { mounted = false; window.clearInterval(timer); };
  }, []);

  const selected = positions.find((p) => String(p.ticket) === selectedTicket) || positions[0] || null;

  useEffect(() => {
    if (!selected) return;
    const sample: Sample = {
      time: new Date().toLocaleTimeString([], { minute: "2-digit", second: "2-digit" }),
      timestamp: Date.now(),
      price: selected.current_price,
      profit: selected.profit,
    };
    setSamples((previous) => {
      if (previous.length && previous[previous.length - 1].timestamp === sample.timestamp) return previous;
      return [...previous, sample].slice(-80);
    });
  }, [selected?.ticket, selected?.current_price, selected?.profit]);

  const priceDomain = useMemo(() => {
    if (!selected) return ["auto", "auto"] as [string, string];
    const values = [selected.entry_price, selected.current_price, selected.sl, selected.tp, ...samples.map((s) => s.price)].filter((n) => n > 0);
    const low = Math.min(...values);
    const high = Math.max(...values);
    const pad = Math.max((high - low) * 0.2, 0.05);
    return [low - pad, high + pad] as [number, number];
  }, [selected, samples]);

  const positive = (selected?.profit || 0) >= 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border bg-card glow-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">Live Trade Movement</h2>
            <p className="text-xs text-muted-foreground">Actual open MT5 position · live price snapshots</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {selected && positions.length > 1 && (
            <select value={String(selected.ticket)} onChange={(e) => { setSelectedTicket(e.target.value); setSamples([]); }}
              className="max-w-[180px] rounded-md border border-border bg-background px-2 py-1.5 text-foreground">
              {positions.map((p) => <option key={p.ticket} value={String(p.ticket)}>{p.symbol} · #{p.ticket}</option>)}
            </select>
          )}
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${selected ? "bg-trading-green/10 text-trading-green" : "bg-secondary text-muted-foreground"}`}>
            <Radio className="h-3 w-3" /> {selected ? "LIVE" : "NO OPEN TRADE"}
          </span>
        </div>
      </div>

      {error ? (
        <div className="px-4 py-8 text-center text-sm text-trading-red">Could not load live trade data: {error}</div>
      ) : !selected ? (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
          <Activity className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No open MT5 position</p>
          <p className="max-w-md text-xs text-muted-foreground">When a real position is open, its actual MT5 price and floating P&L will appear here. No simulated trade data is shown.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 border-b border-border p-4 sm:grid-cols-4">
            <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Instrument / Side</p><p className="mt-1 text-sm font-semibold text-foreground">{selected.symbol} <span className={selected.type === "BUY" ? "text-trading-green" : "text-trading-red"}>{selected.type}</span></p><p className="text-xs text-muted-foreground">{selected.volume} lots · #{selected.ticket}</p></div>
            <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Entry</p><p className="mt-1 font-mono text-sm text-foreground">{price(selected.entry_price)}</p></div>
            <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Live price</p><p className="mt-1 font-mono text-sm text-foreground">{price(selected.current_price)}</p></div>
            <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Floating P&L</p><p className={`mt-1 flex items-center gap-1 font-mono text-lg font-bold ${positive ? "text-trading-green" : "text-trading-red"}`}>{positive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}{money(selected.profit)}</p></div>
          </div>
          <div className="p-4">
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="text-muted-foreground">Entry <strong className="font-mono text-foreground">{price(selected.entry_price)}</strong></span>
              <span className="text-trading-red">SL <strong className="font-mono">{selected.sl > 0 ? price(selected.sl) : "Not set"}</strong></span>
              <span className="text-trading-green">TP <strong className="font-mono">{selected.tp > 0 ? price(selected.tp) : "Not set"}</strong></span>
              <span className="ml-auto text-muted-foreground">Updated {lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : "—"} · polling every 1.5s</span>
            </div>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={samples} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 25%)" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} minTickGap={24} />
                  <YAxis domain={priceDomain} tick={{ fontSize: 10 }} width={76} tickFormatter={(v) => Number(v).toFixed(3)} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(value: number, name: string) => [name === "price" ? price(value) : money(value), name === "price" ? "Market price" : "Floating P&L"]} />
                  <ReferenceLine y={selected.entry_price} stroke="hsl(210, 80%, 60%)" strokeDasharray="5 4" label={{ value: "Entry", position: "insideTopLeft", fontSize: 10 }} />
                  {selected.sl > 0 && <ReferenceLine y={selected.sl} stroke="hsl(14, 100%, 55%)" strokeDasharray="4 4" label={{ value: "SL", position: "insideTopLeft", fontSize: 10 }} />}
                  {selected.tp > 0 && <ReferenceLine y={selected.tp} stroke="hsl(145, 100%, 39%)" strokeDasharray="4 4" label={{ value: "TP", position: "insideTopLeft", fontSize: 10 }} />}
                  <Line type="monotone" dataKey="price" name="price" stroke="hsl(210, 100%, 55%)" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">This chart records actual open-position prices returned by MT5 while this dashboard is open. Historical points from before this card starts polling are not fabricated.</p>
          </div>
        </>
      )}
    </motion.section>
  );
}
