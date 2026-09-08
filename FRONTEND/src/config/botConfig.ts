export const defaultBotConfig = {
  // Risk
  risk_per_trade: 1.0,
  max_daily_loss: 3.0,
  max_drawdown: 5.0,

  // Trading
  max_trades_per_day: 3,
  trading_pairs: ["XAUUSDm"],
  allow_london: true,
  allow_ny: true,

  // Filters
  ema_fast: 50,
  ema_slow: 200,

  entry_ema: 20,
  entry_ema_filter: true,

  adx_threshold: 25,

  atr_ratio: 0.8,
  atr_extension: 3.0,

  momentum_multiplier: 1.5,

  max_spread: 0.30,

  trend_tf: "H1",
  entry_tf: "M5",

  higher_low_filter: true,
  breakout_filter: true,

  cooldown_minutes: 15,
  max_open_positions: 2,
  breakout_buffer: 0.25,

stop_loss: 1.2,
take_profit: 1.8,

  // Quality
  confluence_threshold: 60,
};