import { motion } from "framer-motion";
import { Power, Pause, Shield, Clock, Zap } from "lucide-react";
import { useState, useEffect } from "react";

import { API_BASE } from "@/config/api";

const BotStatus = () => {
  const [isActive, setIsActive] = useState(false);
  const [isKillSwitch, setIsKillSwitch] = useState(false);

  const [botStatus, setBotStatus] = useState({
    uptime: "0h",
    latency: "0ms",
    equity: "$0",
  });

  const [session, setSession] = useState("CLOSED");
  const [openTrades, setOpenTrades] = useState(0);
  const [maxTrades, setMaxTrades] = useState(5);

  const fetchBotStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/bot/status`);

      if (response.ok) {
        const data = await response.json();

        setBotStatus({
          uptime: data.uptime || "0h",
          latency: data.latency || "0ms",
          equity: data.equity || "$0",
        });

        setSession(data.session || "CLOSED");
        setOpenTrades(data.open_trades || 0);
        setMaxTrades(data.config?.max_trades_per_day || 5);

        setIsActive(data.running || false);
        setIsKillSwitch(data.kill_switch || false);
      }
    } catch (err) {
      console.error("Failed to fetch bot status:", err);
    }
  };

  useEffect(() => {
    fetchBotStatus();

    const interval = setInterval(fetchBotStatus, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleStartBot = async () => {
    try {
      const response = await fetch(`${API_BASE}/bot/start`, {
        method: "POST",
      });

      if (response.ok) {
        fetchBotStatus();
      }
    } catch (err) {
      console.error("Failed to start bot:", err);
    }
  };

  const handlePauseBot = async () => {
    try {
      const response = await fetch(`${API_BASE}/bot/pause`, {
        method: "POST",
      });

      if (response.ok) {
        fetchBotStatus();
      }
    } catch (err) {
      console.error("Failed to pause bot:", err);
    }
  };

  const handleKillBot = async () => {
    try {
      const response = await fetch(`${API_BASE}/bot/kill`, {
        method: "POST",
      });

      if (response.ok) {
        fetchBotStatus();
      }
    } catch (err) {
      console.error("Failed to activate kill switch:", err);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 }}
      className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 glow-card"
    >
      <div className="flex items-center gap-2">
        <div
          className={`h-2.5 w-2.5 rounded-full ${
            isActive && !isKillSwitch
              ? "bg-trading-green animate-pulse-subtle"
              : "bg-trading-red"
          }`}
        />

        <span className="text-sm font-semibold text-foreground">
          {isKillSwitch
            ? "KILL SWITCH ON"
            : isActive
            ? "BOT ACTIVE"
            : "BOT PAUSED"}
        </span>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <button
          onClick={handleStartBot}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-trading-green/10 text-trading-green hover:bg-trading-green/20 transition-colors"
        >
          <Power className="h-3 w-3" />
          Start
        </button>

        <button
          onClick={handlePauseBot}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 transition-colors"
        >
          <Pause className="h-3 w-3" />
          Pause
        </button>

        <button
          onClick={handleKillBot}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-trading-red/10 text-trading-red hover:bg-trading-red/20 transition-colors"
        >
          <Shield className="h-3 w-3" />
          Kill Switch
        </button>
      </div>

      <div className="hidden sm:flex items-center gap-4 ml-4 border-l border-border pl-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{session} Session</span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Zap className="h-3 w-3 text-trading-green" />
          <span className="font-mono">
            {openTrades}/{maxTrades} trades open
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default BotStatus;