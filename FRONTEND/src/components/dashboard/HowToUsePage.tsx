import { useState } from "react";
import { BookOpen, WalletCards, SlidersHorizontal, Power, Activity, ShieldCheck, BellRing, CircleAlert, CheckCircle2, Download, Monitor, Settings, ChartNoAxesCombined } from "lucide-react";

const sections = [
  { id: "start", label: "Getting Started", icon: BookOpen },
  { id: "accounts", label: "Accounts & MT5", icon: WalletCards },
  { id: "settings", label: "Settings Guide", icon: SlidersHorizontal },
  { id: "dashboard", label: "Dashboard", icon: ChartNoAxesCombined },
  { id: "controls", label: "Bot Controls", icon: Power },
  { id: "activity", label: "Analytics & Logs", icon: Activity },
  { id: "troubleshooting", label: "Troubleshooting", icon: BellRing },
];

const settingGroups = [
  {
    id: "risk",
    title: "Risk",
    intro: "These options limit exposure or control how many positions and entries the strategy may make. They reduce some risks but cannot guarantee a maximum loss.",
    settings: [
      ["Risk Per Trade", "Sets the percentage of account balance used to calculate position size based on the configured stop loss. The interface allows 0–10%. At 0, the bot uses the fixed lot size instead. A risk percentage is not a guarantee of the final loss."],
      ["Max Daily Loss", "Sets a daily loss threshold as a percentage. When the threshold is reached, the engine is intended to stop opening new entries. Set to 0 to disable this limit."],
      ["Max Drawdown", "Sets the equity drawdown percentage at which new entries should be blocked. Set to 0 to disable this limit. Drawdown is a decline from an equity reference point; confirm the engine's calculation in testing before relying on it."],
      ["Max Open Positions", "Sets the maximum simultaneous positions per configured trading symbol. It is not described by this setting as a guaranteed account-wide limit."],
      ["Max Trades Per Day (switch)", "Turns the daily entry-count limit on or off. When off, the daily trade-count limit is not applied; other risk protections may still apply."],
      ["Daily Trade Limit", "Sets the maximum number of entries allowed when Max Trades Per Day is enabled. The interface range is 1–100. The control is disabled while the switch is off."],
    ],
  },
  {
    id: "trading",
    title: "Trading",
    intro: "Choose the markets and sessions the strategy is allowed to consider.",
    settings: [
      ["Trading Pairs", "Select the symbols the strategy can trade from the list shown: XAUUSDm, EURUSDm, GBPUSDm, USDJPYm, EURGBPm, USTECm and ETHUSD. Availability and exact symbol spelling depend on the broker. If the broker uses different names or suffixes, verify compatibility before enabling a symbol."],
      ["London Session", "Allows trading during the displayed London session window, 08:00–17:00 London local time, when enabled."],
      ["New York Session", "Allows trading during the displayed New York session window, 08:00–17:00 New York local time, when enabled."],
      ["Asia (Tokyo) Session", "Allows trading during the displayed Tokyo session window, 09:00–18:00 Tokyo local time, when enabled."],
      ["Session By-Pass", "The interface describes this as allowing signals outside configured sessions for testing. Treat it as a testing option and keep it off unless you deliberately need to test outside the selected sessions."],
    ],
  },
  {
    id: "filters",
    title: "Filters",
    intro: "Filters add conditions that a potential entry must pass. Turning a filter off removes that check; it does not mean a trade will be placed. Thresholds matter only when their related logic is active.",
    settings: [
      ["Trend Filter", "Requires alignment with the higher-timeframe trend before accepting an entry."],
      ["Entry EMA Filter", "Requires price to satisfy the entry moving-average (EMA) condition."],
      ["ADX Filter", "Uses the Average Directional Index (ADX) to filter out conditions considered too weak. ADX measures trend strength, not whether the market will rise or fall."],
      ["ATR Filter", "Filters market conditions using the Average True Range (ATR), a measure related to volatility."],
      ["ATR Extension Filter", "Rejects entries considered too far extended relative to the ATR-based threshold."],
      ["Momentum Filter", "Requires sufficient candle momentum according to the configured momentum thresholds."],
      ["Spread Filter", "Rejects entries when the spread is wider than the configured maximum. Spread is the difference between the buy and sell quote."],
      ["Breakout Filter", "Requires breakout confirmation when enabled."],
      ["ADX Threshold", "Sets the minimum ADX strength used by the filter. The interface range is 0–60. Raising it generally makes the strength requirement stricter."],
      ["ATR Ratio", "Sets the minimum volatility ratio used by the ATR filter. The interface range is 0–3. The precise calculation is strategy-defined."],
      ["ATR Extension", "Sets the maximum extension multiplier. The interface range is 0.5–5. Higher values permit a larger extension before this filter rejects an entry."],
      ["Momentum Multiplier", "Sets the multiplier used in the momentum strength check. The interface range is 0.5–3."],
      ["Minimum Body / ATR", "Sets the minimum candle-body size relative to ATR. The interface range is 0–2. Higher values require a larger candle body relative to volatility."],
      ["Momentum Close Location", "Sets the required candle close location, from 0.50 to 1.00. The strategy uses this value to assess where the candle closes within its range."],
      ["Maximum Spread", "Sets the spread threshold used by the spread filter. The interface range is 0.01–1.00. Units and the appropriate value can depend on the instrument and broker quote format."],
      ["Breakout Buffer", "Sets the buffer used for breakout confirmation and EMA pullback tolerance. The interface range is 0–1."],
      ["Breakout Lookback", "Sets how many candles are examined for breakout detection. The interface range is 1–50. Larger lookback values use more candles when evaluating a breakout."],
    ],
  },
  {
    id: "execution",
    title: "Execution",
    intro: "These settings affect order placement and spacing between entries. The meaning of price-distance values can vary by instrument, so verify them on a demo account.",
    settings: [
      ["Stop Loss", "Sets the configured price distance from entry for the stop loss on each new position. The interface range is 0.10–10.00. This is a price-distance value, not a percentage."],
      ["Take Profit", "Sets the configured price distance from entry for the take-profit level on each new position. The interface range is 0.10–15.00. This is a price-distance value, not a percentage."],
      ["Cooldown Minutes", "Sets the minimum waiting time between entries, from 0 to 30 minutes. A value of 0 means no cooldown delay is requested by this setting."],
      ["Deviation", "Sets the maximum execution deviation accepted by the order request, from 0 to 100. The unit is the MT5 order deviation setting; test it with the broker rather than interpreting it as a percentage."],
    ],
  },
  {
    id: "advanced",
    title: "Advanced",
    intro: "These parameters change the indicator calculations, volume sizing, order identification, and timeframes. Change them deliberately and test one change at a time.",
    settings: [
      ["Fast EMA", "Sets the faster Exponential Moving Average period used in trend/entry analysis. The interface range depends on the slow EMA and is at least 2. A shorter period reacts faster to recent price changes."],
      ["Slow EMA", "Sets the slower trend EMA period, from greater than the fast EMA up to 200. A larger period usually reacts more slowly and represents a longer lookback."],
      ["Entry EMA", "Sets the EMA period used for entry confirmation, from 2 to 100."],
      ["Lot Size Cap / Fixed Lot", "Sets the maximum volume when percentage-based risk sizing is used, or the fixed volume when Risk Per Trade is 0. The interface accepts 0.01–1000 lots; the broker's minimum, maximum and volume step still apply."],
      ["Magic Number", "A numeric identifier attached to bot orders so software can distinguish its orders from other orders. Use a consistent value and avoid changing it without understanding how the engine identifies positions."],
      ["Order Comment", "Text attached to MT5 orders for identification. The interface allows up to 31 characters; broker handling of comments may vary."],
      ["Trend Timeframe", "Chooses the chart timeframe used for trend analysis: M1, M5, M15, M30, H1 or H4. M1 means one minute; H1 means one hour, and so on."],
      ["Entry Timeframe", "Chooses the chart timeframe used for entry checks: M1, M5, M15, M30, H1 or H4. It can be different from the trend timeframe."],
    ],
  },
];

