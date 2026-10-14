import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Save, AlertTriangle } from 'lucide-react';
import { useBotContext } from '@/contexts/BotContext';
import { defaultBotConfig } from '@/config/botConfig';
import { API_BASE } from '@/config/api';

interface BotConfig {
  is_active?: boolean;
  risk_per_trade: number;
  max_trades_per_day: number;
  max_trades_enabled: boolean;
  max_daily_loss: number;
  max_drawdown: number;
  confluence_threshold: number;
  trading_pairs: string[];
  allow_london: boolean;
  allow_ny: boolean;
  demo_mode: boolean;
  ema_fast: number;
  ema_slow: number;
  entry_ema: number;
  adx_threshold: number;
  atr_ratio: number;
  atr_extension: number;
  momentum_multiplier: number;
  momentum_min_body_atr: number;
  momentum_close_location: number;
  max_spread: number;
  trend_tf: string;
  entry_tf: string;
  cooldown_minutes: number;
  max_open_positions: number;
  breakout_buffer: number;
  breakout_lookback: number;
  stop_loss: number;
  take_profit: number;
  trend_filter: boolean;
  adx_filter: boolean;
  atr_filter: boolean;
  atr_extension_filter: boolean;
  momentum_filter: boolean;
  spread_filter: boolean;
  breakout_filter: boolean;
  entry_ema_filter: boolean;
  lot_size: number;
  deviation: number;
  magic: number;
  order_comment: string;
}

