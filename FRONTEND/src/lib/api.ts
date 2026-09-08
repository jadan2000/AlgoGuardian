/**
 * Centralized API configuration
 * Uses environment variable VITE_API_URL to determine backend endpoint
 */

const API_BASE_URL = 
  import.meta.env.VITE_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname === 'localhost' 
    ? 'http://${API_BASE}' 
    : `http://${window.location.hostname}:8001`);

export const API = {
  BASE: API_BASE_URL,
  
  // Bot endpoints
  BOT: {
    STATUS: `${API_BASE_URL}/api/bot/status`,
    START: `${API_BASE_URL}/api/bot/start`,
    STOP: `${API_BASE_URL}/api/bot/stop`,
    PAUSE: `${API_BASE_URL}/api/bot/pause`,
    RESUME: `${API_BASE_URL}/api/bot/resume`,
    KILL_SWITCH: `${API_BASE_URL}/api/bot/kill-switch`,
    SIGNALS: (limit?: number) => `${API_BASE_URL}/api/bot/signals${limit ? `?limit=${limit}` : ''}`,
    TRADES: `${API_BASE_URL}/api/bot/trades`,
    TRADES_CLOSED: (limit?: number) => `${API_BASE_URL}/api/bot/trades/closed${limit ? `?limit=${limit}` : ''}`,
    TRADE_CLOSE: (ticket: string) => `${API_BASE_URL}/api/bot/trades/${ticket}/close`,
    SESSION_INFO: `${API_BASE_URL}/api/bot/session-info`,
    CONFIG: `${API_BASE_URL}/api/bot/config`,
  },
  
  // Trading endpoints
  TRADING: {
    MARKET_OVERVIEW: `${API_BASE_URL}/api/trading/market-overview`,
    ACCOUNT: `${API_BASE_URL}/api/trading/account`,
  },
  
  // Logs endpoints
  LOGS: {
    EXPORT: `${API_BASE_URL}/api/logs/export`,
  },
};

export default API;
