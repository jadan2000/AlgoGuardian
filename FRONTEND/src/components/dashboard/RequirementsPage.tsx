import { CheckCircle2, Monitor, Wifi, WalletCards, ShieldCheck, Download, AlertTriangle } from "lucide-react";

export default function RequirementsPage() {
  return (
    <article className="mx-auto w-full max-w-4xl space-y-9">
      <header className="border-b border-border pb-6">
        <div className="mb-3 flex items-center gap-2 text-sm text-primary"><CheckCircle2 className="h-4 w-4" /> Before you begin</div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">AlgoGuardian Requirements</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">Review these requirements before connecting your trading account.</p>
      </header>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold">What you need</h2>
        <section className="border-b border-border pb-5">
          <h3 className="flex items-center gap-2 text-lg font-semibold"><Monitor className="h-5 w-5 text-primary" /> 1. A compatible computer</h3>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">Have access to a Windows computer that can run the MetaTrader 5 desktop application. Keep the application available when you want to use MT5-connected features. Exact minimum CPU, memory and storage requirements have not been established here, so this page does not promise specific hardware minimums.</p>
        </section>
        <section className="border-b border-border pb-5">
          <h3 className="flex items-center gap-2 text-lg font-semibold"><Download className="h-5 w-5 text-primary" /> 2. MetaTrader 5 desktop</h3>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">Install the desktop version of MetaTrader 5 and make sure it opens successfully. If you already have MT5, check that it is signed in and receives prices. If your broker provides its own MT5 installer, that version may include the broker's server list.</p>
          <p className="mt-3"><a href="https://www.metatrader5.com/en/download" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-semibold text-primary underline underline-offset-4"><Download className="h-4 w-4" /> Download MetaTrader 5 from the official website</a></p>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">Download software only from MetaQuotes or your broker's official website.</p>
        </section>
        <section className="border-b border-border pb-5">
          <h3 className="flex items-center gap-2 text-lg font-semibold"><WalletCards className="h-5 w-5 text-primary" /> 3. A compatible broker account</h3>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">You need an account that can sign in through MT5, along with the account login number, trading password and exact broker server name. Check with your broker that the account and instruments you want to use are available for trading.</p>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">A demo account is recommended for learning and checking your setup before risking real funds. Broker symbol names can vary, so confirm the exact names in MT5.</p>
        </section>
        <section className="border-b border-border pb-5">
          <h3 className="flex items-center gap-2 text-lg font-semibold"><Wifi className="h-5 w-5 text-primary" /> 4. Reliable internet access</h3>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">A stable internet connection helps MT5 receive market prices and communicate with the broker. Connection interruptions may delay updates or prevent trading actions from completing.</p>
        </section>
        <section className="border-b border-border pb-5">
          <h3 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck className="h-5 w-5 text-primary" /> 5. AlgoGuardian access</h3>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">You need a valid AlgoGuardian sign-in and permission to use the trading account. Keep your trading password private and never include it in screenshots, logs or public messages.</p>
        </section>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Recommended before live trading</h2>
        <ul className="list-disc space-y-2 pl-6 text-sm leading-7 text-muted-foreground">
          <li>Use a demo account to learn the controls and review the bot's behaviour.</li>
          <li>Review the risk settings, selected symbols, trading sessions and maximum open positions.</li>
          <li>Know how to view and manage open positions and pending orders in MT5.</li>
          <li>Learn what Start, Pause and Kill Switch do before using them.</li>
        </ul>
      </section>

      <section className="border-l-4 border-amber-500 pl-5">
        <h2 className="flex items-center gap-2 text-xl font-semibold"><AlertTriangle className="h-5 w-5 text-amber-600" /> Important</h2>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">Trading involves risk and losses are possible. A successful installation or an active status does not guarantee that an order will execute or that a strategy will make a profit. Do not assume Pause or Kill Switch automatically closes existing positions.</p>
      </section>
    </article>
  );
}
