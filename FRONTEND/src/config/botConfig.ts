export const defaultBotConfig = {
  // Risk
  risk_per_trade: 0.5,
  max_daily_loss: 2.0,
  max_drawdown: 5.0,
  max_trades_enabled: false,

  // Trading
  max_trades_per_day: 8,
  trading_pairs: ["XAUUSDm"],
  allow_london: false,
  allow_ny: false,
  allow_asia: false,
  demo_mode: false,

  // Fast-scalping filters
  trend_filter: false,
  entry_ema_filter: false,
  adx_filter: false,
  atr_filter: false,
  atr_extension_filter: false,
  momentum_filter: false,
  spread_filter: false,
  breakout_filter: false,

  // Fast entry settings
  ema_fast: 9,
  ema_slow: 21,
  entry_ema: 9,
  trend_tf: "M5",
  entry_tf: "M1",

  // Filter thresholds
  adx_threshold: 18,
  atr_ratio: 0.65,
  atr_extension: 1.5,
  momentum_multiplier: 1.05,
  momentum_min_body_atr: 0.10,
  momentum_close_location: 0.55,
  max_spread: 0.25,
  breakout_buffer: 0.1,
  breakout_lookback: 5,

  // Execution
  stop_loss: 1.2,
  take_profit: 1.8,
  cooldown_minutes: 1,
  max_open_positions: 1,
  lot_size: 0.01,
  deviation: 20,
  magic: 20250620,
  order_comment: "AlgoGuardian",
};
