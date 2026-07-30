import type { Device } from "./types";

export type NetComplyDataMode = "mock" | "real";

const dataModeKey = "netcomply:dataMode";
const defaultMode = (import.meta.env.VITE_NETCOMPLY_DATA_MODE === "real" ? "real" : "mock") as NetComplyDataMode;
const realDevicesEndpoint = import.meta.env.VITE_NETCOMPLY_REAL_DEVICES_ENDPOINT || "/api/netcomply/scan/devices/";

export function getStoredDataMode(): NetComplyDataMode {
  const stored = window.localStorage.getItem(dataModeKey);
  return stored === "real" || stored === "mock" ? stored : defaultMode;
}

export function saveStoredDataMode(mode: NetComplyDataMode) {
  window.localStorage.setItem(dataModeKey, mode);
}

export async function loadRealDevices(): Promise<Device[]> {
  const response = await fetch(realDevicesEndpoint, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Real scan endpoint returned ${response.status}`);
  const payload = await response.json();
  if (Array.isArray(payload)) return payload as Device[];
  if (Array.isArray(payload.devices)) return payload.devices as Device[];
  return [];
}
