import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

import { API_BASE } from "@/config/api";

interface BotContextType {
  isActive: boolean;
  isKillSwitch: boolean;
  isPaused: boolean;
  session: string;
  trades_today: number;
  daily_pnl: number;
  open_trades: number;

  setIsActive: (value: boolean) => void;
  setIsKillSwitch: (value: boolean) => void;
  setPaused: (value: boolean) => void;

  toggleBot: () => void;
  startBot: () => Promise<void>;
  stopBot: () => Promise<void>;
  pauseBot: () => Promise<void>;
  resumeBot: () => Promise<void>;
  activateKillSwitch: () => Promise<void>;
  deactivateKillSwitch: () => Promise<void>;
  refreshBotStatus: () => Promise<void>;
}

const BotContext = createContext<BotContextType | undefined>(undefined);

export function BotProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isActive, setIsActive] = useState(false);
  const [isKillSwitch, setIsKillSwitch] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const [session, setSession] = useState("CLOSED");
  const [trades_today, setTradesToday] = useState(0);
  const [daily_pnl, setDailyPnL] = useState(0);
  const [open_trades, setOpenTrades] = useState(0);

  const loadBotState = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/bot/status`);

      if (!response.ok) return;

      const data = await response.json();

      setIsActive(data.running || false);
      setIsPaused(data.paused || false);
      setIsKillSwitch(data.kill_switch || false);

      setSession(data.session || "CLOSED");
      setTradesToday(data.state?.trades_today || 0);
      setDailyPnL(data.state?.daily_pnl || 0);
      setOpenTrades(data.open_trades || 0);
    } catch (err) {
      console.error("Failed to load bot state:", err);
    }
  }, []);

  useEffect(() => {
    loadBotState();

    const interval = setInterval(loadBotState, 5000);

    return () => clearInterval(interval);
  }, [loadBotState]);

  const refreshBotStatus = useCallback(async () => {
    await loadBotState();
  }, [loadBotState]);

  const startBot = async () => {
    try {
      const response = await fetch(`${API_BASE}/bot/start`, {
        method: "POST",
      });

      if (response.ok) {
        await refreshBotStatus();
      }
    } catch (err) {
      console.error("Failed to start bot:", err);
    }
  };

  const stopBot = async () => {
    try {
      const response = await fetch(`${API_BASE}/bot/pause`, {
        method: "POST",
      });

      if (response.ok) {
        await refreshBotStatus();
      }
    } catch (err) {
      console.error("Failed to stop bot:", err);
    }
  };

  const pauseBot = async () => {
    try {
      const response = await fetch(`${API_BASE}/bot/pause`, {
        method: "POST",
      });

      if (response.ok) {
        await refreshBotStatus();
      }
    } catch (err) {
      console.error("Failed to pause bot:", err);
    }
  };

  const resumeBot = async () => {
    try {
      const response = await fetch(`${API_BASE}/bot/start`, {
        method: "POST",
      });

      if (response.ok) {
        await refreshBotStatus();
      }
    } catch (err) {
      console.error("Failed to resume bot:", err);
    }
  };

  const toggleBot = async () => {
    if (isActive) {
      await stopBot();
    } else {
      await startBot();
    }
  };

  const activateKillSwitch = async () => {
    try {
      const response = await fetch(`${API_BASE}/bot/kill`, {
        method: "POST",
      });

      if (response.ok) {
        await refreshBotStatus();
      }
    } catch (err) {
      console.error("Failed to activate kill switch:", err);
    }
  };

  const deactivateKillSwitch = async () => {
    setIsKillSwitch(false);
  };

  return (
    <BotContext.Provider
      value={{
        isActive,
        isKillSwitch,
        isPaused,
        session,
        trades_today,
        daily_pnl,
        open_trades,
        setIsActive,
        setIsKillSwitch,
        setPaused: setIsPaused,
        toggleBot,
        startBot,
        stopBot,
        pauseBot,
        resumeBot,
        activateKillSwitch,
        deactivateKillSwitch,
        refreshBotStatus,
      }}
    >
      {children}
    </BotContext.Provider>
  );
}

export function useBotContext() {
  const context = useContext(BotContext);

  if (context === undefined) {
    throw new Error(
      "useBotContext must be used within a BotProvider"
    );
  }

  return context;
}