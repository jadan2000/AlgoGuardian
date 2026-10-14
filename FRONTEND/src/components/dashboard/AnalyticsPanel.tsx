import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { TrendingUp, Award, BarChart3, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_BASE } from "@/config/api";

type Analytics = {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  net_profit: number;
  gross_profit: number;
  gross_loss: number;
  daily_pnl: number;
  win_rate: number;
  profit_factor: number;
  expectancy: number;
  max_drawdown: number;
  recovery_factor: number;
  annual_return: number;
  equity_curve: { date: string; equity: number }[];
  monthly_returns: { month: string; return_pct: number; pnl: number }[];
  strategy_breakdown: { name: string; trades: number; win_rate: number; avg_rr: number; pnl: number }[];
  hourly_heatmap: { day: string; hour: number; trades: number; pnl: number }[];
  recent_trades: { ticket: number; symbol: string; type: string; profit: number; close_time: string; volume: number }[];
};

const money = (value: number) => `${value < 0 ? "-$" : "$"}${Math.abs(value || 0).toFixed(2)}`;
const number = (value: unknown, digits = 2) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "—";
const pfText = (value: number) => value === Infinity ? "∞" : number(value);

function MetricCard({ label, value, icon, positive }: { label: string; value: string; icon: React.ReactNode; positive?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border bg-card p-4 glow-card">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className={`font-mono text-lg font-bold ${positive === undefined ? "text-foreground" : positive ? "text-trading-green" : "text-trading-red"}`}>{value}</p>
    </motion.div>
  );
}

const TooltipBox = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="font-mono text-sm font-semibold text-foreground">{money(Number(payload[0].value))}</p>
  </div>;
};

export default function AnalyticsPanel() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`${API_BASE}/analytics/overview`);
      if (!response.ok) throw new Error(`Analytics API returned HTTP ${response.status}`);
      const data = await response.json();
      setAnalytics({
        total_trades: 0, winning_trades: 0, losing_trades: 0, net_profit: 0,
        gross_profit: 0, gross_loss: 0, daily_pnl: 0, win_rate: 0,
        profit_factor: 0, expectancy: 0, max_drawdown: 0, recovery_factor: 0,
        annual_return: 0, equity_curve: [], monthly_returns: [],
        strategy_breakdown: [], hourly_heatmap: [], recent_trades: [], ...data,
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    const timer = window.setInterval(fetchAnalytics, 10000);
    return () => window.clearInterval(timer);
  }, []);

  if (loading) return <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-secondary" />)}</div>;

  if (error || !analytics) return <div className="rounded-lg border border-border bg-card p-6">
    <p className="mb-3 text-sm text-trading-red">Unable to load analytics: {error || "No response from backend"}</p>
    <Button variant="outline" size="sm" onClick={() => { setLoading(true); void fetchAnalytics(); }}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>
  </div>;

  const hasTrades = analytics.total_trades > 0;
  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <MetricCard label="Net Profit" value={money(analytics.net_profit)} icon={<TrendingUp className="h-4 w-4" />} positive={analytics.net_profit >= 0} />
      <MetricCard label="Daily P&L" value={money(analytics.daily_pnl)} icon={<BarChart3 className="h-4 w-4" />} positive={analytics.daily_pnl >= 0} />
      <MetricCard label="Profit Factor" value={pfText(analytics.profit_factor)} icon={<Award className="h-4 w-4" />} />
      <MetricCard label="Max Drawdown" value={`${number(analytics.max_drawdown)}%`} icon={<AlertTriangle className="h-4 w-4" />} positive={analytics.max_drawdown === 0} />
    </div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <MetricCard label="Closed Trades" value={String(analytics.total_trades)} icon={<BarChart3 className="h-4 w-4" />} />
      <MetricCard label="Win Rate" value={`${number(analytics.win_rate, 1)}%`} icon={<TrendingUp className="h-4 w-4" />} positive={analytics.win_rate >= 50} />
      <MetricCard label="Expectancy" value={money(analytics.expectancy)} icon={<Award className="h-4 w-4" />} positive={analytics.expectancy >= 0} />
      <MetricCard label="Wins / Losses" value={`${analytics.winning_trades} / ${analytics.losing_trades}`} icon={<BarChart3 className="h-4 w-4" />} />
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-border bg-card p-4 glow-card">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Closed-trade equity curve</h3>
        {analytics.equity_curve.length ? <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={analytics.equity_curve}><defs><linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(210, 100%, 50%)" stopOpacity={0.3}/><stop offset="95%" stopColor="hsl(210, 100%, 50%)" stopOpacity={0}/></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 25%)"/><XAxis dataKey="date" tick={{ fontSize: 10 }}/><YAxis tick={{ fontSize: 10 }}/><Tooltip formatter={(v: number) => money(v)}/><Area dataKey="equity" type="monotone" stroke="hsl(210, 100%, 50%)" fill="url(#equityGradient)"/></AreaChart>
        </ResponsiveContainer> : <p className="py-16 text-center text-sm text-muted-foreground">Closed trades will appear here when MT5 history is available.</p>}
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-border bg-card p-4 glow-card">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Monthly realized P&L</h3>
        {analytics.monthly_returns.length ? <ResponsiveContainer width="100%" height={250}>
          <BarChart data={analytics.monthly_returns}><CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 25%)"/><XAxis dataKey="month" tick={{ fontSize: 10 }}/><YAxis tick={{ fontSize: 10 }}/><Tooltip content={<TooltipBox/>}/><Bar dataKey="pnl" radius={[4,4,0,0]}>{analytics.monthly_returns.map((item, i) => <Cell key={i} fill={item.pnl >= 0 ? "hsl(145, 100%, 39%)" : "hsl(14, 100%, 50%)"}/>)}</Bar></BarChart>
        </ResponsiveContainer> : <p className="py-16 text-center text-sm text-muted-foreground">Monthly results will appear after closed trades are recorded.</p>}
      </motion.div>
    </div>
    <div className="rounded-lg border border-border bg-card p-4 glow-card">
      <h3 className="mb-3 text-sm font-semibold text-foreground">Closed trades</h3>
      {!analytics.recent_trades.length ? <p className="py-8 text-center text-sm text-muted-foreground">No closed trades in MT5 history for the selected period.</p> :
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">{["Ticket","Symbol","Type","Volume","Closed","P&L"].map(h => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead><tbody>
          {analytics.recent_trades.map(t => <tr key={t.ticket} className="border-b border-border/50"><td className="px-3 py-2 font-mono">{t.ticket}</td><td className="px-3 py-2">{t.symbol}</td><td className="px-3 py-2">{t.type}</td><td className="px-3 py-2 font-mono">{t.volume}</td><td className="px-3 py-2">{t.close_time && !Number.isNaN(Date.parse(t.close_time)) ? new Date(t.close_time).toLocaleString() : "—"}</td><td className={`px-3 py-2 font-mono font-semibold ${t.profit >= 0 ? "text-trading-green" : "text-trading-red"}`}>{money(t.profit)}</td></tr>)}
        </tbody></table></div>}
      {!hasTrades && <p className="mt-2 text-xs text-muted-foreground">Metrics are based on realized MT5 deal history, not open-position floating P&L.</p>}
    </div>
    <div className="text-xs text-muted-foreground">Updated automatically every 10 seconds from MT5 closed-deal history.</div>
  </div>;
}
