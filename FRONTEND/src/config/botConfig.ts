export const defaultBotConfig = {
  // Risk
  risk_per_trade: 0.5,
  max_daily_loss: 2.0,
  max_drawdown: 5.0,

  // Trading
  max_trades_per_day: 8,
  trading_pairs: ["XAUUSDm"],
  allow_london: true,
  allow_ny: true,

  // Filters
  trend_filter: true,
  adx_filter: true,
  atr_filter: true,
  atr_extension_filter: false,
  momentum_filter: true,
  spread_filter: true,
  breakout_filter: false,
  entry_ema_filter: true,

  ema_fast: 9,
  ema_slow: 21,
  entry_ema: 9,

  adx_threshold: 20,
  atr_ratio: 0.7,
  atr_extension: 1.5,

  momentum_multiplier: 1.2,
  momentum_min_body_atr: 0.2,
  momentum_close_location: 0.6,

  max_spread: 0.2,

  trend_tf: "M5",
  entry_tf: "M1",

  breakout_buffer: 0.1,
  breakout_lookback: 5,

  stop_loss: 1.5,
  take_profit: 2.25,

  cooldown_minutes: 3,
  max_open_positions: 1,

  // Execution
  lot_size: 0.01,
  deviation: 20,
  magic: 20250620,
  order_comment: "AlgoGuardian",

  // Quality
  confluence_threshold: 60,
};
