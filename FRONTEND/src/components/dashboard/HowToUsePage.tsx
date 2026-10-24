import { BookOpen, WalletCards, SlidersHorizontal, Power, Activity, ShieldCheck, BellRing, CircleAlert, CheckCircle2, ArrowRight, Download, Monitor, Wifi } from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Prepare the computer that will run AlgoGuardian",
    icon: Monitor,
    body: [
      "AlgoGuardian's trading engine connects to the MetaTrader 5 desktop terminal on the computer running the backend. A phone or the MT5 WebTerminal alone cannot replace that local desktop terminal for this setup.",
      "Keep this computer powered on, connected to the internet, and awake while you expect the engine to operate. If the computer shuts down, sleeps, loses internet, or the backend stops, the engine may stop processing new trading decisions.",
      "If MetaTrader 5 is not installed, use the official MetaTrader 5 download page below and install the desktop version. Your broker may also provide its own MT5 installer; use the broker's version if it is required to list its server correctly."
    ],
  },
  {
    number: "02",
    title: "Install or locate MetaTrader 5",
    icon: Download,
    body: [
      "Download MetaTrader 5 from the official MetaQuotes website: https://www.metatrader5.com/en/download. Choose the desktop download for your computer, run the installer, and follow its prompts.",
      "Open MT5 and sign in using the account number, trading password, and server supplied by your broker. Make sure the terminal shows that it is connected and receiving prices.",
      "In AlgoGuardian, open Accounts and find “MetaTrader 5 installation location”. If the app does not detect MT5 automatically, enter the full path to the terminal executable, usually named terminal64.exe on Windows, then save the location.",
      "The download link is for MetaTrader 5 itself, not for a trading account. You still need a supported broker account and its correct server details."
    ],
  },
  {
    number: "03",
    title: "Connect your broker account in AlgoGuardian",
    icon: WalletCards,
    body: [
      "Open Accounts from the navigation. Enter the MT5 account login number, the account's trading password, and the exact server name shown in your broker's MT5 login window. Avoid using your broker website password unless it is explicitly the same trading password.",
      "Select Save credentials. AlgoGuardian saves the credentials using its configured encrypted storage and attempts to connect. The password field is cleared after a successful save action; the account status should show whether credentials are configured and whether MT5 is connected.",
      "If the connection fails, read the error shown on the page. Check the server spelling, login number, password, internet connection, whether the broker account is active, and whether MT5 is installed and can log in independently. Then use Connect or Refresh status.",
      "This installation is designed to use one MT5 account at a time. Saving different credentials changes the account used by this installation; it does not create a separate isolated trading environment for each account."
    ],
  },
  {
    number: "04",
    title: "Understand the connection and bot statuses",
    icon: Wifi,
    body: [
      "MT5 Connected means the terminal connection is available according to the app's current status check. MT5 Disconnected means you should resolve the connection before relying on new trading activity.",
      "BOT ACTIVE means the engine reports that it is active. BOT PAUSED means it is not currently running its normal active process. KILL SWITCH ON means the emergency switch is enabled.",
      "A connected terminal does not by itself prove that a trade will be placed. The account may be outside an enabled session, the symbol may not be tradable, market conditions may not meet the strategy rules, or a broker may reject an order."
    ],
  },
  {
    number: "05",
    title: "Review settings before you start",
    icon: SlidersHorizontal,
    body: [
      "Open Settings and review every available value before using a live account. Symbols determine which instruments the engine may consider; confirm that each name matches the symbol offered by your broker. Some brokers use suffixes such as .a or .pro.",
      "Trading sessions limit when the strategy is permitted to look for entries. Check the enabled sessions against your intended trading hours and remember that broker server time may differ from your local time.",
      "Risk per trade is a configured risk control, not a promise that a loss cannot exceed that amount. Gaps, slippage, spreads, leverage, and execution conditions can affect actual results. Use a small risk setting and a demo account while learning.",
      "Maximum open positions limits the number of positions according to the configuration's scope. Review the setting carefully; do not assume it is a total account-wide cap unless the interface or engine explicitly says so.",
      "Entry filters are conditions the strategy uses to decide whether a potential entry is acceptable. More filters can reduce the number of signals; they do not guarantee that remaining signals will be profitable. Change one setting at a time and observe the results."
    ],
  },
  {
    number: "06",
    title: "Inspect the dashboard before enabling trading",
    icon: Activity,
    body: [
      "Dashboard brings together the account overview, live trade movement, market overview, and recent trade activity. Review the account and equity figures against MT5, and check that market prices are updating.",
      "If values are blank, stuck, or clearly inconsistent with MT5, do not assume the engine has current data. Check the connection and Logs first.",
      "Analytics provides the performance information currently available in the app. Use it as a record of observed activity, not as a forecast or guarantee of future returns."
    ],
  },
  {
    number: "07",
    title: "Start, pause, and use the Kill Switch carefully",
    icon: Power,
    body: [
      "Use Start only after the correct account is connected, the settings have been reviewed, and you are comfortable with the risks. After clicking Start, check that the displayed status updates as expected.",
      "Pause asks the engine to pause its normal operation. Check the resulting status rather than assuming the request succeeded.",
      "Kill Switch is the emergency control for the engine. Do not assume it automatically closes open trades, cancels pending orders, or removes risk already in the market. Open MT5 and verify your positions and orders; manage them directly if necessary.",
      "Before making changes to an active account, know how to access MT5 and how to close or manage a position manually. Never rely solely on a dashboard status during an urgent market event."
    ],
  },
  {
    number: "08",
    title: "Read recent activity and troubleshoot",
    icon: ShieldCheck,
    body: [
      "Open Logs when the engine will not start, a connection fails, or activity differs from what you expected. Read the timestamp and full message. Resolve the earliest relevant error first, because later errors may be consequences of the first one.",
      "If no trades appear, this does not automatically mean the bot is broken. Check the active status, connection, market hours, configured symbols, session restrictions, risk settings, broker permissions, and whether the strategy's entry conditions were met.",
      "If the terminal cannot be found, return to Accounts and save the correct executable path. If credentials are rejected, verify the login details with your broker and test the same login in MT5.",
      "Keep your trading password private. Do not paste it into Logs, support messages, screenshots, or public chats."
    ],
  },
];

