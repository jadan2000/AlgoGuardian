import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { TrendingUp, Award, BarChart3, AlertTriangle, RefreshCw, Target, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_BASE } from "@/config/api";

type Trade = { ticket: number; symbol: string; type: string; profit: number; close_time: string; volume: number };
type Analytics = {
  total_trades: number; winning_trades: number; losing_trades: number;
  net_profit: number; gross_profit: number; gross_loss: number; daily_pnl: number;
  win_rate: number; profit_factor: number | null; expectancy: number; max_drawdown: number;
  recovery_factor: number; annual_return: number;
  equity_curve: { date: string; equity: number }[];
  monthly_returns: { month: string; return_pct: number; pnl: number }[];
  strategy_breakdown: { name: string; trades: number; win_rate: number; avg_rr: number; pnl: number }[];
  hourly_heatmap: { day: string; hour: number; trades: number; pnl: number }[];
  recent_trades: Trade[];
};

const money = (value: number) => `${value < 0 ? "-$" : "$"}${Math.abs(value || 0).toFixed(2)}`;
const n = (value: unknown, digits = 2) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "—";
const pfText = (value: number | null, wins: number) => value === null && wins > 0 ? "∞" : n(value);
const chartTick = { fill: "hsl(var(--muted-foreground))", fontSize: 11 };
const gridStroke = "hsl(var(--border))";

function MetricCard({ label, value, icon, positive }: { label: string; value: string; icon: React.ReactNode; positive?: boolean }) {
  return <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
    className="rounded-lg border border-border bg-card p-4 glow-card">
    <div className="mb-2 flex items-center gap-2"><span className="text-muted-foreground">{icon}</span><span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span></div>
    <p className={`font-mono text-xl font-bold ${positive === undefined ? "text-foreground" : positive ? "text-trading-green" : "text-trading-red"}`}>{value}</p>
  </motion.div>;
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-xl">
    <p className="mb-1 text-xs text-muted-foreground">{label}</p>
    {payload.map((entry: any) => <p key={entry.dataKey} className="font-mono text-sm font-semibold" style={{ color: entry.color || "hsl(var(--foreground))" }}>
      {entry.name || entry.dataKey}: {money(Number(entry.value))}
    </p>)}
  </div>;
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <section className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5">
    <div className="mb-4"><h3 className="text-sm font-semibold text-foreground">{title}</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{subtitle}</p></div>
    {children}
  </section>;
}

