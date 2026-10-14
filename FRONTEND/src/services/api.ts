import { API_BASE } from "@/config/api";

export async function getHealth() {
  const response = await fetch(API_BASE, { cache: "no-store" });
  if (!response.ok) throw new Error(`Backend not reachable (HTTP ${response.status})`);
  return response.json();
}