export default function HowToUsePage() {
  return (
    <article className="mx-auto w-full max-w-4xl space-y-10">
      <header className="border-b border-border pb-6">
        <div className="mb-3 flex items-center gap-2 text-sm text-primary"><BookOpen className="h-4 w-4" /> User guide</div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">How to use AlgoGuardian</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">This guide explains what you need, how to connect MT5, what the main controls do, and what to check when something does not work. Follow the steps in order, and test with a demo account before allowing automated trading on a live account.</p>
      </header>

      <section className="border-l-4 border-amber-500 pl-5">
        <h2 className="text-xl font-semibold">Important safety information</h2>
        <p className="mt-2 leading-7 text-muted-foreground">Automated trading can lose money, including rapidly in volatile markets. AlgoGuardian does not guarantee profit, execution, or a maximum loss. Start on a demo account, use conservative risk settings, and supervise the system. Only connect an account you own or are authorised to operate.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Step-by-step instructions</h2>
        {steps.map(({ number, title, icon: Icon, body }) => (
          <section key={number} className="border-b border-border pb-7 pt-3">
            <div className="flex items-start gap-3">
              <span className="pt-1 text-sm font-bold tabular-nums text-primary">{number}</span>
              <div className="min-w-0 flex-1">
                <h3 className="flex items-center gap-2 text-lg font-semibold"><Icon className="h-5 w-5 shrink-0 text-primary" />{title}</h3>
                <div className="mt-3 space-y-3 text-sm leading-7 text-muted-foreground">
                  {body.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                </div>
                {number === "02" && (
                  <p className="mt-4 text-sm leading-6">
                    <a href="https://www.metatrader5.com/en/download" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-semibold text-primary underline underline-offset-4"><Download className="h-4 w-4" /> Download MetaTrader 5 from the official website</a>
                  </p>
                )}
              </div>
            </div>
          </section>
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Quick checks when something goes wrong</h2>
        <div className="space-y-4 text-sm leading-7 text-muted-foreground">
          <div><h3 className="font-semibold text-foreground">MT5 says disconnected</h3><p>Open MT5 on the computer running AlgoGuardian and confirm that it is logged in to the right broker server and receiving prices. Recheck the account details in Accounts, then select Connect.</p></div>
          <div><h3 className="font-semibold text-foreground">AlgoGuardian cannot find the terminal</h3><p>In Accounts, enter and save the full path to the MT5 terminal executable. Make sure the path points to the executable file itself, not just the folder.</p></div>
          <div><h3 className="font-semibold text-foreground">The bot is active but no trade opens</h3><p>Confirm the correct account is connected, the market and symbol are available, a permitted session is active, and the strategy conditions are met. Read Logs for rejection reasons. An active bot does not mean it must continuously open trades.</p></div>
          <div><h3 className="font-semibold text-foreground">The dashboard and MT5 disagree</h3><p>Check whether data is updating and review Logs. Verify the actual open positions and orders directly in MT5 before taking action.</p></div>
          <div><h3 className="font-semibold text-foreground">You need to change accounts</h3><p>Update the saved credentials in Accounts. Remember that this installation operates one MT5 account at a time.</p></div>
        </div>
      </section>

      <footer className="border-t border-border pt-5 text-sm leading-6 text-muted-foreground">
        <p className="flex items-start gap-2"><CircleAlert className="mt-1 h-4 w-4 shrink-0 text-primary" /> If you are unsure whether the bot is safe to run, pause it, verify positions and orders in MT5, and resolve the issue before restarting. A pause or kill-switch status is not a substitute for checking live positions.</p>
        <p className="mt-4 flex items-center gap-2"><ArrowRight className="h-4 w-4 shrink-0 text-primary" /> Recommended order: Requirements → Accounts → Settings → Dashboard → Logs.</p>
      </footer>
    </article>
  );
}
