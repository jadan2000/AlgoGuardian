import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useState, useEffect } from "react";

import { API_BASE } from "@/config/api";

const trendIcon = (trend: string) => {
  if (trend === "bullish") return <TrendingUp className="h-4 w-4 text-trading-green" />;
  if (trend === "bearish") return <TrendingDown className="h-4 w-4 text-trading-red" />;
  return <Minus className="h-4 w-4 text-trading-yellow" />;
};

const trendBadge = (trend: string) => {
  const base = "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider";
  if (trend === "bullish") return `${base} bg-trading-green\/10 text-trading-green`;
  if (trend === "bearish") return `${base} bg-trading-red\/10 text-trading-red`;
  return `${base} bg-secondary text-trading-yellow`;
};

const confidenceBar = (value: number) => {
  const color = value >= 70 ? "bg-trading-green" : value >= 50 ? "bg-trading-yellow" : "bg-trading-red";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-secondary overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="font-mono text-xs text-muted-foreground">{value}</span>
    </div>
  );
};

const MarketOverview = () => {
  const [marketPairs, setMarketPairs] = useState([]);

  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/trading/market-overview`);
        if (response.ok) {
          const data = await response.json();
          if (data.pairs) setMarketPairs(data.pairs);
        }
      } catch (err) {
        console.error("Failed to fetch market data:", err);
      }
    };

    fetchMarketData();
    const interval = setInterval(fetchMarketData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="rounded-lg border border-border bg-card glow-card"
    >
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Market Overview</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">Pair</th>
              <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">Price</th>
              <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">Change</th>
              <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">Trend</th>
              <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">Confidence</th>
              <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">ATR</th>
              <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">Spread</th>
              <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">Session</th>
            </tr>
          </thead>
          <tbody>
            {marketPairs.map((pair, i) => (
              <tr key={pair.symbol} className="border-b border-border/50 transition-colors hover:bg-secondary/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {trendIcon(pair.trend)}
                    <span className="font-semibold text-foreground">{pair.symbol}</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-foreground">{pair.price}</td>
                <td className={`px-4 py-3 font-mono ${pair.change >= 0 ? "text-trading-green" : "text-trading-red"}`}>
                  {pair.change >= 0 ? "+" : ""}{pair.change}%
                </td>
                <td className="px-4 py-3">
                  <span className={trendBadge(pair.trend)}>{pair.trend}</span>
                </td>
                <td className="px-4 py-3">{confidenceBar(pair.confidence)}</td>
                <td className="px-4 py-3 font-mono text-muted-foreground">{pair.atr}</td>
                <td className="px-4 py-3 font-mono text-muted-foreground">{pair.spread}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{pair.session}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

export default MarketOverview;
