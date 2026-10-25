import { motion } from "framer-motion";
import { Power, Pause, Shield, Clock, Zap, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

import { API_BASE } from "@/config/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type BotAction = "start" | "pause";

const BotStatus = () => {
  const [isActive, setIsActive] = useState(false);
  const [isKillSwitch, setIsKillSwitch] = useState(false);
  const [confirmationAction, setConfirmationAction] = useState<BotAction | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const [botStatus, setBotStatus] = useState({
    uptime: "0h",
    latency: "0ms",
    equity: "$0",
  });

  const [session, setSession] = useState("CLOSED");
  const [openTrades, setOpenTrades] = useState(0);
  const [maxOpenPositions, setMaxOpenPositions] = useState(1);

  const fetchBotStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/bot/status`);
      if (!response.ok) return;
      const data = await response.json();

      setBotStatus({
        uptime: data.uptime || "0h",
        latency: data.latency || "0ms",
        equity: data.equity || "$0",
      });
      setSession(data.session || "CLOSED");
      setOpenTrades(data.open_trades || 0);
      setMaxOpenPositions(data.config?.max_open_positions ?? 1);
      setIsActive(data.running || false);
      setIsKillSwitch(data.kill_switch || false);
    } catch (err) {
      console.error("Failed to fetch bot status:", err);
    }
  };

  useEffect(() => {
    void fetchBotStatus();
    const interval = setInterval(() => void fetchBotStatus(), 5000);
    return () => clearInterval(interval);
  }, []);

  const runConfirmedAction = async () => {
    if (!confirmationAction || actionBusy) return;

    const action = confirmationAction;
    setActionBusy(true);
    try {
      const response = await fetch(`${API_BASE}/bot/${action === "start" ? "start" : "pause"}`, {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const detail = typeof data.detail === "string"
          ? data.detail
          : typeof data.message === "string"
            ? data.message
            : `Request failed (${response.status})`;
        throw new Error(detail);
      }

      await fetchBotStatus();
      setConfirmationAction(null);
      toast.success(action === "start" ? "AlgoGuardian start request accepted." : "AlgoGuardian pause request accepted.", {
        description: action === "start"
          ? "Check the bot status to confirm it is running."
          : "New automated trades should stop. Existing positions may remain open.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Please check the backend connection and try again.";
      toast.error(action === "start" ? "Could not start AlgoGuardian" : "Could not pause AlgoGuardian", {
        description: message,
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleKillBot = async () => {
    try {
      const response = await fetch(`${API_BASE}/bot/kill`, { method: "POST" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(typeof data.detail === "string" ? data.detail : `Request failed (${response.status})`);
      }
      await fetchBotStatus();
      toast.success("Kill switch request accepted.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Please check the backend connection and try again.";
      toast.error("Could not activate kill switch", { description: message });
    }
  };

  const isStarting = confirmationAction === "start";

  return (
    <>
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
            {isKillSwitch ? "KILL SWITCH ON" : isActive ? "BOT ACTIVE" : "BOT PAUSED"}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setConfirmationAction("start")}
            disabled={actionBusy}
            className="flex items-center gap-1.5 rounded-md bg-trading-green/10 px-3 py-1.5 text-xs font-medium text-trading-green transition-colors hover:bg-trading-green/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Power className="h-3 w-3" />
            Start
          </button>
          <button
            type="button"
            onClick={() => setConfirmationAction("pause")}
            disabled={actionBusy}
            className="flex items-center gap-1.5 rounded-md bg-yellow-500/10 px-3 py-1.5 text-xs font-medium text-yellow-500 transition-colors hover:bg-yellow-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Pause className="h-3 w-3" />
            Pause
          </button>
          <button
            type="button"
            onClick={() => void handleKillBot()}
            className="flex items-center gap-1.5 rounded-md bg-trading-red/10 px-3 py-1.5 text-xs font-medium text-trading-red transition-colors hover:bg-trading-red/20"
          >
            <Shield className="h-3 w-3" />
            Kill Switch
          </button>
        </div>

        <div className="ml-4 hidden items-center gap-4 border-l border-border pl-4 sm:flex">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{session} Session</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Zap className="h-3 w-3 text-trading-green" />
            <span className="font-mono">{openTrades} positions open</span>
          </div>
        </div>
      </motion.div>

      <AlertDialog
        open={confirmationAction !== null}
        onOpenChange={(open) => {
          if (!open && !actionBusy) setConfirmationAction(null);
        }}
      >
        <AlertDialogContent className="max-w-[calc(100%-2rem)] overflow-hidden rounded-2xl border-border bg-card p-0 shadow-2xl sm:max-w-md">
          <div className={`h-1 w-full ${isStarting ? "bg-trading-green" : "bg-amber-500"}`} />
          <div className="p-6 sm:p-7">
            <AlertDialogHeader className="space-y-4 text-left">
              <div className="flex items-start gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${isStarting ? "bg-trading-green/10 text-trading-green" : "bg-amber-500/10 text-amber-500"}`}>
                  {isStarting ? <Power className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                </div>
                <div className="min-w-0 space-y-1.5">
                  <AlertDialogTitle className="text-xl font-semibold tracking-tight text-foreground">
                    {isStarting ? "Start AlgoGuardian?" : "Pause AlgoGuardian?"}
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-sm leading-6 text-muted-foreground">
                    {isStarting
                      ? "Enable the bot to monitor the configured market and act according to your active strategy and risk settings."
                      : "Pause the bot to stop it from initiating new automated trades."}
                  </AlertDialogDescription>
                </div>
              </div>
            </AlertDialogHeader>

            <div className="mt-5 rounded-xl border border-border bg-secondary/50 p-4">
              {isStarting ? (
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-trading-green" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Review before starting</p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      Make sure your trading account is connected and your risk settings are correct. Trading can result in losses.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Open positions may remain active</p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      Pausing does not automatically close existing trades or cancel orders already held by your broker.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <AlertDialogFooter className="mt-6 gap-2 sm:flex-row sm:space-x-0">
              <AlertDialogCancel
                disabled={actionBusy}
                className="mt-0 h-10 flex-1 rounded-lg border-border bg-background text-foreground hover:bg-secondary"
              >
                {isStarting ? "Cancel" : "Keep Running"}
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={actionBusy}
                onClick={(event) => {
                  event.preventDefault();
                  void runConfirmedAction();
                }}
                className={`h-10 flex-1 rounded-lg font-semibold text-white hover:opacity-90 ${isStarting ? "bg-trading-green hover:bg-trading-green" : "bg-amber-600 hover:bg-amber-600"}`}
              >
                {actionBusy ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing…</>
                ) : (
                  <>{isStarting ? <Power className="mr-2 h-4 w-4" /> : <Pause className="mr-2 h-4 w-4" />}{isStarting ? "Start Bot" : "Pause Bot"}</>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default BotStatus;
