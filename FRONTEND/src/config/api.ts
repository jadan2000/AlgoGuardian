// Use an explicit deployment URL when configured; otherwise target the backend
// on the same host that served this frontend. This supports phone testing over LAN.
const configuredApiBase = (import.meta as any).env?.VITE_API_BASE as string | undefined;
const currentHost = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";

export const API_BASE = (configuredApiBase || `http://${currentHost}:8000`).replace(/\/$/, "");
