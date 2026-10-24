import { BookOpen, WalletCards, SlidersHorizontal, Power, Activity, ShieldCheck, BellRing, CircleAlert, CheckCircle2, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";

const steps = [
  {
    number: "01",
    title: "Connect your MetaTrader 5 account",
    icon: WalletCards,
    description: "Open Accounts and enter your MT5 account number, trading password, and exact broker server name. Save the details, then check that the status says Connected.",
    note: "AlgoGuardian uses the MT5 terminal on the computer running the backend. Keep that computer on and MT5 available while you want the trading engine to run.",
  },
  {
    number: "02",
    title: "Review your trading settings",
    icon: SlidersHorizontal,
    description: "Open Settings to review the symbols, trading sessions, risk per trade, maximum open positions, and available entry filters. Make sure the values match your plan before starting.",
    note: "Start conservatively and test on a demo account first. Settings affect trading behaviour; changing them does not guarantee a profit.",
  },
  {
    number: "03",
    title: "Check the dashboard",
    icon: Activity,
    description: "Use Dashboard to review account information, market overview, live trade movement, and recent trade activity. Check that the account and market data look sensible.",
    note: "If the account is disconnected or the data looks stale, resolve the connection before enabling trading.",
  },
  {
    number: "04",
    title: "Start, pause, or stop trading",
    icon: Power,
    description: "Use the controls at the top of the dashboard. Start activates the bot, Pause pauses it, and Kill Switch is the emergency control. Confirm the status changes after an action.",
    note: "Do not assume the Kill Switch closes existing positions. Check your open trades in MT5 and manage positions directly if needed.",
  },
  {
    number: "05",
    title: "Monitor activity and review logs",
    icon: ShieldCheck,
    description: "Check Analytics for the available performance view and Logs for recorded engine activity or errors. If a trade does not happen, review the status and reason shown by the app.",
    note: "Signals and historical results are informational and do not predict future performance.",
  },
];

export default function HowToUsePage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-14 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative">
          <div className="mb-3 flex items-center gap-2 text-sm text-primary"><BookOpen className="h-4 w-4" /> Getting started</div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">How to use AlgoGuardian</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Follow this guide to connect your trading account, review your setup, and monitor the bot. Take your time with each step before allowing live trades.</p>
        </div>
      </section>

      <Card className="border-amber-500/30 bg-amber-500/5 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <h2 className="font-semibold">Before you start</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">Use a demo account first. Automated trading involves risk and losses are possible. Never enter your investor/read-only password if your broker requires the trading password for trading. Only connect an account you are authorised to use.</p>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        {steps.map(({ number, title, icon: Icon, description, note }) => (
          <Card key={number} className="p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 text-xs font-semibold tracking-widest text-muted-foreground">STEP {number}</div>
                <h2 className="text-lg font-semibold">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm leading-5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{note}</span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <h2 className="font-semibold">Quick troubleshooting</h2>
            <ul className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">
              <li><span className="font-medium text-foreground">MT5 is disconnected:</span> Open Accounts, verify the account number and server, check that MT5 is installed and signed in, then select Connect.</li>
              <li><span className="font-medium text-foreground">The terminal cannot be found:</span> In Accounts, use the terminal location field to select the full path to the MT5 terminal executable.</li>
              <li><span className="font-medium text-foreground">The bot will not start or no trades appear:</span> Check the bot status, account connection, trading sessions, selected symbols, risk settings, and Logs. The strategy may also decide that conditions do not meet its entry rules.</li>
              <li><span className="font-medium text-foreground">Need to change your broker account:</span> Update the credentials in Accounts. This installation uses one MT5 account at a time.</li>
            </ul>
          </div>
        </div>
      </Card>

      <div className="flex items-start gap-3 rounded-xl border border-border p-4 text-sm text-muted-foreground">
        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>Suggested order: <span className="font-medium text-foreground">Accounts → Settings → Dashboard → Logs</span>. If anything is unclear, check the exact status or error displayed in the relevant section before trying again.</p>
      </div>
    </div>
  );
}
