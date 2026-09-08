import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { API_BASE } from "@/config/api";

export default function StrategySignalsPanel() {
  const [signals, setSignals] = useState<any[]>([]);
  const [showStrategyDecisions, setShowStrategyDecisions] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/bot/signals?limit=20`
        );

        const data = await response.json();

        setSignals(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Strategy Analytics Error:", error);
      }
    };

    loadData();

    const interval = setInterval(loadData, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Strategy Analytics
        </h2>

        <p className="text-sm text-muted-foreground">
          Live strategy decisions from the bot
        </p>
      </div>

      <Card className="p-5">
        <button
          onClick={() =>
            setShowStrategyDecisions(
              !showStrategyDecisions
            )
          }
          className="w-full flex justify-between items-center text-lg font-semibold mb-4"
        >
          <span>Recent Strategy Decisions</span>
          <span>
            {showStrategyDecisions ? "▲" : "▼"}
          </span>
        </button>

        {showStrategyDecisions && (
          <div className="space-y-3">
            {signals.length === 0 && (
              <div className="text-muted-foreground">
                No strategy decisions found
              </div>
            )}

            {signals
              .slice()
              .reverse()
              .map((signal: any, idx: number) => (
                <div
                  key={idx}
                  className="rounded-lg border p-4"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">
                      {signal.symbol}
                    </span>

                    <span
                      className={
                        signal.status === "EXECUTED"
                          ? "text-green-500 font-semibold"
                          : "text-red-500 font-semibold"
                      }
                    >
                      {signal.status}
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground mt-1">
                    {signal.timestamp}
                  </div>

                  <div className="mt-2 text-sm">
                    <span className="font-medium">
                      Signal:
                    </span>{" "}
                    {signal.signal || "-"}
                  </div>

                  <div className="text-sm">
                    <span className="font-medium">
                      Reason:
                    </span>{" "}
                    {signal.reason || "-"}
                  </div>

                  {signal.confidence && (
                    <div className="text-sm">
                      <span className="font-medium">
                        Confidence:
                      </span>{" "}
                      {signal.confidence}%
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </Card>
    </div>
  );
}