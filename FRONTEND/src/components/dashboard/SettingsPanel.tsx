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
  const { isActive, isPaused, session, startBot, stopBot, pauseBot, resumeBot, refreshBotStatus } = useBotContext();

  const [config, setConfig] = useState<BotConfig>({
    is_active: false,
    demo_mode: false,
    ...defaultBotConfig,
    momentum_min_body_atr: 0.2,
    momentum_close_location: 0.6,
    breakout_lookback: 5,
  } as BotConfig);

  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('risk');

  const clearTradeHistory = async () => {
    if (!window.confirm('Clear all trade history?')) return;

    try {
      const response = await fetch(`${API_BASE}/api/trading/trades/clear`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        alert('Trade history cleared');
        window.location.reload();
      }
    } catch (error) {
      console.error(error);
      alert('Failed to clear trade history');
    }
  };

  const loadConfig = async () => {
    try {
      const response = await fetch(`${API_BASE}/config`);
      if (response.ok) {
        const data = await response.json();
        setConfig(prev => ({
          ...prev,
          ...defaultBotConfig,
          ...data,
          demo_mode: data.demo_mode ?? false,
          momentum_min_body_atr: data.momentum_min_body_atr ?? 0.2,
          momentum_close_location: data.momentum_close_location ?? 0.6,
          breakout_lookback: data.breakout_lookback ?? 5,
        }));
      }
    } catch (error) {
      console.error('Failed to load bot config:', error);
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
  };

  const handleDemoModeChange = async (value: boolean) => {
    setConfig(prev => ({ ...prev, demo_mode: value }));

    try {
      const response = await fetch(`${API_BASE}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demo_mode: value }),
      });
      if (response.ok) setUnsavedChanges(false);
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

        trend_filter: config.trend_filter,
        adx_filter: config.adx_filter,
        atr_filter: config.atr_filter,
        atr_extension_filter: config.atr_extension_filter,
        momentum_filter: config.momentum_filter,
        spread_filter: config.spread_filter,
        breakout_filter: config.breakout_filter,
        entry_ema_filter: config.entry_ema_filter,

        ema_fast: config.ema_fast,
        ema_slow: config.ema_slow,
        entry_ema: config.entry_ema,
        adx_threshold: config.adx_threshold,
        atr_ratio: config.atr_ratio,
        atr_extension: config.atr_extension,
        momentum_multiplier: config.momentum_multiplier,
        momentum_min_body_atr: config.momentum_min_body_atr,
        momentum_close_location: config.momentum_close_location,
        max_spread: config.max_spread,
        trend_tf: config.trend_tf,
        entry_tf: config.entry_tf,
        cooldown_minutes: config.cooldown_minutes,
        max_open_positions: config.max_open_positions,
        breakout_buffer: config.breakout_buffer,
        breakout_lookback: config.breakout_lookback,

        stop_loss: config.stop_loss,
        take_profit: config.take_profit,

        lot_size: config.lot_size,
        deviation: config.deviation,
        magic: config.magic,
        order_comment: config.order_comment,
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
      if (data.config) {
        setConfig(prev => ({ ...prev, ...data.config }));
      }
      setSaveStatus('saved');
      setUnsavedChanges(false);
      setTimeout(() => setSaveStatus('idle'), 3000);
      await refreshBotStatus();
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Bot Settings</h2>
          <p className="text-sm text-muted-foreground">Fast XAUUSD scalper configuration</p>
        </div>
        <Button onClick={handleSave} disabled={!unsavedChanges || saveStatus === 'saving'}>
          <Save className="mr-2 h-4 w-4" />
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 md:gap-6">
        <Card className="w-full p-4 md:sticky md:top-4 overflow-x-auto">
          <div className="flex overflow-x-auto gap-2 md:block md:space-y-2">
            <button onClick={() => setActiveSection('risk')} className="whitespace-nowrap w-full text-left px-3 py-2 rounded-md hover:bg-secondary">💰 Risk</button>
            <button onClick={() => setActiveSection('trading')} className="whitespace-nowrap w-full text-left px-3 py-2 rounded-md hover:bg-secondary">📊 Trading</button>
            <button onClick={() => setActiveSection('filters')} className="whitespace-nowrap w-full text-left px-3 py-2 rounded-md hover:bg-secondary">🧩 Filters</button>
            <button onClick={() => setActiveSection('execution')} className="whitespace-nowrap w-full text-left px-3 py-2 rounded-md hover:bg-secondary">⚡ Execution</button>
            <button onClick={() => setActiveSection('advanced')} className="whitespace-nowrap w-full text-left px-3 py-2 rounded-md hover:bg-secondary">🔧 Advanced</button>
            <button onClick={() => setActiveSection('quality')} className="whitespace-nowrap w-full text-left px-3 py-2 rounded-md hover:bg-secondary">🎯 Quality</button>
          </div>
        </Card>

        <Card className="p-4 md:p-6">
          <p className="text-sm text-muted-foreground">
            Settings are loaded from and saved to the backend configuration API. The frontend payload includes every strategy, filter, execution, and risk field supported by the backend.
          </p>
        </Card>
      </div>
    </div>
  );
}
