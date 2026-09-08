import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

import { API_BASE } from "@/config/api";

interface Trade {
  ticket?: string;
  pair: string;
  direction?: string;
  type?: string;
  entry_price?: number;
  entryPrice?: number;
  current_price?: number;
  currentPrice?: number;
  volume?: number;
  sl?: number;
  tp?: number;
  pnl?: number;
  profit?: number;
  id?: string;
  rr?: number;
  lotSize?: string;
  duration?: string;
  confidence?: number;
  strategy?: string;
}

const TradeRow = ({
  trade,
  isActive,
  onClose,
}: {
  trade: Trade;
  isActive: boolean;
  onClose?: (ticket: string) => void;
}) => {
  const pnl = trade.pnl !== undefined ? trade.pnl : trade.profit || 0;
  const pnlPositive = pnl >= 0;

  const direction = trade.direction || trade.type || "UNKNOWN";

  const entry =
    trade.entry_price !== undefined
      ? trade.entry_price
      : (trade.entryPrice as number);

  const current =
    trade.current_price !== undefined
      ? trade.current_price
      : (trade.currentPrice as number);

  const ticket = trade.ticket || trade.id || "N/A";

  return (
    <tr className="border-b border-border/50 transition-colors hover:bg-secondary/50">
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
        {ticket}
      </td>

      <td className="px-4 py-3 font-semibold text-foreground">
        {trade.pair}
      </td>

      <td className="px-4 py-3">
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
            direction === "BUY"
              ? "bg-trading-green/10 text-trading-green"
              : "bg-trading-red/10 text-trading-red"
          }`}
        >
          {direction}
        </span>
      </td>

      <>
        <td className="px-4 py-3 font-mono text-muted-foreground">
          ${entry?.toFixed(5) || "N/A"}
        </td>

        <td className="px-4 py-3 font-mono text-muted-foreground">
          ${current?.toFixed(5) || "N/A"}
        </td>

        <td className="px-4 py-3 font-mono text-muted-foreground">
          ${trade.sl?.toFixed(5) || "N/A"}
        </td>

        <td className="px-4 py-3 font-mono text-muted-foreground">
          ${trade.tp?.toFixed(5) || "N/A"}
        </td>
      </>

      <td
        className={`px-4 py-3 font-mono font-semibold ${
          pnlPositive ? "text-trading-green" : "text-trading-red"
        }`}
      >
        {pnlPositive ? "+" : "-"}${Math.abs(pnl).toFixed(2)}
      </td>

      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
        {trade.volume || trade.lotSize || "N/A"}
      </td>

      {isActive && onClose && (
        <td className="px-4 py-3">
          <Button
            variant="destructive"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => onClose(String(ticket))}
          >
            <X className="h-3 w-3 mr-1" />
            Close
          </Button>
        </td>
      )}
    </tr>
  );
};

const TradeTable = ({
  trades,
  isActive,
  onClose,
}: {
  trades: Trade[];
  isActive: boolean;
  onClose?: (ticket: string) => void;
}) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left">
          {(isActive
            ? [
                "Ticket",
                "Pair",
                "Type",
                "Entry",
                "Current",
                "SL",
                "TP",
                "P&L",
                "Volume",
                "Action",
              ]
            : [
                "Ticket",
                "Pair",
                "Type",
                "Entry",
                "Exit",
                "SL",
                "TP",
                "P&L",
                "Volume",
              ]
          ).map((h) => (
            <th
              key={h}
              className="px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {trades.map((trade) => (
          <TradeRow
            key={trade.id || trade.ticket}
            trade={trade}
            isActive={isActive}
            onClose={onClose}
          />
        ))}
      </tbody>
    </table>

    {trades.length === 0 && (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No trades to display
      </div>
    )}
  </div>
);

const TradeActivity = () => {
  const [activeTrades, setActiveTrades] = useState<Trade[]>([]);
  const [closedTrades, setClosedTrades] = useState<Trade[]>([]);

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/trading/account`);

        if (response.ok) {
          const data = await response.json();

          const formattedTrades = (data.trade_activity || []).map(
            (trade: any) => ({
              ticket: String(trade.ticket),
              pair: trade.symbol,
              type: trade.type,
              entry_price: trade.entry_price,
              current_price: trade.current_price,
              profit: trade.profit,
              volume: trade.volume,
              sl: trade.sl,
              tp: trade.tp,
            })
          );

          setActiveTrades(formattedTrades);
        }
      } catch (err) {
        console.error("Failed to fetch active trades:", err);
      }

      try {
        const closedResponse = await fetch(`${API_BASE}/trades`);

        if (closedResponse.ok) {
          const data = await closedResponse.json();

          const formattedClosedTrades = data
            .slice()
            .reverse()
            .map((trade: any) => ({
              ticket: String(trade.ticket),
              pair: trade.symbol,
              type: trade.type,
              volume: trade.volume,
              profit: trade.profit,
              entry_price: trade.entry_price,
              current_price: trade.exit_price,
              sl: trade.sl,
              tp: trade.tp,
            }));

          setClosedTrades(formattedClosedTrades);
        }
      } catch (err) {
        console.error("Failed to fetch closed trades:", err);
      }
    };

    fetchTrades();

    const interval = setInterval(fetchTrades, 5000);

    return () => clearInterval(interval);
  }, []);

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
        setActiveTrades((prev) =>
          prev.filter((t) => String(t.ticket) !== ticket)
        );
      } else {
        alert(`Failed to close trade: ${data.detail}`);
      }
    } catch (err) {
      alert(`Error closing trade: ${String(err)}`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4 }}
      className="rounded-lg border border-border bg-card glow-card"
    >
      <Tabs defaultValue="active" className="w-full">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <h2 className="text-sm font-semibold text-foreground">
            Trade Activity
          </h2>

          <TabsList className="bg-secondary h-8">
            <TabsTrigger
              value="active"
              className="text-xs h-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Active ({activeTrades.length})
            </TabsTrigger>

            <TabsTrigger
              value="closed"
              className="text-xs h-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Recent Closed
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="active" className="mt-0">
          <TradeTable
            trades={activeTrades}
            isActive={true}
            onClose={handleCloseTrade}
          />
        </TabsContent>

        <TabsContent value="closed" className="mt-0">
          <TradeTable
            trades={closedTrades}
            isActive={false}
          />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};

export default TradeActivity;