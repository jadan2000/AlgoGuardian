import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Settings, Save, AlertCircle, Play, StopCircle, Pause, AlertTriangle } from 'lucide-react';
import { useBotContext } from '@/contexts/BotContext';
import { defaultBotConfig } from '@/config/botConfig';
import { API_BASE } from '@/config/api';

interface BotConfig {
  is_active: boolean;
  risk_per_trade: number;
  max_trades_per_day: number;
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
  max_spread: number;
  trend_tf: string;
  entry_tf: string;
  cooldown_minutes: number;
  max_open_positions: number;
  breakout_buffer: number;

  stop_loss: number;
  
  trend_filter: boolean;
  adx_filter: boolean;
  atr_filter: boolean;
  atr_extension_filter: boolean;
  momentum_filter: boolean;
  spread_filter: boolean;
  breakout_filter: boolean;
  entry_ema_filter: boolean;

take_profit: number;
}

export function SettingsPanel() {
  const { isActive, isPaused, session, startBot, stopBot, pauseBot, resumeBot, refreshBotStatus } = useBotContext();
  
  const [config, setConfig] = useState<BotConfig>({
    is_active: false,
    demo_mode: false,
    trend_filter: true,
    adx_filter: true,
    atr_filter: true,
    atr_extension_filter: true,
    momentum_filter: true,
    spread_filter: true,
    breakout_filter: true,
    entry_ema_filter: true,
    ...defaultBotConfig,
  });

  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("risk");

  const clearTradeHistory = async () => {
    if (!window.confirm("Clear all trade history?")) return;

    try {
      const response = await fetch(
        `${API_BASE}/api/trading/trades/clear`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (data.success) {
        alert("Trade history cleared");
        window.location.reload();
      }
    } catch (error) {
      console.error(error);
      alert("Failed to clear trade history");
    }
  };

  // Load bot config from backend
  const loadConfig = async () => {
    try {
      const response = await fetch(`${API_BASE}/config`);
      if (response.ok) {
        const data = await response.json();
        // Merge with defaults to ensure all fields are defined
        setConfig(prev => ({
          ...prev,
          ...data,
          demo_mode: data.demo_mode ?? false, // Ensure demo_mode is always boolean
        }));
      }
    } catch (error) {
      console.error('Failed to load bot config:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load config on mount only
  useEffect(() => {
    loadConfig();
  }, []);

  const handleConfigChange = (key: keyof BotConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setUnsavedChanges(true);
  };

  // Auto-save demo_mode immediately when toggled
  const handleDemoModeChange = async (value: boolean) => {
    setConfig(prev => ({ ...prev, demo_mode: value }));
    
    try {
      const response = await fetch(`${API_BASE}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demo_mode: value }),
      });
      if (response.ok) {
        setUnsavedChanges(false);
      }
    } catch (error) {
      console.error('Failed to save demo_mode:', error);
    }
  };

  const handleSave = async () => {
    setSaveStatus('saving');

    try {
      const updatePayload = {
        risk_per_trade: config.risk_per_trade,
        max_trades_per_day: config.max_trades_per_day,
        max_daily_loss: config.max_daily_loss,
        max_drawdown: config.max_drawdown,
        confluence_threshold: config.confluence_threshold,
        trading_pairs: config.trading_pairs,
        allow_london: config.allow_london,
        allow_ny: config.allow_ny,
        demo_mode: config.demo_mode,
        ema_fast: config.ema_fast,
        ema_slow: config.ema_slow,
        entry_ema: config.entry_ema,
        adx_threshold: config.adx_threshold,
        atr_ratio: config.atr_ratio,
        atr_extension: config.atr_extension,
        momentum_multiplier: config.momentum_multiplier,
        max_spread: config.max_spread,
        trend_tf: config.trend_tf,
        entry_tf: config.entry_tf,
        cooldown_minutes: config.cooldown_minutes,
        max_open_positions: config.max_open_positions,
        breakout_buffer: config.breakout_buffer,
        stop_loss: config.stop_loss,
        take_profit: config.take_profit,
        trend_filter: config.trend_filter,
        adx_filter: config.adx_filter,
        atr_filter: config.atr_filter,
        atr_extension_filter: config.atr_extension_filter,
        momentum_filter: config.momentum_filter,
        spread_filter: config.spread_filter,
        breakout_filter: config.breakout_filter,
        entry_ema_filter: config.entry_ema_filter,
      };

      const response = await fetch(`${API_BASE}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });

      if (response.ok) {
        setSaveStatus('saved');
        setUnsavedChanges(false);
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      setSaveStatus('idle');
    }
  };

  if (loading) {
    return <div className="text-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="w-full space-y-4">
      
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 md:gap-6">
    <Card className="w-full p-4 md:sticky md:top-4 overflow-x-auto">
    <div className="flex overflow-x-auto gap-2 md:block md:space-y-12">
  <button
    onClick={() => setActiveSection("risk")}
    className="whitespace-nowrap w-full text-left px-3 py-2 rounded-md hover:bg-secondary"
  >
    💰 Risk
  </button>

  <button
    onClick={() => setActiveSection("trading")}
    className="whitespace-nowrap w-full text-left px-3 py-2 rounded-md hover:bg-secondary"
  >
    📊 Trading
  </button>

  <button
    onClick={() => setActiveSection("filters")}
    className="whitespace-nowrap w-full text-left px-3 py-2 rounded-md hover:bg-secondary"
  >

      🧩 Filters
  </button>

  <button
    onClick={() => setActiveSection("execution")}
    className="whitespace-nowrap w-full text-left px-3 py-2 rounded-md hover:bg-secondary"
  >
    ⚡ Execution
  </button>

  <button
    onClick={() => setActiveSection("advanced")}
    className="whitespace-nowrap w-full text-left px-3 py-2 rounded-md hover:bg-secondary"
  >
    🔧 Advanced
  </button>

  <button
    onClick={() => setActiveSection("quality")}
    className="whitespace-nowrap w-full text-left px-3 py-2 rounded-md hover:bg-secondary"
  >
    
    🎯 Quality
  </button>
</div>
</Card>

<div className="space-y-6">
    
      {/* Configuration Tabs */}


        {/* Risk Tab */}
        {activeSection === "risk" && (
        <section id="risk" className="space-y-4">
          <h2 className="text-xl font-semibold">Risk Management</h2>
          <Card className="p-4 md:p-6 bg-card border-border">
            {/* Risk Per Trade */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-foreground font-semibold">Risk Per Trade (%)</Label>
                  <p className="text-xs text-muted-foreground">Percentage of balance risked per trade</p>
                </div>
                <span className="text-2xl font-bold text-primary">{config.risk_per_trade.toFixed(2)}%</span>
              </div>
              <Slider
                value={[config.risk_per_trade]}
                onValueChange={(value) => handleConfigChange('risk_per_trade', value[0])}
                min={0.1}
                max={5}
                step={0.1}
                className="w-full"
              />
            </div>

            {/* Max Daily Loss */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-foreground font-semibold">Max Daily Loss (%)</Label>
                  <p className="text-xs text-muted-foreground">Stop trading if daily loss exceeds this</p>
                </div>
                <span className="text-2xl font-bold text-trading-red">{config.max_daily_loss.toFixed(1)}%</span>
              </div>
              <Slider
                value={[config.max_daily_loss]}
                onValueChange={(value) => handleConfigChange('max_daily_loss', value[0])}
                min={1}
                max={10}
                step={0.5}
                className="w-full"
              />
            </div>

            {/* Max Drawdown */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-foreground font-semibold">Max Drawdown (%)</Label>
                  <p className="text-xs text-muted-foreground">Maximum allowed account drawdown</p>
                </div>
                <span className="text-2xl font-bold text-accent">{config.max_drawdown.toFixed(1)}%</span>
              </div>
              <Slider
                value={[config.max_drawdown]}
                onValueChange={(value) => handleConfigChange('max_drawdown', value[0])}
                min={2}
                max={20}
                step={0.5}
                className="w-full"
              />
            </div>
          </Card>
        </section>
        )}

        {/* Trading Tab */}
        {activeSection === "trading" && (
        <section id="trading" className="space-y-4">
          <h2 className="text-xl font-semibold">Trading</h2>
          <Card className="p-4 md:p-6 bg-card border-border">
            {/* Max Trades Per Day */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-foreground font-semibold">Max Trades Per Day</Label>
                  <p className="text-xs text-muted-foreground">Prevent overtrading</p>
                </div>
                <span className="text-2xl font-bold text-primary">{config.max_trades_per_day}</span>
              </div>
              <Slider
                value={[config.max_trades_per_day]}
                onValueChange={(value) => handleConfigChange('max_trades_per_day', Math.round(value[0]))}
                min={1}
                max={10}
                step={1}
                className="w-full"
              />
            </div>

            {/* Trading Pairs */}
            <div className="space-y-3 mb-6">
              <Label className="text-foreground font-semibold">Trading Pairs</Label>
              <div className="grid grid-cols-1 gap-2">
                {['XAUUSDm', 'EURUSDm', 'GBPUSDm', 'USDJPYm', 'EURGBPm', 'USTECm', 'ETHUSD', ].map(pair => (
                  <div key={pair} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={pair}
                      checked={config.trading_pairs.includes(pair)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          handleConfigChange('trading_pairs', [...config.trading_pairs, pair]);
                        } else {
                          handleConfigChange('trading_pairs', config.trading_pairs.filter(p => p !== pair));
                        }
                      }}
                      className="w-4 h-4 accent-primary rounded"
                    />
                    <label htmlFor={pair} className="text-sm text-foreground cursor-pointer">{pair}</label>
                  </div>
                ))}
              </div>
            </div>

            {/* Sessions */}
            <div className="space-y-3">
              <Label className="text-foreground font-semibold">Trading Sessions</Label>
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="london"
                    checked={config.allow_london}
                    onChange={(e) => handleConfigChange('allow_london', e.target.checked)}
                    className="w-4 h-4 accent-primary rounded"
                  />
                  <label htmlFor="london" className="text-sm text-foreground cursor-pointer">
                    🇬🇧 London (08:00-17:00 UTC)
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="ny"
                    checked={config.allow_ny}
                    onChange={(e) => handleConfigChange('allow_ny', e.target.checked)}
                    className="w-4 h-4 accent-primary rounded"
                  />
                  <label htmlFor="ny" className="text-sm text-foreground cursor-pointer">
                    🗽 New York (13:00-22:00 UTC)
                  </label>
                </div>
              </div>
            </div>

            {/* Demo Mode */}
            <div className="space-y-3 p-4 bg-secondary/20 rounded-lg border border-primary/20">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-foreground font-semibold">🧪 Session By-Pass</Label>
                  <p className="text-xs text-muted-foreground">Bypass session filter for testing (generates signals anytime)</p>
                </div>
                <input
                  type="checkbox"
                  id="demo_mode"
                  checked={config.demo_mode}
                  onChange={(e) => handleDemoModeChange(e.target.checked)}
                  className="w-5 h-5 accent-primary rounded"
                />
              </div>
              {config.demo_mode && (
                <Alert className="bg-warning/10 border-warning/30">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <AlertDescription className="text-xs text-warning">
                    Session By-Pass ACTIVE - Session filter disabled. Signals will be generated outside trading hours.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </Card>
        </section>
        )}

      {activeSection === "filters" && (
<section id="filters" className="space-y-4">



  <h2 className="text-xl font-semibold">Filters</h2>

  <Card className="p-4 md:p-6 bg-card border-border">
    <div className="space-y-8">

<div className="border-b border-border pb-6">
  <h3 className="text-lg font-semibold mb-4">
    Filter Toggles
  </h3>

  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <Label>Trend Filter</Label>
      <Switch checked={config.trend_filter} onCheckedChange={(v) => handleConfigChange("trend_filter", v)} />
    </div>

    <div className="flex items-center justify-between">
      <Label>ADX Filter</Label>
      <Switch checked={config.adx_filter} onCheckedChange={(v) => handleConfigChange("adx_filter", v)} />
    </div>

    <div className="flex items-center justify-between">
      <Label>ATR Filter</Label>
      <Switch checked={config.atr_filter} onCheckedChange={(v) => handleConfigChange("atr_filter", v)} />
    </div>

    <div className="flex items-center justify-between">
      <Label>ATR Extension Filter</Label>
      <Switch checked={config.atr_extension_filter} onCheckedChange={(v) => handleConfigChange("atr_extension_filter", v)} />
    </div>

    <div className="flex items-center justify-between">
      <Label>Momentum Filter</Label>
      <Switch checked={config.momentum_filter} onCheckedChange={(v) => handleConfigChange("momentum_filter", v)} />
    </div>

    <div className="flex items-center justify-between">
      <Label>Spread Filter</Label>
      <Switch checked={config.spread_filter} onCheckedChange={(v) => handleConfigChange("spread_filter", v)} />
    </div>

    <div className="flex items-center justify-between">
      <Label>Breakout Filter</Label>
      <Switch checked={config.breakout_filter} onCheckedChange={(v) => handleConfigChange("breakout_filter", v)} />
    </div>

    <div className="flex items-center justify-between">
      <Label>Entry EMA Filter</Label>
      <Switch checked={config.entry_ema_filter} onCheckedChange={(v) => handleConfigChange("entry_ema_filter", v)} />
    </div>
  </div>
</div>

      
      {/* Risk Management */}
<div className="border-t border-border pt-6 space-y-6">
  <h3 className="text-lg font-semibold">
    Risk Management
  </h3>

  {/* Stop Loss */}
  <div className="space-y-2">
    <div className="flex justify-between">
      <label className="text-sm font-medium">
        Stop Loss ($)
      </label>
      <span className="font-mono text-red-400">
        {config.stop_loss}
      </span>
    </div>

    <input
      type="range"
      min="0.5"
      max="200"
      step="0.1"
      value={config.stop_loss}
      onChange={(e) =>
        setConfig({
          ...config,
          stop_loss: Number(e.target.value),
        })
      }
      className="w-full"
    />
  </div>

  {/* Take Profit */}
  <div className="space-y-2">
    <div className="flex justify-between">
      <label className="text-sm font-medium">
        Take Profit ($)
      </label>
      <span className="font-mono text-green-400">
        {config.take_profit}
      </span>
    </div>

    <input
      type="range"
      min="0.5"
      max="200"
      step="0.1"
      value={config.take_profit}
      onChange={(e) =>
        setConfig({
          ...config,
          take_profit: Number(e.target.value),
        })
      }
      className="w-full"
    />
  </div>
</div>

      <div>
        <div className="flex justify-between mb-2">
          <Label>EMA Fast</Label>
          <span>{config.ema_fast}</span>
        </div>
        <Slider value={[config.ema_fast]} onValueChange={(v)=>handleConfigChange('ema_fast',v[0])} min={5} max={100} step={1}/>
      </div>

      <div>
        <div className="flex justify-between mb-2">
          <Label>EMA Slow</Label>
          <span>{config.ema_slow}</span>
        </div>
        <Slider value={[config.ema_slow]} onValueChange={(v)=>handleConfigChange('ema_slow',v[0])} min={10} max={400} step={5}/>
      </div>

      <div>
        <div className="flex justify-between mb-2">
          <Label>ENTRY EMA</Label>
          <span>{config.entry_ema}</span>
        </div>
        <Slider value={[config.entry_ema]} onValueChange={(v)=>handleConfigChange('entry_ema',v[0])} min={10} max={400} step={5}/>
      </div>

      <div>
        <div className="flex justify-between mb-2">
          <Label>ADX Threshold</Label>
          <span>{config.adx_threshold}</span>
        </div>
        <Slider value={[config.adx_threshold]} onValueChange={(v)=>handleConfigChange('adx_threshold',v[0])} min={10} max={50} step={1}/>
      </div>

      <div>
        <div className="flex justify-between mb-2">
          <Label>ATR Ratio</Label>
          <span>{config.atr_ratio}</span>
        </div>
        <Slider value={[config.atr_ratio*100]} onValueChange={(v)=>handleConfigChange('atr_ratio',v[0]/100)} min={50} max={200} step={5}/>
      </div>

      <div>
        <div className="flex justify-between mb-2">
          <Label>ATR Extension</Label>
          <span>{config.atr_extension}</span>
        </div>
        <Slider value={[config.atr_extension*10]} onValueChange={(v)=>handleConfigChange('atr_extension',v[0]/10)} min={10} max={50} step={1}/>
      </div>

      <div>
        <div className="flex justify-between mb-2">
          <Label>Momentum Multiplier</Label>
          <span>{config.momentum_multiplier}</span>
        </div>
        <Slider value={[config.momentum_multiplier*10]} onValueChange={(v)=>handleConfigChange('momentum_multiplier',v[0]/10)} min={5} max={30} step={1}/>
      </div>

      <div>
        <div className="flex justify-between mb-2">
          <Label>Max Spread</Label>
          <span>{config.max_spread}</span>
        </div>
        <Slider value={[config.max_spread*100]} onValueChange={(v)=>handleConfigChange('max_spread',v[0]/100)} min={5} max={1000} step={1}/>
      </div>

      <div>
        <Label className="mb-2 block">Trend Timeframe</Label>
        <Select value={config.trend_tf} onValueChange={(v)=>handleConfigChange('trend_tf',v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="M15">M15</SelectItem>
            <SelectItem value="H1">H1</SelectItem>
            <SelectItem value="H4">H4</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="mb-2 block">Entry Timeframe</Label>
        <Select value={config.entry_tf} onValueChange={(v)=>handleConfigChange('entry_tf',v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="M1">M1</SelectItem>
            <SelectItem value="M5">M5</SelectItem>
            <SelectItem value="M15">M15</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <div className="flex justify-between mb-2">
          <Label>ema_pullback_tolerance</Label>
          <span>{config.breakout_buffer}</span>
        </div>
        <Slider value={[config.breakout_buffer*100]} onValueChange={(v)=>handleConfigChange('breakout_buffer',v[0]/100)} min={5} max={100} step={5}/>
      </div>

    </div>
  </Card>
</section>
)}  


        {activeSection === "execution" && (
        <section id="execution" className="space-y-4">
          <h2 className="text-xl font-semibold">Execution</h2>
          <Card className="p-4 md:p-6 bg-card border-border">
            <div className="space-y-8">
              <div>
                <div className="flex justify-between mb-2">
                  <Label>Cooldown Between Trades (min)</Label>
                  <span>{config.cooldown_minutes}</span>
                </div>
                <Slider value={[config.cooldown_minutes]} onValueChange={(v)=>handleConfigChange('cooldown_minutes',v[0])} min={0} max={60} step={1}/>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <Label>Max Open Positions</Label>
                  <span>{config.max_open_positions}</span>
                </div>
                <Slider value={[config.max_open_positions]} onValueChange={(v)=>handleConfigChange('max_open_positions',v[0])} min={1} max={10} step={1}/>
              </div>
            </div>
          </Card>
        </section>
        )}

        {activeSection === "advanced" && (
        <section id="advanced" className="space-y-4">
          <h2 className="text-xl font-semibold">Advanced</h2>
          <Card className="p-4 md:p-6 bg-card border-border">
            <p className="text-sm text-muted-foreground">Advanced bot options will go here.</p>
          </Card>
        </section>
        )}


        {/* Quality Tab */}
        {activeSection === "quality" && (
        <section id="quality" className="space-y-4">
          <h2 className="text-xl font-semibold">Signal Quality</h2>
          <Card className="p-4 md:p-6 bg-card border-border">
            {/* Confluence Threshold */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-foreground font-semibold">Confluence Threshold</Label>
                  <p className="text-xs text-muted-foreground">Minimum signal confidence score (0-100)</p>
                </div>
                <span className="text-2xl font-bold text-accent">{config.confluence_threshold}</span>
              </div>
              <Slider
                value={[config.confluence_threshold]}
                onValueChange={(value) => handleConfigChange('confluence_threshold', Math.round(value[0]))}
                min={40}
                max={100}
                step={5}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Higher = More selective signals = Higher win rate but fewer trades
              </p>
            </div>
          </Card>
        </section>
        )}
        </div>
</div>
      

      {/* Info Alert */}
      <Alert className="bg-primary/10 border-primary">
        <AlertCircle className="h-4 w-4 text-primary" />
        <AlertDescription className="text-foreground">
          Configuration changes apply immediately to the trading bot. Make changes only when you understand the impact.
        </AlertDescription>
      </Alert>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={!unsavedChanges}
          className={`flex-1 ${
            saveStatus === 'saved'
              ? 'bg-trading-green hover:bg-trading-green/90'
              : 'bg-primary hover:bg-primary/90'
          }`}
        >
          <Save className="w-4 h-4 mr-2" />
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved ✓' : 'Save Configuration'}
        </Button>

        <Button
          variant="destructive"
          onClick={clearTradeHistory}
        >
          Clear Trades
        </Button>
      </div>
    </div>
  );
}