export default function AnalyticsPanel() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`${API_BASE}/analytics/overview`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Analytics API returned HTTP ${response.status}`);
      const data = await response.json();
      setAnalytics({
        total_trades: 0, winning_trades: 0, losing_trades: 0, net_profit: 0, gross_profit: 0,
        gross_loss: 0, daily_pnl: 0, win_rate: 0, profit_factor: 0, expectancy: 0, max_drawdown: 0,
        recovery_factor: 0, annual_return: 0, equity_curve: [], monthly_returns: [],
        strategy_breakdown: [], hourly_heatmap: [], recent_trades: [], ...data,
      });
      setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load analytics"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    void fetchAnalytics();
    const timer = window.setInterval(() => void fetchAnalytics(), 10000);
    return () => window.clearInterval(timer);
  }, []);

  const closedTrades = useMemo(() => [...(analytics?.recent_trades || [])]
    .filter(t => Number.isFinite(Number(t.profit)))
    .sort((a, b) => Date.parse(a.close_time) - Date.parse(b.close_time)), [analytics]);

  const tradeChart = useMemo(() => {
    let cumulative = 0;
    return closedTrades.map((t, i) => {
      cumulative += Number(t.profit) || 0;
      const time = t.close_time && !Number.isNaN(Date.parse(t.close_time))
        ? new Date(t.close_time).toLocaleDateString([], { month: "short", day: "numeric" }) : `Trade ${i + 1}`;
      return { name: `#${String(t.ticket).slice(-5)}`, time, profit: Number(t.profit) || 0, cumulative: Number(cumulative.toFixed(2)), symbol: t.symbol, type: t.type };
    });
  }, [closedTrades]);

  if (loading) return <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-secondary" />)}</div>;
  if (error || !analytics) return <div className="rounded-xl border border-border bg-card p-6">
    <p className="mb-3 text-sm text-trading-red">Unable to load analytics: {error || "No response from backend"}</p>
    <Button variant="outline" size="sm" onClick={() => { setLoading(true); void fetchAnalytics(); }}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>
  </div>;

  const hasTrades = analytics.total_trades > 0;
  const latestMonth = analytics.monthly_returns.slice(-6);
  const noLossesYet = analytics.gross_profit > 0 && analytics.gross_loss === 0;

  return <div className="space-y-5">
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <MetricCard label="Net realized P&L" value={money(analytics.net_profit)} icon={<Wallet className="h-4 w-4" />} positive={analytics.net_profit >= 0} />
      <MetricCard label="Today's realized P&L" value={money(analytics.daily_pnl)} icon={<BarChart3 className="h-4 w-4" />} positive={analytics.daily_pnl >= 0} />
      <MetricCard label="Profit factor" value={pfText(analytics.profit_factor, analytics.winning_trades)} icon={<Award className="h-4 w-4" />} />
      <MetricCard label="Max drawdown" value={`${n(analytics.max_drawdown)}%`} icon={<AlertTriangle className="h-4 w-4" />} positive={analytics.max_drawdown === 0} />
      <MetricCard label="Closed trades" value={String(analytics.total_trades)} icon={<BarChart3 className="h-4 w-4" />} />
      <MetricCard label="Win rate" value={`${n(analytics.win_rate, 1)}%`} icon={<Target className="h-4 w-4" />} positive={analytics.win_rate >= 50} />
      <MetricCard label="Average P&L / trade" value={money(analytics.expectancy)} icon={<TrendingUp className="h-4 w-4" />} positive={analytics.expectancy >= 0} />
      <MetricCard label="Wins vs losses" value={`${analytics.winning_trades} / ${analytics.losing_trades}`} icon={<Award className="h-4 w-4" />} />
    </div>

    {noLossesYet && <div className="rounded-lg border border-border bg-secondary/50 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
      Profit factor is ∞ because no losing closed trades are recorded yet. This is a small sample, not proof of long-term profitability.
    </div>}

    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <ChartCard title="Cumulative realized P&L" subtitle="Running total of closed-trade profits and losses. Hover over a point to see the amount.">
        {tradeChart.length ? <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={tradeChart} margin={{ top: 12, right: 18, bottom: 8, left: 8 }}>
            <defs><linearGradient id="cumulativePnlFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(145, 70%, 42%)" stopOpacity={0.28}/><stop offset="100%" stopColor="hsl(145, 70%, 42%)" stopOpacity={0.02}/></linearGradient></defs>
            <CartesianGrid stroke={gridStroke} strokeDasharray="3 5" vertical={false}/>
            <XAxis dataKey="name" tick={chartTick} axisLine={false} tickLine={false} minTickGap={18}/>
            <YAxis tick={chartTick} axisLine={false} tickLine={false} width={68} tickFormatter={(v) => `${v < 0 ? "-" : ""}$${Math.abs(v).toFixed(0)}`} />
            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4"/>
            <Tooltip content={<ChartTooltip/>}/>
            <Area type="monotone" dataKey="cumulative" name="Cumulative P&L" stroke="hsl(145, 70%, 42%)" strokeWidth={3} fill="url(#cumulativePnlFill)" activeDot={{ r: 5 }} isAnimationActive={false}/>
          </AreaChart>
        </ResponsiveContainer> : <EmptyChart text="Closed trades will appear here after MT5 records them." />}
      </ChartCard>

      <ChartCard title="Profit / loss by trade" subtitle="Each bar is one closed trade. Green is profit; red is loss. Use this to spot unusually large wins or losses.">
        {tradeChart.length ? <ResponsiveContainer width="100%" height={300}>
          <BarChart data={tradeChart} margin={{ top: 12, right: 18, bottom: 8, left: 8 }}>
            <CartesianGrid stroke={gridStroke} strokeDasharray="3 5" vertical={false}/>
            <XAxis dataKey="name" tick={chartTick} axisLine={false} tickLine={false} minTickGap={18}/>
            <YAxis tick={chartTick} axisLine={false} tickLine={false} width={68} tickFormatter={(v) => `${v < 0 ? "-" : ""}$${Math.abs(v).toFixed(0)}`} />
            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))"/>
            <Tooltip content={<ChartTooltip/>}/>
            <Bar dataKey="profit" name="Trade P&L" radius={[5, 5, 0, 0]} maxBarSize={42} isAnimationActive={false}>
              {tradeChart.map((t) => <Cell key={t.name} fill={t.profit >= 0 ? "hsl(145, 70%, 42%)" : "hsl(5, 75%, 55%)"}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer> : <EmptyChart text="No closed-trade results to compare yet." />}
      </ChartCard>

      <ChartCard title="Monthly realized P&L" subtitle="Net profit or loss for each month. Bars below zero indicate a losing month.">
        {latestMonth.length ? <ResponsiveContainer width="100%" height={280}>
          <BarChart data={latestMonth} margin={{ top: 12, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid stroke={gridStroke} strokeDasharray="3 5" vertical={false}/>
            <XAxis dataKey="month" tick={chartTick} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
            <YAxis tick={chartTick} axisLine={false} tickLine={false} width={68} tickFormatter={(v) => `${v < 0 ? "-" : ""}$${Math.abs(v).toFixed(0)}`}/>
            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))"/>
            <Tooltip content={<ChartTooltip/>}/>
            <Bar dataKey="pnl" name="Monthly P&L" radius={[5, 5, 0, 0]} maxBarSize={48} isAnimationActive={false}>
              {latestMonth.map((item) => <Cell key={item.month} fill={item.pnl >= 0 ? "hsl(145, 70%, 42%)" : "hsl(5, 75%, 55%)"}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer> : <EmptyChart text="Monthly totals will appear after trades are closed." />}
      </ChartCard>

      <ChartCard title="Trade outcome summary" subtitle="A simple count of winning, losing and break-even closed trades.">
        <div className="flex h-[280px] flex-col justify-center gap-5 px-2 sm:px-6">
          {[
            { label: "Winning trades", value: analytics.winning_trades, color: "bg-trading-green" },
            { label: "Losing trades", value: analytics.losing_trades, color: "bg-trading-red" },
            { label: "Break-even trades", value: Math.max(0, analytics.total_trades - analytics.winning_trades - analytics.losing_trades), color: "bg-muted-foreground" },
          ].map((item) => {
            const pct = analytics.total_trades ? item.value / analytics.total_trades * 100 : 0;
            return <div key={item.label}>
              <div className="mb-2 flex items-center justify-between gap-3 text-sm"><span className="text-foreground">{item.label}</span><span className="font-mono text-muted-foreground">{item.value} <span className="text-xs">({pct.toFixed(0)}%)</span></span></div>
              <div className="h-3 overflow-hidden rounded-full bg-secondary"><div className={`h-full rounded-full ${item.color} transition-all`} style={{ width: `${pct}%` }}/></div>
            </div>;
          })}
          <div className="border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">Based on {analytics.total_trades} closed trades in the current MT5 history window. Open positions are not counted as wins or losses.</div>
        </div>
      </ChartCard>
    </div>

    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-4"><h3 className="text-sm font-semibold text-foreground">Recent closed trades</h3><p className="mt-1 text-xs text-muted-foreground">Most recent MT5 results, including symbol, direction, volume and realized P&L.</p></div>
      {!analytics.recent_trades.length ? <p className="px-4 py-10 text-center text-sm text-muted-foreground">No closed trades in MT5 history for the selected period.</p> :
        <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">{["Ticket","Symbol","Side","Lots","Closed","Realized P&L"].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead><tbody>
          {[...analytics.recent_trades].sort((a,b) => Date.parse(b.close_time) - Date.parse(a.close_time)).map(t => <tr key={t.ticket} className="border-b border-border/50 last:border-0 hover:bg-secondary/30"><td className="px-4 py-3 font-mono text-xs">{t.ticket}</td><td className="px-4 py-3 font-medium">{t.symbol}</td><td className={`px-4 py-3 font-medium ${t.type.toUpperCase() === "BUY" ? "text-trading-green" : "text-trading-red"}`}>{t.type}</td><td className="px-4 py-3 font-mono">{t.volume}</td><td className="px-4 py-3 text-xs text-muted-foreground">{t.close_time && !Number.isNaN(Date.parse(t.close_time)) ? new Date(t.close_time).toLocaleString() : "—"}</td><td className={`px-4 py-3 font-mono font-semibold ${t.profit >= 0 ? "text-trading-green" : "text-trading-red"}`}>{money(t.profit)}</td></tr>)}
        </tbody></table></div>}
    </section>
    <p className="text-right text-xs text-muted-foreground">Updated every 10 seconds · Data from MT5 closed-deal history</p>
  </div>;
}

function EmptyChart({ text }: { text: string }) {
  return <div className="flex h-[280px] items-center justify-center rounded-lg border border-dashed border-border px-6 text-center text-sm text-muted-foreground">{text}</div>;
}
