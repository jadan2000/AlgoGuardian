import { motion } from "framer-motion";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, Award, BarChart3, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";

import { API_BASE } from "@/config/api";

const MetricCard = ({ label, value, icon, delay }: { label: string; value: string; icon: React.ReactNode; delay: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay }}
    className="rounded-lg border border-border bg-card p-4 glow-card"
  >
    <div className="flex items-center gap-2 mb-1">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
    <p className="font-mono text-lg font-bold text-foreground">{value}</p>
  </motion.div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-mono text-sm font-semibold text-foreground">
        {typeof payload[0].value === "number" && payload[0].value < 100
          ? `${payload[0].value > 0 ? "+" : ""}${payload[0].value}%`
          : `$${payload[0].value?.toLocaleString()}`}
      </p>
    </div>
  );
};

const HeatmapGrid = ({ heatmapData }: { heatmapData: any[] }) => {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const hours = Array.from({ length: 15 }, (_, i) => i + 7);

  const getColor = (pnl: number) => {
    if (pnl > 200) return "bg-trading-green opacity-90";
    if (pnl > 50) return "bg-trading-green opacity-50";
    if (pnl > 0) return "bg-trading-green opacity-25";
    if (pnl > -50) return "bg-trading-red opacity-25";
    if (pnl > -200) return "bg-trading-red opacity-50";
    return "bg-trading-red opacity-90";
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[500px]">
        <div className="flex gap-1 mb-1 ml-10">
          {hours.map((h) => (
            <div key={h} className="w-7 text-center text-[9px] font-mono text-muted-foreground">{h}:00</div>
          ))}
        </div>
        {days.map((day) => (
          <div key={day} className="flex gap-1 mb-1 items-center">
            <div className="w-8 text-[10px] font-medium text-muted-foreground">{day}</div>
            {hours.map((hour) => {
              const cell = heatmapData.find((h) => h.day === day && h.hour === hour);
              return (
                <div
                  key={`${day}-${hour}`}
                  className={`w-7 h-6 rounded-sm ${cell ? getColor(cell.pnl) : "bg-secondary"}`}
                  title={cell ? `${day} ${hour}:00 — ${cell.trades} trades, $${cell.pnl}` : ""}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

const AnalyticsPanel = () => {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/analytics/overview`);
        if (!response.ok) throw new Error("Failed to fetch analytics");
        const data = await response.json();
        setAnalytics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        console.error("Analytics fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-secondary animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return <div className="text-red-500 p-4">Error loading analytics: {error}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Sharpe Ratio" value={analytics.sharpe_ratio.toFixed(2)} icon={<Award className="h-4 w-4" />} delay={0} />
        <MetricCard label="Profit Factor" value={analytics.profit_factor.toFixed(2)} icon={<TrendingUp className="h-4 w-4" />} delay={0.05} />
        <MetricCard label="Avg RR" value={`${analytics.avg_rr}:1`} icon={<BarChart3 className="h-4 w-4" />} delay={0.1} />
        <MetricCard label="Max Drawdown" value={`${analytics.max_drawdown}%`} icon={<AlertTriangle className="h-4 w-4" />} delay={0.15} />
      </div>

      {/* Additional Metrics Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <MetricCard label="Win Rate" value={`${analytics.win_rate.toFixed(1)}%`} icon={<TrendingUp className="h-4 w-4" />} delay={0.2} />
        <MetricCard label="Sortino Ratio" value={analytics.sortino_ratio.toFixed(2)} icon={<Award className="h-4 w-4" />} delay={0.25} />
        <MetricCard label="Expectancy" value={`$${analytics.expectancy.toFixed(0)}`} icon={<BarChart3 className="h-4 w-4" />} delay={0.3} />
        <MetricCard label="Recovery Factor" value={analytics.recovery_factor.toFixed(2)} icon={<TrendingUp className="h-4 w-4" />} delay={0.35} />
        <MetricCard label="Annual Return" value={`${analytics.annual_return.toFixed(1)}%`} icon={<AlertTriangle className="h-4 w-4" />} delay={0.4} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Equity Curve */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="rounded-lg border border-border bg-card p-4 glow-card"
        >
          <h3 className="text-sm font-semibold text-foreground mb-3">Equity Curve</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={analytics.equity_curve || []}>
              <defs>
                <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(210, 100%, 50%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(210, 100%, 50%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(215, 15%, 50%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(215, 15%, 50%)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="equity" stroke="hsl(210, 100%, 50%)" strokeWidth={2} fill="url(#equityGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Monthly Returns */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="rounded-lg border border-border bg-card p-4 glow-card"
        >
          <h3 className="text-sm font-semibold text-foreground mb-3">Monthly Returns</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={analytics.monthly_returns || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(215, 15%, 50%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(215, 15%, 50%)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="return_pct" radius={[4, 4, 0, 0]}>
                {(analytics.monthly_returns || []).map((entry: any, i: number) => (
                  <Cell key={i} fill={entry.return_pct >= 0 ? "hsl(145, 100%, 39%)" : "hsl(14, 100%, 50%)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Strategy Performance */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="rounded-lg border border-border bg-card p-4 glow-card"
        >
          <h3 className="text-sm font-semibold text-foreground mb-3">Strategy Breakdown</h3>
          <div className="space-y-3">
            {(analytics.strategy_breakdown || []).map((s: any) => (
              <div key={s.name} className="flex items-center justify-between text-sm">
                <div className="flex-1">
                  <p className="font-medium text-foreground">{s.name}</p>
                  <div className="flex gap-3 mt-0.5">
                    <span className="text-xs text-muted-foreground">{s.trades} trades</span>
                    <span className="text-xs text-trading-green">{s.win_rate.toFixed(1)}% WR</span>
                    <span className="text-xs text-muted-foreground">{s.avg_rr}R avg</span>
                  </div>
                </div>
                <span className="font-mono font-semibold text-trading-green">+${s.pnl.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Trade Heatmap */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="rounded-lg border border-border bg-card p-4 glow-card"
        >
          <h3 className="text-sm font-semibold text-foreground mb-3">Performance by Hour</h3>
          <HeatmapGrid heatmapData={analytics.hourly_heatmap || []} />
          <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-trading-red opacity-70" /> Loss</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-secondary" /> Neutral</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-trading-green opacity-70" /> Profit</div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AnalyticsPanel;
