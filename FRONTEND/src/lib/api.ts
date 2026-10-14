import { API_BASE } from "@/config/api";

/**
 * Shared endpoint map. API_BASE follows the host serving the frontend, so
 * a phone on the same Wi-Fi calls the laptop's LAN IP instead of phone localhost.
 */
const API_BASE_URL = API_BASE;

export const API = {
  BASE: API_BASE_URL,
  BOT: {
    STATUS: `${API_BASE_URL}/bot/status`,
    START: `${API_BASE_URL}/bot/start`,
    STOP: `${API_BASE_URL}/bot/pause`,
    PAUSE: `${API_BASE_URL}/bot/pause`,
    RESUME: `${API_BASE_URL}/bot/start`,
    KILL_SWITCH: `${API_BASE_URL}/bot/kill`,
    SIGNALS: (limit?: number) => `${API_BASE_URL}/bot/signals${limit ? `?limit=${limit}` : ""}`,
    TRADES: `${API_BASE_URL}/trades/`,
    TRADES_CLOSED: (limit?: number) => `${API_BASE_URL}/trades/closed${limit ? `?limit=${limit}` : ""}`,
    TRADE_CLOSE: (ticket: string) => `${API_BASE_URL}/trades/${ticket}/close`,
    SESSION_INFO: `${API_BASE_URL}/api/bot/session-info`,
    CONFIG: `${API_BASE_URL}/config/`,
  },
  TRADING: {
    MARKET_OVERVIEW: `${API_BASE_URL}/api/trading/market-overview`,
    ACCOUNT: `${API_BASE_URL}/api/trading/account`,
  },
  LOGS: {
    EXPORT: `${API_BASE_URL}/logs/export`,
  },
};

export default API;