export function SettingsPanel() {
  const { refreshBotStatus } = useBotContext();
  const [config, setConfig] = useState<BotConfig>({
    ...defaultBotConfig,
    is_active: false,
    demo_mode: false,
    max_trades_enabled: false,
    momentum_min_body_atr: 0.2,
    momentum_close_location: 0.6,
    breakout_lookback: 5,
  } as BotConfig);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('filters');

  const loadConfig = async () => {
    try {
      const response = await fetch(`${API_BASE}/config`);
      if (!response.ok) throw new Error(`Config load failed (${response.status})`);
      const data = await response.json();
      setConfig(prev => ({
        ...prev,
        ...defaultBotConfig,
        ...data,
        demo_mode: data.demo_mode ?? false,
        max_trades_enabled: data.max_trades_enabled ?? false,
        momentum_min_body_atr: data.momentum_min_body_atr ?? 0.2,
        momentum_close_location: data.momentum_close_location ?? 0.6,
        breakout_lookback: data.breakout_lookback ?? 5,
      }));
    } catch (error) {
      console.error('Failed to load bot config:', error);
      setSaveStatus('error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleConfigChange = <K extends keyof BotConfig>(key: K, value: BotConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setUnsavedChanges(true);
    setSaveStatus('idle');
  };

  const toggleFilter = (key: keyof BotConfig) => {
    handleConfigChange(key, !config[key] as BotConfig[typeof key]);
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      const updatePayload = {
        ...config,
      };

      const response = await fetch(`${API_BASE}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || `Config save failed (${response.status})`);
      }

      const data = await response.json();
      if (data.config) setConfig(prev => ({ ...prev, ...data.config }));
      setUnsavedChanges(false);
      setSaveStatus('saved');
      await refreshBotStatus();
      window.setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (error) {
      console.error('Failed to save config:', error);
      setSaveStatus('error');
    }
  };

  const filterToggle = (key: keyof BotConfig, label: string, description: string) => (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
      <div>
        <Label className="font-semibold">{label}</Label>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => toggleFilter(key)}
        aria-pressed={Boolean(config[key])}
        className={`relative h-6 w-11 rounded-full transition ${config[key] ? 'bg-primary' : 'bg-muted'}`}
      >
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${config[key] ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  );

  const maxTradesToggle = (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div>
        <Label className="font-semibold">Max Trades Per Day</Label>
        <p className="text-xs text-muted-foreground mt-1">
          {config.max_trades_enabled
            ? `Stop new trades after ${config.max_trades_per_day} entries today.`
            : 'No daily trade-count limit. Other risk protections remain active.'}
        </p>
      </div>
      <button
        type="button"
        onClick={() => handleConfigChange('max_trades_enabled', !config.max_trades_enabled)}
        aria-label="Toggle maximum trades per day"
        aria-pressed={config.max_trades_enabled}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${config.max_trades_enabled ? 'bg-primary' : 'bg-muted'}`}
      >
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${config.max_trades_enabled ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  );

  if (loading) return <div className="text-center text-muted-foreground py-10">Loading settings...</div>;

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Bot Settings</h2>
          <p className="text-sm text-muted-foreground">Fast XAUUSD scalper configuration</p>
        </div>
        <Button onClick={handleSave} disabled={!unsavedChanges || saveStatus === 'saving'}>
          <Save className="mr-2 h-4 w-4" />
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save'}
        </Button>
      </div>

      {saveStatus === 'error' && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Could not load or save the backend configuration. Check that the backend is running.</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col lg:grid lg:grid-cols-[220px_1fr] gap-4 lg:gap-6">
        <Card className="w-full p-3 lg:p-4 lg:sticky lg:top-4 lg:self-start">
          <div className="flex overflow-x-auto gap-2 lg:block lg:space-y-1">
            {[
              ['risk', '💰 Risk'],
              ['trading', '📊 Trading'],
              ['filters', '🧩 Filters'],
              ['execution', '⚡ Execution'],
              ['advanced', '🔧 Advanced'],
              ['quality', '🎯 Quality'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setActiveSection(value)}
                className={`whitespace-nowrap w-full text-left px-3 py-2 rounded-md transition ${activeSection === value ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          {activeSection === 'risk' && (
            <section className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Risk Management</h2>
                <p className="text-sm text-muted-foreground">Protected account controls plus an optional daily trade-count limit.</p>
              </div>
              <Card className="p-4 md:p-6 space-y-5">
                <div className="space-y-5 border-b pb-5">
                  <div>
                    <Label className="font-semibold">Risk Per Trade</Label>
                    <p className="text-xs text-muted-foreground mt-1">Maximum percentage of account balance risked at the configured stop loss. Set to 0 to use fixed lot size.</p>
                    <div className="flex items-center gap-4 mt-3"><Slider value={[config.risk_per_trade]} onValueChange={v => handleConfigChange('risk_per_trade', v[0])} min={0} max={10} step={0.1} /><b className="min-w-16 text-right">{config.risk_per_trade.toFixed(2)}%</b></div>
                  </div>
                  <div>
                    <Label className="font-semibold">Max Daily Loss</Label>
                    <p className="text-xs text-muted-foreground mt-1">Stop new entries after this daily loss percentage. Set to 0 to disable this limit.</p>
                    <div className="flex items-center gap-4 mt-3"><Slider value={[config.max_daily_loss]} onValueChange={v => handleConfigChange('max_daily_loss', v[0])} min={0} max={20} step={0.1} /><b className="min-w-16 text-right">{config.max_daily_loss.toFixed(1)}%</b></div>
                  </div>
                  <div>
                    <Label className="font-semibold">Max Drawdown</Label>
                    <p className="text-xs text-muted-foreground mt-1">Block new entries when current equity drawdown reaches this percentage. Set to 0 to disable.</p>
                    <div className="flex items-center gap-4 mt-3"><Slider value={[config.max_drawdown]} onValueChange={v => handleConfigChange('max_drawdown', v[0])} min={0} max={50} step={0.5} /><b className="min-w-16 text-right">{config.max_drawdown.toFixed(1)}%</b></div>
                  </div>
                  <div>
                    <Label className="font-semibold">Max Open Positions</Label>
                    <p className="text-xs text-muted-foreground mt-1">Maximum simultaneous positions per configured trading symbol.</p>
                    <div className="flex items-center gap-4 mt-3"><Slider value={[config.max_open_positions]} onValueChange={v => handleConfigChange('max_open_positions', Math.round(v[0]))} min={1} max={20} step={1} /><b className="min-w-16 text-right">{config.max_open_positions}</b></div>
                  </div>
                </div>
                {maxTradesToggle}
                <div className="flex items-center justify-between gap-4 border-b last:border-b-0 pb-4 last:pb-0">
                  <div>
                    <Label className="font-semibold">Daily Trade Limit</Label>
                    <p className="text-xs text-muted-foreground mt-1">Maximum entries allowed when the switch above is ON.</p>
                  </div>
                  <div className="flex items-center gap-4 min-w-[180px]">
                    <Slider
                      value={[config.max_trades_per_day]}
                      onValueChange={v => handleConfigChange('max_trades_per_day', Math.round(v[0]))}
                      min={1}
                      max={100}
                      step={1}
                      disabled={!config.max_trades_enabled}
                    />
                    <b className={!config.max_trades_enabled ? 'text-muted-foreground' : ''}>{config.max_trades_per_day}</b>
                  </div>
                </div>
              </Card>
            </section>
          )}

          {activeSection === 'trading' && (
            <section className="space-y-4">
              <h2 className="text-xl font-semibold">Trading</h2>
              <Card className="p-4 md:p-6 space-y-6">
                <div>
                  <Label className="font-semibold">Trading Pairs</Label>
                  <p className="text-xs text-muted-foreground mb-3">Symbols enabled for the strategy.</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {['XAUUSDm', 'EURUSDm', 'GBPUSDm', 'USDJPYm', 'EURGBPm', 'USTECm', 'ETHUSD'].map(pair => (
                      <label key={pair} className="flex items-center gap-2 text-sm border rounded-md p-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.trading_pairs.includes(pair)}
                          onChange={e => handleConfigChange('trading_pairs', e.target.checked ? [...config.trading_pairs, pair] : config.trading_pairs.filter(p => p !== pair))}
                        />
                        {pair}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="font-semibold">Trading Sessions</Label>
                  <div className="grid sm:grid-cols-2 gap-3 mt-3">
                    {[
                      ['allow_london', '🇬🇧 London', '08:00–17:00 London local time'],
                      ['allow_ny', '🗽 New York', '08:00–17:00 New York local time'],
                    ].map(([key, label, hours]) => (
                      <label key={key} className="flex items-center justify-between border rounded-lg p-3">
                        <span><span className="font-medium">{label}</span><span className="block text-xs text-muted-foreground">{hours}</span></span>
                        <input type="checkbox" checked={Boolean(config[key as keyof BotConfig])} onChange={e => handleConfigChange(key as keyof BotConfig, e.target.checked as BotConfig[typeof key])} />
                      </label>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-primary/20 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <Label className="font-semibold">Session By-Pass</Label>
                      <p className="text-xs text-muted-foreground mt-1">Allows signals outside the configured trading sessions for testing.</p>
                    </div>
                    <input type="checkbox" checked={config.demo_mode} onChange={e => handleConfigChange('demo_mode', e.target.checked)} className="h-5 w-5" />
                  </div>
                </div>
              </Card>
            </section>
          )}

          {activeSection === 'filters' && (
            <section className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Entry Filters</h2>
                <p className="text-sm text-muted-foreground">These are the primary parameters the experiment reviewer can tune.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {filterToggle('trend_filter', 'Trend Filter', 'Require higher-timeframe trend alignment.')}
                {filterToggle('entry_ema_filter', 'Entry EMA Filter', 'Require price to satisfy the entry EMA condition.')}
                {filterToggle('adx_filter', 'ADX Filter', 'Filter weak-trend conditions using ADX.')}
                {filterToggle('atr_filter', 'ATR Filter', 'Filter unsuitable volatility conditions.')}
                {filterToggle('atr_extension_filter', 'ATR Extension Filter', 'Reject entries that are excessively extended.')}
                {filterToggle('momentum_filter', 'Momentum Filter', 'Require sufficient candle momentum.')}
                {filterToggle('spread_filter', 'Spread Filter', 'Reject entries when spread is too wide.')}
                {filterToggle('breakout_filter', 'Breakout Filter', 'Require breakout confirmation when enabled.')}
              </div>
              <Card className="p-4 md:p-6 grid gap-6 md:grid-cols-2">
                <div>
                  <Label>Confluence Threshold</Label>
                  <p className="text-xs text-muted-foreground mb-3">Minimum signal score.</p>
                  <div className="flex items-center gap-4"><Slider value={[config.confluence_threshold]} onValueChange={v => handleConfigChange('confluence_threshold', v[0])} min={0} max={100} step={1} /><b>{config.confluence_threshold}</b></div>
                </div>
                <div>
                  <Label>ADX Threshold</Label>
                  <p className="text-xs text-muted-foreground mb-3">Minimum ADX strength.</p>
                  <div className="flex items-center gap-4"><Slider value={[config.adx_threshold]} onValueChange={v => handleConfigChange('adx_threshold', v[0])} min={0} max={60} step={1} /><b>{config.adx_threshold}</b></div>
                </div>
                <div>
                  <Label>ATR Ratio</Label>
                  <p className="text-xs text-muted-foreground mb-3">Minimum volatility ratio.</p>
                  <div className="flex items-center gap-4"><Slider value={[config.atr_ratio]} onValueChange={v => handleConfigChange('atr_ratio', v[0])} min={0} max={3} step={0.05} /><b>{config.atr_ratio.toFixed(2)}</b></div>
                </div>
                <div>
                  <Label>ATR Extension</Label>
                  <p className="text-xs text-muted-foreground mb-3">Maximum extension multiplier.</p>
                  <div className="flex items-center gap-4"><Slider value={[config.atr_extension]} onValueChange={v => handleConfigChange('atr_extension', v[0])} min={0.5} max={5} step={0.1} /><b>{config.atr_extension.toFixed(1)}</b></div>
                </div>
                <div>
                  <Label>Momentum Multiplier</Label>
                  <p className="text-xs text-muted-foreground mb-3">Momentum strength multiplier.</p>
                  <div className="flex items-center gap-4"><Slider value={[config.momentum_multiplier]} onValueChange={v => handleConfigChange('momentum_multiplier', v[0])} min={0.5} max={3} step={0.1} /><b>{config.momentum_multiplier.toFixed(1)}</b></div>
                </div>
                <div>
                  <Label>Minimum Body / ATR</Label>
                  <p className="text-xs text-muted-foreground mb-3">Minimum candle body relative to ATR.</p>
                  <div className="flex items-center gap-4"><Slider value={[config.momentum_min_body_atr]} onValueChange={v => handleConfigChange('momentum_min_body_atr', v[0])} min={0} max={2} step={0.05} /><b>{config.momentum_min_body_atr.toFixed(2)}</b></div>
                </div>
                <div>
                  <Label>Momentum Close Location</Label>
                  <p className="text-xs text-muted-foreground mb-3">Required candle close location.</p>
                  <div className="flex items-center gap-4"><Slider value={[config.momentum_close_location]} onValueChange={v => handleConfigChange('momentum_close_location', v[0])} min={0.5} max={1} step={0.01} /><b>{config.momentum_close_location.toFixed(2)}</b></div>
                </div>
                <div>
                  <Label>Maximum Spread</Label>
                  <p className="text-xs text-muted-foreground mb-3">Maximum allowed spread.</p>
                  <div className="flex items-center gap-4"><Slider value={[config.max_spread]} onValueChange={v => handleConfigChange('max_spread', v[0])} min={0.01} max={1} step={0.01} /><b>{config.max_spread.toFixed(2)}</b></div>
                </div>
                <div>
                  <Label>Breakout Buffer</Label>
                  <p className="text-xs text-muted-foreground mb-3">Breakout confirmation buffer and EMA pullback tolerance.</p>
                  <div className="flex items-center gap-4"><Slider value={[config.breakout_buffer]} onValueChange={v => handleConfigChange('breakout_buffer', v[0])} min={0} max={1} step={0.01} /><b>{config.breakout_buffer.toFixed(2)}</b></div>
                </div>
                <div>
                  <Label>Breakout Lookback</Label>
                  <p className="text-xs text-muted-foreground mb-3">Number of candles used for breakout detection.</p>
                  <div className="flex items-center gap-4"><Slider value={[config.breakout_lookback]} onValueChange={v => handleConfigChange('breakout_lookback', Math.round(v[0]))} min={1} max={50} step={1} /><b>{config.breakout_lookback}</b></div>
                </div>
              </Card>
            </section>
          )}

          {activeSection === 'execution' && (
            <section className="space-y-4">
              <h2 className="text-xl font-semibold">Execution</h2>
              <Card className="p-4 md:p-6 grid gap-6 md:grid-cols-2">
                <div><Label>Stop Loss</Label><p className="text-xs text-muted-foreground mb-3">Distance used for trade protection.</p><div className="flex items-center gap-4"><Slider value={[config.stop_loss]} onValueChange={v => handleConfigChange('stop_loss', v[0])} min={0.1} max={10} step={0.05} /><b>{config.stop_loss.toFixed(2)}</b></div></div>
                <div><Label>Take Profit</Label><p className="text-xs text-muted-foreground mb-3">Target distance used by execution.</p><div className="flex items-center gap-4"><Slider value={[config.take_profit]} onValueChange={v => handleConfigChange('take_profit', v[0])} min={0.1} max={15} step={0.05} /><b>{config.take_profit.toFixed(2)}</b></div></div>
                <div><Label>Cooldown Minutes</Label><p className="text-xs text-muted-foreground mb-3">Minimum time between entries.</p><div className="flex items-center gap-4"><Slider value={[config.cooldown_minutes]} onValueChange={v => handleConfigChange('cooldown_minutes', Math.round(v[0]))} min={0} max={30} step={1} /><b>{config.cooldown_minutes}</b></div></div>
                <div><Label>Deviation</Label><p className="text-xs text-muted-foreground mb-3">Maximum execution deviation.</p><div className="flex items-center gap-4"><Slider value={[config.deviation]} onValueChange={v => handleConfigChange('deviation', Math.round(v[0]))} min={0} max={100} step={1} /><b>{config.deviation}</b></div></div>
              </Card>
            </section>
          )}

          {activeSection === 'advanced' && (
            <section className="space-y-4">
              <h2 className="text-xl font-semibold">Advanced</h2>
              <Card className="p-4 md:p-6 grid gap-6 md:grid-cols-2">
                <div><Label>Fast EMA</Label><p className="text-xs text-muted-foreground mb-3">Fast trend/entry EMA period.</p><div className="flex items-center gap-4"><Slider value={[config.ema_fast]} onValueChange={v => handleConfigChange('ema_fast', Math.min(Math.round(v[0]), config.ema_slow - 1))} min={2} max={Math.min(100, config.ema_slow - 1)} step={1} /><b>{config.ema_fast}</b></div></div>
                <div><Label>Slow EMA</Label><p className="text-xs text-muted-foreground mb-3">Slow trend EMA period.</p><div className="flex items-center gap-4"><Slider value={[config.ema_slow]} onValueChange={v => handleConfigChange('ema_slow', Math.max(Math.round(v[0]), config.ema_fast + 1))} min={Math.max(3, config.ema_fast + 1)} max={200} step={1} /><b>{config.ema_slow}</b></div></div>
                <div><Label>Entry EMA</Label><p className="text-xs text-muted-foreground mb-3">EMA used for entry confirmation.</p><div className="flex items-center gap-4"><Slider value={[config.entry_ema]} onValueChange={v => handleConfigChange('entry_ema', Math.round(v[0]))} min={2} max={100} step={1} /><b>{config.entry_ema}</b></div></div>
                <div><Label>Lot Size Cap / Fixed Lot</Label><p className="text-xs text-muted-foreground mb-3">Maximum volume when risk sizing is enabled; fixed volume when Risk Per Trade is 0.</p><input type="number" min="0.01" max="1000" step="0.01" value={config.lot_size} onChange={e => handleConfigChange('lot_size', Number(e.target.value))} className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
                <div><Label>Magic Number</Label><p className="text-xs text-muted-foreground mb-3">Identifier attached to bot orders.</p><input type="number" min="0" max="2147483647" step="1" value={config.magic} onChange={e => handleConfigChange('magic', Math.max(0, Math.floor(Number(e.target.value))))} className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
                <div><Label>Order Comment</Label><p className="text-xs text-muted-foreground mb-3">Comment attached to MT5 orders.</p><input type="text" maxLength={31} value={config.order_comment} onChange={e => handleConfigChange('order_comment', e.target.value)} className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
                <div><Label>Trend Timeframe</Label><Select value={config.trend_tf} onValueChange={v => handleConfigChange('trend_tf', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['M1', 'M5', 'M15', 'M30', 'H1'].map(tf => <SelectItem key={tf} value={tf}>{tf}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Entry Timeframe</Label><Select value={config.entry_tf} onValueChange={v => handleConfigChange('entry_tf', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['M1', 'M5', 'M15'].map(tf => <SelectItem key={tf} value={tf}>{tf}</SelectItem>)}</SelectContent></Select></div>
              </Card>
            </section>
          )}

          {activeSection === 'quality' && (
            <section className="space-y-4">
              <h2 className="text-xl font-semibold">Signal Quality</h2>
              <Card className="p-4 md:p-6 space-y-6">
                <div><Label>Confluence Threshold</Label><p className="text-xs text-muted-foreground mb-3">Minimum combined signal quality score.</p><div className="flex items-center gap-4"><Slider value={[config.confluence_threshold]} onValueChange={v => handleConfigChange('confluence_threshold', v[0])} min={0} max={100} step={1} /><b>{config.confluence_threshold}</b></div></div>
                <Alert><AlertTriangle className="h-4 w-4" /><AlertDescription>The experiment reviewer can tune quality/filter parameters based on completed paper-trading cycles. Risk limits and maximum open positions remain protected.</AlertDescription></Alert>
              </Card>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
