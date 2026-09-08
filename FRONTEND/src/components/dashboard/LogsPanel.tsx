import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { API_BASE } from "@/config/api";
import { Sparkles, TrendingUp, TrendingDown, Clock, Download, X } from 'lucide-react';

interface SignalFilter {
  name: string;
  passed: boolean;
  value: string | number;
}

interface BotSignal {
  pair: string;
  direction: 'BUY' | 'SELL';
  confidence: number;
  status?: 'EXECUTED' | 'BLOCKED';
  reason?: string;
  filters?: SignalFilter[];
  timestamp?: string;
}

interface BotTrade {
  ticket: string;
  pair: string;
  direction: 'BUY' | 'SELL';
  volume: number;
  entry_price: number;
  current_price: number;
  exit_price?: number;
  status?: string;
  sl: number;
  tp: number;
  pnl: number;
  pnl_percent: number;
}

interface SessionInfo {
  is_trading: boolean;
  current_session: string;
  current_time_utc: string;
  time_remaining_in_session?: string;
  next_session_start: string;
  time_until_next_session: string;
  london_hours: string;
  ny_hours: string;
}

export function LogsPanel() {
  const [signals, setSignals] = useState<BotSignal[]>([]);
  const [trades, setTrades] = useState<BotTrade[]>([]);
  const [closedTrades, setClosedTrades] = useState<BotTrade[]>([]);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showClearSignalsDialog, setShowClearSignalsDialog] = useState(false);

  // Load bot data
  useEffect(() => {
    const loadBotData = async () => {
      try {
        const [signalsRes, tradesRes, closedRes, sessionRes] = await Promise.all([
          fetch(`${API_BASE}/bot/signals?limit=10`),
          fetch(`${API_BASE}/api/trading/account`),
          fetch(`${API_BASE}/trades`),
          fetch(`${API_BASE}/api/bot/session-info`),
        ]);

        // Load signals - no mock fallback
        if (signalsRes.ok) {
          const data = await signalsRes.json();
          const signalsList = Array.isArray(data) ? data : [];
          // Filter by confidence threshold
          setSignals(signalsList);
        } else {
          setSignals([]);
        }

        // Load active trades (same source as dashboard)
if (tradesRes.ok) {
  const data = await tradesRes.json();

  const formattedTrades = (data.trade_activity || []).map(
    (trade: any) => ({
      ticket: String(trade.ticket),
      pair: trade.symbol,
      direction: trade.type,
      entry_price: trade.entry_price,
      current_price: trade.exit_price,
      exit_price: trade.exit_price,
      sl: trade.sl,
      tp: trade.tp,
      pnl: trade.profit || 0,
      pnl_percent: 0,
    })
  );

  setTrades(formattedTrades);
}

// Load closed trades (same source as dashboard)
if (closedRes.ok) {
  const data = await closedRes.json();

  const formattedClosedTrades = data
  .slice()
  .reverse()
  .map((trade: any) => ({
    ticket: String(trade.ticket),
    pair: trade.symbol,
    direction: trade.type,
    volume: trade.volume,
    pnl: trade.profit,
    pnl_percent: 0,

    entry_price: trade.entry_price,
    current_price: trade.exit_price,
    exit_price: trade.exit_price,

    sl: trade.sl,
    tp: trade.tp,

    status: "CLOSED",
  }));

  console.log("LOGS CLOSED:", formattedClosedTrades);

  setClosedTrades(formattedClosedTrades);
}

        // Load session info
        if (sessionRes.ok) {
          const data = await sessionRes.json();
          setSessionInfo(data);
        }
      } catch (error) {
        console.error('Failed to load bot data:', error);
        setSignals([]);
      } finally {
        setLoading(false);
      }
    };

    loadBotData();

    // Poll every 5 seconds
    const interval = setInterval(loadBotData, 5000);
    return () => clearInterval(interval);
  }, []);