function SettingsGuide() {
  return (
    <div className="space-y-8">
      <header className="border-b border-border pb-5">
        <h2 className="text-2xl font-bold">Settings guide</h2>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">The guide below follows the same groups as Settings: Risk, Trading, Filters, Execution and Advanced. It describes each field currently shown in the settings interface.</p>
      </header>
      {settingGroups.map(group => (
        <section key={group.id} id={group.id} className="scroll-mt-6 space-y-4">
          <h3 className="border-b border-border pb-2 text-xl font-bold">{group.title}</h3>
          <p className="text-sm leading-7 text-muted-foreground">{group.intro}</p>
          <dl className="space-y-5">
            {group.settings.map(([name, description]) => (
              <div key={name} className="border-b border-border/70 pb-4">
                <dt className="font-semibold">{name}</dt>
                <dd className="mt-1 text-sm leading-7 text-muted-foreground">{description}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <p className="border-l-4 border-amber-500 pl-4 text-sm leading-7 text-muted-foreground">Save your changes and confirm the save status. For unfamiliar values, test on a demo account first. Do not assume any risk control can eliminate slippage, gaps, broker rejection or losses.</p>
    </div>
  );
}

export default function HowToUsePage() {
  const [activeSection, setActiveSection] = useState("start");
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="border-b border-border pb-5">
        <div className="mb-2 flex items-center gap-2 text-sm text-primary"><BookOpen className="h-4 w-4" /> User guide</div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">How to Use AlgoGuardian</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">Choose a section to learn about a specific part of the app.</p>
      </header>

      <nav aria-label="How to use sections" className="flex flex-wrap gap-x-5 gap-y-3 border-b border-border pb-4">
        {sections.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setActiveSection(id)} aria-current={activeSection === id ? "page" : undefined} className={`inline-flex items-center gap-2 border-b-2 pb-2 text-sm transition ${activeSection === id ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </nav>

      {activeSection === "start" && (
        <section className="max-w-4xl space-y-5">
          <h2 className="text-2xl font-bold">Getting Started</h2>
          <p className="text-sm leading-7 text-muted-foreground">Use these steps to get familiar with AlgoGuardian before enabling automated trading.</p>
          <ol className="list-decimal space-y-4 pl-6 text-sm leading-7 text-muted-foreground">
            <li><strong className="text-foreground">Check Requirements.</strong> Make sure you have access to a compatible MetaTrader 5 account and can sign in to the MT5 desktop terminal.</li>
            <li><strong className="text-foreground">Install MetaTrader 5 if needed.</strong> Download it from the official website and follow the installer's instructions. If your broker supplies its own MT5 installer, it may include the broker's server list.</li>
            <li><strong className="text-foreground">Connect your account.</strong> In Accounts, enter your MT5 login number, trading password and exact broker server, then save the details and check the connection status.</li>
            <li><strong className="text-foreground">Review Settings.</strong> Read each group in the Settings Guide before changing any values. Confirm your symbols, sessions, position limits and risk controls.</li>
            <li><strong className="text-foreground">Check Dashboard and Logs.</strong> Confirm that displayed account information is sensible and that no unresolved connection errors remain.</li>
            <li><strong className="text-foreground">Test carefully.</strong> Begin with a demo account and observe the bot's behaviour before considering live trading.</li>
          </ol>
          <p className="text-sm leading-7"><a href="https://www.metatrader5.com/en/download" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-semibold text-primary underline underline-offset-4"><Download className="h-4 w-4" /> Official MetaTrader 5 download</a></p>
        </section>
      )}

      {activeSection === "accounts" && (
        <section className="max-w-4xl space-y-5">
          <h2 className="text-2xl font-bold">Accounts & MetaTrader 5</h2>
          <p className="text-sm leading-7 text-muted-foreground">Use Accounts to save and manage the MT5 account used by AlgoGuardian.</p>
          <ol className="list-decimal space-y-4 pl-6 text-sm leading-7 text-muted-foreground">
            <li><strong className="text-foreground">Login number:</strong> enter the account number supplied by your broker.</li>
            <li><strong className="text-foreground">Trading password:</strong> enter the password used to trade through MT5, not a read-only investor password.</li>
            <li><strong className="text-foreground">Server:</strong> select or type the exact server name displayed in the MT5 login window.</li>
            <li><strong className="text-foreground">Save credentials:</strong> save the details and read the connection result. Never share your password in screenshots or support messages.</li>
            <li><strong className="text-foreground">Terminal location:</strong> if MT5 cannot be detected, enter the full path to the MT5 executable file and save it. If your broker provides its own MT5 installation, use the correct installation and server.</li>
            <li><strong className="text-foreground">Connect / Disconnect:</strong> use these controls to request a connection change and confirm the status afterwards.</li>
          </ol>
          <p className="text-sm leading-7"><a href="https://www.metatrader5.com/en/download" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-semibold text-primary underline underline-offset-4"><Download className="h-4 w-4" /> Download MetaTrader 5</a></p>
        </section>
      )}

      {activeSection === "settings" && <SettingsGuide />}

      {activeSection === "dashboard" && (
        <section className="max-w-4xl space-y-5">
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="text-sm leading-7 text-muted-foreground">The dashboard brings together account information, live trade movement, market overview and recent activity. Use it to check whether the figures are updating and whether the displayed account information matches MT5.</p>
          <ul className="list-disc space-y-3 pl-6 text-sm leading-7 text-muted-foreground">
            <li><strong className="text-foreground">Account overview:</strong> review the balance, equity and account metrics that are available.</li>
            <li><strong className="text-foreground">Market overview:</strong> review the displayed market information for the instruments supported by the current configuration.</li>
            <li><strong className="text-foreground">Live trade movement:</strong> monitor the trade movement shown by the app and compare important details with MT5.</li>
            <li><strong className="text-foreground">Trade activity:</strong> review recent trade information. For actual open positions and pending orders, verify directly in MT5.</li>
          </ul>
        </section>
      )}

      {activeSection === "controls" && (
        <section className="max-w-4xl space-y-5">
          <h2 className="text-2xl font-bold">Bot Controls</h2>
          <dl className="space-y-5">
            <div><dt className="font-semibold">Start</dt><dd className="mt-1 text-sm leading-7 text-muted-foreground">Requests that the bot begin its active trading process. Confirm the status changes and that the correct account is connected first.</dd></div>
            <div><dt className="font-semibold">Pause</dt><dd className="mt-1 text-sm leading-7 text-muted-foreground">Requests that the bot pause its normal activity. Verify the status afterwards; do not assume existing positions have been closed.</dd></div>
            <div><dt className="font-semibold">Kill Switch</dt><dd className="mt-1 text-sm leading-7 text-muted-foreground">Activates the emergency control for the engine. Do not assume it closes positions or cancels pending orders. Check MT5 and manage any open exposure directly.</dd></div>
            <div><dt className="font-semibold">Status indicators</dt><dd className="mt-1 text-sm leading-7 text-muted-foreground">BOT ACTIVE, BOT PAUSED and KILL SWITCH ON describe the status reported by the app. MT5 Connected/Disconnected describes the connection check. Neither status guarantees an order will execute.</dd></div>
          </dl>
        </section>
      )}

      {activeSection === "activity" && (
        <section className="max-w-4xl space-y-5">
          <h2 className="text-2xl font-bold">Analytics & Logs</h2>
          <p className="text-sm leading-7 text-muted-foreground">Use Analytics to review the performance information available in the application. Past results are not a promise of future results.</p>
          <p className="text-sm leading-7 text-muted-foreground">Use Logs to investigate failed connections, rejected actions or unexpected behaviour. Read the timestamp and message, then resolve the earliest relevant error first. Never share passwords or sensitive account details from screenshots or logs.</p>
        </section>
      )}

      {activeSection === "troubleshooting" && (
        <section className="max-w-4xl space-y-5">
          <h2 className="text-2xl font-bold">Troubleshooting</h2>
          <dl className="space-y-5">
            <div><dt className="font-semibold">MT5 is disconnected</dt><dd className="mt-1 text-sm leading-7 text-muted-foreground">Check that MT5 is signed in to the correct broker server and receiving prices. Recheck the login number, password and server in Accounts, then use Connect.</dd></div>
            <div><dt className="font-semibold">MT5 terminal cannot be found</dt><dd className="mt-1 text-sm leading-7 text-muted-foreground">In Accounts, save the full path to the MT5 executable file, not just the folder. Confirm the path points to the intended installation.</dd></div>
            <div><dt className="font-semibold">Bot is active but no trade opens</dt><dd className="mt-1 text-sm leading-7 text-muted-foreground">Check enabled symbols and sessions, filter settings, broker trading permissions and Logs. The strategy may be waiting for all entry conditions to be satisfied.</dd></div>
            <div><dt className="font-semibold">Dashboard data appears stale or different</dt><dd className="mt-1 text-sm leading-7 text-muted-foreground">Check the connection and Logs. Verify actual open positions and pending orders directly in MT5 before taking action.</dd></div>
            <div><dt className="font-semibold">Settings will not save</dt><dd className="mt-1 text-sm leading-7 text-muted-foreground">Check the message shown by the app, confirm the service is available, and try again. Confirm the saved values after the save status reports success.</dd></div>
          </dl>
        </section>
      )}
    </div>
  );
}
