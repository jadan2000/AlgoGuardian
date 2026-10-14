import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Activity, BarChart3, Shield, Target } from "lucide-react";
import { useEffect, useState } from "react";

import { API_BASE } from "@/config/api";

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  variant?: "default" | "green" | "red";
  delay?: number;
}

const StatCard = ({ label, value, icon, variant = "default", delay = 0 }: StatCardProps) => {
  const glowClass = variant === "green" ? "glow-green" : variant === "red" ? "glow-red" : "glow-card";
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={`rounded-lg border border-border bg-card p-4 ${glowClass}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className={`font-mono text-xl font-bold ${
        variant === "green" ? "text-trading-green" : variant === "red" ? "text-trading-red" : "text-foreground"
      }`}>
        {value}
      </p>
    </motion.div>
  );
};

const AccountOverview = () => {
  const [accountData, setAccountData] = useState({
    balance: 0,
    equity: 0,
    dailyPnl: 0,
    dailyPnlPercent: 0,
    openPositions: 0,
    winRate: 0,
    drawdown: 0,
    expectancy: 0,
    profitFactor: 0,
  });

  useEffect(() => {
    const fetchAccountData = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/trading/account`);
        if (response.ok) {
          const data = await response.json();
          console.log("Account API:", data);
          setAccountData({
            balance: typeof data.balance === "number" ? data.balance : 0,
            equity: typeof data.equity === "number" ? data.equity : 0,
            dailyPnl: typeof data.daily_pnl === "number" ? data.daily_pnl : 0,
            dailyPnlPercent: typeof data.daily_pnl_percent === "number" ? data.daily_pnl_percent : 0,
            openPositions: typeof data.open_positions === "number" ? data.open_positions : 0,
            winRate: typeof data.win_rate === "number" ? data.win_rate : 0,
            drawdown: typeof data.drawdown === "number" ? data.drawdown : 0,
            expectancy: typeof data.expectancy === "number" ? data.expectancy : 0,
            profitFactor: typeof data.profit_factor === "number" ? data.profit_factor : (data.profit_factor === null && Number(data.win_rate) > 0 ? Number.POSITIVE_INFINITY : 0),
          });
        }
      } catch (err) {
        console.error("Failed to fetch account data:", err);
      }
    };

    fetchAccountData();
    const interval = setInterval(fetchAccountData, 5000);
    return () => clearInterval(interval);
  }, []);

  const pnlPositive = accountData.dailyPnl >= 0;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <StatCard
        label="Balance"
        value={`$${accountData.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
        icon={<BarChart3 className="h-4 w-4" />}
        delay={0}
      />
      <StatCard
        label="Equity"
        value={`$${accountData.equity.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
        icon={<Activity className="h-4 w-4" />}
        delay={0.05}
      />
      <StatCard
        label="Daily P&L"
        value={`${pnlPositive ? "+" : ""}$${accountData.dailyPnl.toLocaleString("en-US", { minimumFractionDigits: 2 })} (${pnlPositive ? "+" : ""}${accountData.dailyPnlPercent}%)`}
        icon={pnlPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        variant={pnlPositive ? "green" : "red"}
        delay={0.1}
      />
      <StatCard
        label="Open Positions"
        value={`${accountData.openPositions}`}
        icon={<Target className="h-4 w-4" />}
        delay={0.15}
      />
      <StatCard
        label="Win Rate"
        value={`${accountData.winRate}%`}
        icon={<TrendingUp className="h-4 w-4" />}
        variant="green"
        delay={0.2}
      />
      <StatCard
        label="Drawdown"
        value={`${accountData.drawdown}%`}
        icon={<Shield className="h-4 w-4" />}
        variant={accountData.drawdown > 5 ? "red" : "default"}
        delay={0.25}
      />
      <StatCard
        label="Expectancy"
        value={accountData.expectancy.toFixed(2)}
        icon={<Activity className="h-4 w-4" />}
        variant={accountData.expectancy >= 0 ? "green" : "red"}
        delay={0.3}
      />

      <StatCard
        label="Profit Factor"
        value={accountData.profitFactor === Number.POSITIVE_INFINITY ? "∞" : accountData.profitFactor.toFixed(2)}
        icon={<BarChart3 className="h-4 w-4" />}
        variant={accountData.profitFactor >= 1 ? "green" : "red"}
        delay={0.35}
      
        



      />
    </div>
  );
};

export default AccountOverview;