const handleDownloadLogs = () => {
  if (closedTrades.length === 0) {
    alert("No closed trades to export");
    return;
  }

const headers = [
  "Ticket",
  "Pair",
  "Direction",
  "Volume",
  "Entry Price",
  "Exit Price",
  "Stop Loss",
  "Take Profit",
  "PnL",
];

const rows = closedTrades.map((trade) => [
  trade.ticket,
  trade.pair,
  trade.direction,
  trade.volume,
  trade.entry_price,
  trade.exit_price,
  trade.sl,
  trade.tp,
  trade.pnl,
]);
  const csv = [
    headers.join(","),
    ...rows.map((row) => row.join(",")),
  ].join("\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `closed-trades-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};

  const clearSignals = async () => {

  try {
    const response = await fetch(
      `${API_BASE}/bot/signals/clear`,
      {
        method: "DELETE",
      }
    );

    if (response.ok) {
      setSignals([]);
    }
  } catch (error) {
    console.error("Failed to clear signals:", error);
  }
};

const handleCloseTrade = async (ticket: string) => {
  try {
    const response = await fetch(
      `${API_BASE}/bot/trades/${ticket}/close`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    if (response.ok) {
      setTrades((prev) =>
        prev.filter((t) => String(t.ticket) !== ticket)
      );
    } else {
      alert(`Failed to close trade: ${data.detail}`);
    }
  } catch (err) {
    alert(`Error closing trade: ${String(err)}`);
  }
};

  if (loading) {
    return <div className="text-center text-muted-foreground">Loading...</div>;
  }

  const totalSignals = signals.length;
  const totalTrades = trades.length;
  const avgConfidence = signals.length > 0
    ? (signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length).toFixed(0)
    : 0;
  const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
  const winningTrades = trades.filter(t => t.pnl > 0).length;
  const winRate = trades.length > 0 ? ((winningTrades / trades.length) * 100).toFixed(1) : 0;

  return (
    <div className="w-full space-y-4">
      {/* Session Info Card */}
      {sessionInfo && (
        <Card className="p-4 bg-card border-border">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Current Session</p>
              <p className="text-lg font-bold text-foreground">
                {sessionInfo.is_trading ? (
                  <span className="text-trading-green">{sessionInfo.current_session}</span>
                ) : (
                  <span className="text-muted-foreground">CLOSED</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Current Time (UTC)</p>
              <p className="text-sm font-mono text-foreground">{new Date(sessionInfo.current_time_utc).toLocaleTimeString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Next Session</p>
              <p className="text-sm font-mono text-accent">{sessionInfo.time_until_next_session}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <MetricCard
          title="Signals"
          value={totalSignals.toString()}
          icon={Sparkles}
          color="cyan"
        />
        <MetricCard
          title="Avg Confidence"
          value={`${avgConfidence}%`}
          icon={TrendingUp}
          color="yellow"
        />
        <MetricCard
          title="Active Trades"
          value={totalTrades.toString()}
          icon={TrendingUp}
          color="green"
        />
        <MetricCard
          title="Win Rate"
          value={`${winRate}%`}
          icon={TrendingUp}
          color="trading-green"
        />
        <MetricCard
          title="Total P&L"
          value={`${totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}`}
          icon={Clock}
          color={totalPnL >= 0 ? 'green' : 'red'}
        />
      </div>

      {/* Logs Tabs */}
      <Tabs defaultValue="signals" className="w-full">
<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">          <TabsList className="bg-muted">
            <TabsTrigger value="signals">✨ Signals ({signals.length})</TabsTrigger>
            <TabsTrigger value="trades">📈 Trades ({trades.length})</TabsTrigger>
            <TabsTrigger value="closed">✅ Closed ({closedTrades.length})</TabsTrigger>
          </TabsList>
          <div className="flex gap-4 items-center">

            <Button size="sm" variant="outline" onClick={handleDownloadLogs} className="text-xs flex-1 min-w-[100px]">
              <Download className="w-3 h-3 mr-1" />
              Export
            </Button>

            <Button
              size="sm"
              variant="destructive"
               onClick={() => setShowClearSignalsDialog(true)}
              className="text-xs flex-1 min-w-[120px]"
           >
            Clear Signals
          </Button>

          </div>
        </div>

        {/* Signals Tab */}
        <TabsContent value="signals" className="space-y-2">
          {signals.length === 0 ? (
            <Card className="p-8 bg-card border-border text-center">
              <p className="text-muted-foreground"></p>
            </Card>
          ) : (
            <ScrollArea className="h-[500px] w-full rounded-lg border border-border bg-card">
              <div className="p-4 space-y-3">
                {signals.map((signal, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded border border-border bg-muted hover:bg-muted/80 transition"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-foreground">
                          {signal.pair}
                        </span>
                        <Badge className={signal.direction === 'BUY' ? 'bg-trading-green' : 'bg-trading-red'}>
                          {signal.direction}
                        </Badge>
                        <Badge className="bg-accent">
                          {signal.confidence}%
                        </Badge>
                      </div>
                      <Badge variant={signal.status === 'BLOCKED' ? 'destructive' : 'default'}>
                          {signal.status || 'EXECUTED'}
                        </Badge>
                    </div>

                    {signal.reason && (
                      <div className="mb-2 text-xs text-red-400">
                        Reason: {signal.reason}
                      </div>
                    )}

<div className="bg-secondary/50 rounded p-2 text-xs space-y-1">
  {signal.filters?.length ? (
    signal.filters.map((filter, index) => (
      <div key={index} className="flex justify-between">
        <span className={filter.passed ? "text-trading-green" : "text-trading-red"}>
          {filter.passed ? "✓" : "✗"} {filter.name}
        </span>
        <span className="font-mono text-foreground">
          {filter.value}
        </span>
      </div>
    ))
  ) : (
    <span className="text-muted-foreground">
      No filter data available
    </span>
  )}
</div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* Trades Tab */}
        <TabsContent value="trades" className="space-y-2">
          {trades.length === 0 ? (
            <Card className="p-8 bg-card border-border text-center">
              <p className="text-muted-foreground">No active trades</p>
            </Card>
          ) : (
            <ScrollArea className="h-[500px] w-full rounded-lg border border-border bg-card">
              <div className="p-4 space-y-2">
                {trades.map((trade) => (
                  <div
                    key={trade.ticket}
                    className="p-3 rounded border border-border bg-muted hover:bg-muted/80 transition"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-foreground">
                          #{trade.ticket} {trade.pair}
                        </span>
                        <Badge className={trade.direction === 'BUY' ? 'bg-trading-green' : 'bg-trading-red'}>
                          {trade.direction}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)} ({trade.pnl_percent >= 0 ? '+' : ''}{trade.pnl_percent.toFixed(2)}%)
                        </span>
                        <Button 
                          size="sm" 
                          className={`h-7 px-3 text-xs font-bold ${trade.direction === 'BUY' ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}
                          onClick={() => handleCloseTrade(trade.ticket)}
                          title={`Click to ${trade.direction === 'BUY' ? 'SELL' : 'BUY'} and close trade`}
                        >
                          {trade.direction === 'BUY' ? '🔴 SELL' : '🟢 BUY'}
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Entry:</span> <span className="text-foreground font-mono">{typeof trade.entry_price === "number" ? trade.entry_price.toFixed(5) : "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Current:</span> <span className="text-foreground font-mono">{typeof trade.current_price === "number" ? trade.current_price.toFixed(5) : "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">SL:</span> <span className="text-trading-red font-mono">{typeof trade.sl === "number" ? trade.sl.toFixed(5) : "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">TP:</span> <span className="text-trading-green font-mono">{typeof trade.tp === "number" ? trade.tp.toFixed(5) : "N/A"}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Size:</span> <span className="text-foreground font-mono">{trade.volume}L</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* Closed Trades Tab */}
        <TabsContent value="closed" className="space-y-2">
          {closedTrades.length === 0 ? (
            <Card className="p-8 bg-card border-border text-center">
              <p className="text-muted-foreground">No closed trades</p>
            </Card>
          ) : (
            <ScrollArea className="h-[500px] w-full rounded-lg border border-border bg-card">
              <div className="p-4 space-y-2">
                {closedTrades.map((trade) => (
                  <div
                    key={trade.ticket}
                    className="p-3 rounded border border-border bg-muted/50 hover:bg-muted/80 transition opacity-75"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-foreground">
                          #{trade.ticket} {trade.pair}
                        </span>
                        <Badge className={trade.direction === 'BUY' ? 'bg-trading-green' : 'bg-trading-red'}>
                          {trade.direction}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {trade.status || 'CLOSED'}
                        </Badge>
                      </div>
                      <span className={`font-bold ${(trade.pnl ?? 0) >= 0 ? 'text-trading-green' : 'text-trading-red'}`}>
                        {(trade.pnl ?? 0) >= 0 ? '+' : ''}{((trade.pnl ?? 0).toFixed(2))} ({(trade.pnl_percent ?? 0) >= 0 ? '+' : ''}{((trade.pnl_percent ?? 0).toFixed(2))}%)
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Entry:</span> <span className="text-foreground font-mono">{((trade.entry_price ?? 0).toFixed(5))}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Exit:</span> <span className="text-foreground font-mono">{(trade.current_price ?? trade.exit_price ?? 0).toFixed(5)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">SL:</span> <span className="text-trading-red font-mono">{((trade.sl ?? 0).toFixed(5))}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">TP:</span> <span className="text-trading-green font-mono">{((trade.tp ?? 0).toFixed(5))}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Size:</span> <span className="text-foreground font-mono">{trade.volume}L</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>

      {/* Live Status Indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="w-2 h-2 bg-trading-green rounded-full animate-pulse" />
        Bot data updated every 5 seconds
      </div>

    <AlertDialog
  open={showClearSignalsDialog}
  onOpenChange={setShowClearSignalsDialog}
>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>
        Clear Signal History?
      </AlertDialogTitle>

      <AlertDialogDescription>
        This will permanently remove all saved signals from the logs.
      </AlertDialogDescription>
    </AlertDialogHeader>

    <AlertDialogFooter>
      <AlertDialogCancel>
        Cancel
      </AlertDialogCancel>

      <AlertDialogAction
        onClick={clearSignals}
        className="bg-red-600 hover:bg-red-700"
      >
        Clear Signals
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>

    </div>
  );
}

// Helper Components
function MetricCard({ title, value, icon: Icon, color }: any) {
  const colorClasses: Record<string, string> = {
    blue: 'text-primary bg-primary/10',
    green: 'text-trading-green bg-trading-green/10',
    'trading-green': 'text-trading-green bg-trading-green/10',
    red: 'text-trading-red bg-trading-red/10',
    yellow: 'text-trading-yellow bg-trading-yellow/10',
    cyan: 'text-accent bg-accent/10',
  };

  return (
    <Card className={`p-3 border-border ${colorClasses[color]}`}>
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4" />
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-sm font-bold text-foreground">{value}</p>
        </div>
      </div>
    </Card>
  );
}
