import React, { useState } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";

import AccountOverview from "@/components/dashboard/AccountOverview";
import MarketOverview from "@/components/dashboard/MarketOverview";
import TradeActivity from "@/components/dashboard/TradeActivity";
import LiveTradeMovement from "@/components/dashboard/LiveTradeMovement";
import AnalyticsPanel from "@/components/dashboard/AnalyticsPanel";
import StrategySignalsPanel from "@/components/dashboard/StrategySignalsPanel";
import BotStatus from "@/components/dashboard/BotStatus";
import { SettingsPanel } from "@/components/dashboard/SettingsPanel";
import { LogsPanel } from "@/components/dashboard/LogsPanel";
import Sidebar from "@/components/layout/Sidebar";

import { useEffect } from "react";
import { getHealth } from "@/services/api";
import { API_BASE } from "@/config/api";

const Index = () => {
  const { theme, setTheme } = useTheme();

   useEffect(() => {
     console.log("useEffect running");
     
    getHealth()
      .then((data) => {
        console.log("Backend Response:", data);
      })
      .catch((err) => {
        console.error("Backend Error:", err);
      });
  }, []);

  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [mt5Connected, setMt5Connected] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let mounted = true;
    const refreshConnection = async () => {
      try {
        const response = await fetch(`${API_BASE}/bot/status`);
        if (!response.ok) throw new Error(`Status request failed (${response.status})`);
        const data = await response.json();
        if (mounted) setMt5Connected(Boolean(data.connected));
      } catch {
        if (mounted) setMt5Connected(false);
      }
    };
    refreshConnection();
    const interval = window.setInterval(refreshConnection, 5000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  React.useEffect(() => {
    if (mounted && theme) {
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
        document.body.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
        document.body.classList.remove("dark");
      }
    }
  }, [theme, mounted]);

  const handleThemeChange = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="mx-auto max-w-[1440px] px-4 py-3 flex items-center justify-between">
          <div aria-hidden="true" />

          <div className="flex items-center gap-3">
            <button
              onClick={handleThemeChange}
              className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary"
            >
              {mounted && theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>

            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <div className={`h-2 w-2 rounded-full ${mt5Connected ? "bg-green-500" : "bg-red-500"}`} />
              {mt5Connected ? "MT5 Connected" : "MT5 Disconnected"}
            </div>
          </div>
        </div>
      </header>

      {/* Layout */}
      <div className="flex flex-col md:flex-row">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        <main className="flex-1 min-w-0 p-3 md:p-6 space-y-4 md:space-y-6 overflow-x-hidden">
          <BotStatus />

          {activeTab === "dashboard" && (
            <>
              <AccountOverview />
              <LiveTradeMovement />
              <MarketOverview />
              <TradeActivity />
            </>
          )}

          {activeTab === "strategies" && <StrategySignalsPanel />}

          {activeTab === "analytics" && <AnalyticsPanel />}

          {activeTab === "settings" && <SettingsPanel />}

          {activeTab === "logs" && <LogsPanel />}
        </main>
      </div>
    </div>
  );
};

export default Index;