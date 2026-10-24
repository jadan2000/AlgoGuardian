import { CheckCircle2, Monitor, Wifi, WalletCards, ShieldCheck, Download, AlertTriangle } from "lucide-react";

export default function RequirementsPage() {
  return (
    <article className="mx-auto w-full max-w-4xl space-y-9">
      <header className="border-b border-border pb-6">
        <div className="mb-3 flex items-center gap-2 text-sm text-primary"><CheckCircle2 className="h-4 w-4" /> Before installation</div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">AlgoGuardian requirements</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">Check each requirement before connecting an account. AlgoGuardian relies on a running backend and a MetaTrader 5 desktop terminal on the same computer; the phone is for accessing the interface, not for hosting the trading engine.</p>
      </header>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Required</h2>
        <div className="space-y-6">
          <section className="border-b border-border pb-5">
            <h3 className="flex items-center gap-2 text-lg font-semibold"><Monitor className="h-5 w-5 text-primary" /> 1. A computer running the AlgoGuardian backend</h3>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">Use the computer on which AlgoGuardian's backend and trading engine are installed. For the current MT5 integration, use a Windows computer with a compatible MetaTrader 5 desktop terminal. Keep the computer powered on, awake, and connected to the internet while the engine is expected to run. If it sleeps, restarts, loses power, or the backend closes, the trading engine may stop.</p>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">The exact minimum CPU, RAM, and disk specifications have not been established in this guide, so no specific hardware minimum is promised. A stable computer and internet connection are more important than an invented specification.</p>
          </section>
          <section className="border-b border-border pb-5">
            <h3 className="flex items-center gap-2 text-lg font-semibold"><Download className="h-5 w-5 text-primary" /> 2. MetaTrader 5 desktop terminal</h3>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">Install the desktop version of MT5 on the same computer that runs the backend. The mobile app and WebTerminal are not substitutes for the desktop terminal in this local integration. If MT5 is already installed, open it and confirm that it can log in to your broker and receive prices.</p>
            <p className="mt-3"><a href="https://www.metatrader5.com/en/download" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-semibold text-primary underline underline-offset-4"><Download className="h-4 w-4" /> Official MetaTrader 5 download</a></p>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">If your broker provides a broker-branded MT5 installer, it may be preferable because it can include the broker's server list. Download software only from MetaQuotes or your broker's official website.</p>
          </section>
          <section className="border-b border-border pb-5">
            <h3 className="flex items-center gap-2 text-lg font-semibold"><WalletCards className="h-5 w-5 text-primary" /> 3. A supported MT5 broker account</h3>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">You need an account that can sign in through the MT5 desktop terminal, plus the account login number, trading password, and exact broker server name. Confirm with your broker that the account and instruments you intend to trade are available and that trading is permitted. AlgoGuardian does not create a broker account for you.</p>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">Start with a demo account. Broker symbol names can vary, even for the same market, so confirm the exact symbol names in MT5 before configuring them in AlgoGuardian.</p>
          </section>
          <section className="border-b border-border pb-5">
            <h3 className="flex items-center gap-2 text-lg font-semibold"><Wifi className="h-5 w-5 text-primary" /> 4. Reliable internet access</h3>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">The computer needs internet access for the backend and MT5 to communicate with the broker. Interruptions can delay data or prevent order operations. A phone connection alone does not keep a backend running on a computer that is switched off.</p>
          </section>
          <section className="border-b border-border pb-5">
            <h3 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck className="h-5 w-5 text-primary" /> 5. AlgoGuardian access and secure credentials</h3>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">You need a valid AlgoGuardian sign-in and permission to use the account. Keep your trading password private and use only the official app. Credentials should never be shared in screenshots, logs, or public messages.</p>
          </section>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Recommended before live trading</h2>
        <ul className="list-disc space-y-2 pl-6 text-sm leading-7 text-muted-foreground">
          <li>A demo MT5 account to verify the connection and observe behaviour before risking real funds.</li>
          <li>A reviewed risk-per-trade setting, symbol list, trading sessions, and maximum open positions.</li>
          <li>Access to MT5 so you can verify open positions and pending orders directly, including during an emergency.</li>
          <li>A plan for power or internet interruptions, Windows updates, and restarting the backend or terminal.</li>
          <li>Familiarity with the Pause and Kill Switch controls and the fact that these controls should not be assumed to close existing positions.</li>
        </ul>
      </section>

      <section className="border-l-4 border-amber-500 pl-5">
        <h2 className="flex items-center gap-2 text-xl font-semibold"><AlertTriangle className="h-5 w-5 text-amber-600" /> Important limitations</h2>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">The current setup uses a local backend and MT5 desktop terminal; it is not a phone-only trading engine. Do not assume the system runs 24/7 if the computer or backend is stopped. Trading involves risk, and neither successful installation nor an active status guarantees an order will execute or that a strategy will make a profit.</p>
      </section>
    </article>
  );
}
