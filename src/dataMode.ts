import type { Device, PolicySetting, RemediationTemplate, TemplateRequest, Ticket } from "./types";

export type NetComplyDataMode = "mock" | "real";

const dataModeKey = "netcomply:dataMode";
const defaultMode = (import.meta.env.VITE_NETCOMPLY_DATA_MODE === "real" ? "real" : "mock") as NetComplyDataMode;
const realDevicesEndpoint = import.meta.env.VITE_NETCOMPLY_REAL_DEVICES_ENDPOINT || "https://127.0.0.1:8443/api/hcc/scan/devices/";
const realApiBase = import.meta.env.VITE_NETCOMPLY_REAL_API_BASE || "https://127.0.0.1:8443/api/hcc";

function endpoint(path: string) {
  return `${realApiBase.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

export function resolveRealApiUrl(path: string) {
  if (!path || /^https?:\/\//i.test(path) || !path.startsWith("/api/")) return path;
  const baseOrigin = realApiBase.match(/^(https?:\/\/[^/]+)/i)?.[1];
  return baseOrigin ? `${baseOrigin}${path}` : path;
}

export function normalizeConfigSnapshotPath(path: string) {
  return path
    .replace(/^\/api\/hcc\/scan\/config-snapshots\//i, "/api/HCCFix/scan/config-snapshots/")
    .replace(/^\/api\/netcomply\/scan\/config-snapshots\//i, "/api/HCCFix/scan/config-snapshots/");
}

async function requestJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) throw new Error(`Real API returned ${response.status} for ${url}`);
  return response.json() as Promise<T>;
}

async function requestFormJson<T>(url: string, body: FormData): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json" },
    body,
  });
  if (!response.ok) throw new Error(`Real API returned ${response.status} for ${url}`);
  return response.json() as Promise<T>;
}

export function getStoredDataMode(): NetComplyDataMode {
  const stored = window.localStorage.getItem(dataModeKey);
  return stored === "real" || stored === "mock" ? stored : defaultMode;
}

export function saveStoredDataMode(mode: NetComplyDataMode) {
  window.localStorage.setItem(dataModeKey, mode);
}

export async function loadRealDevices(): Promise<Device[]> {
  const payload = await requestJson<Device[] | { devices?: Device[] }>(realDevicesEndpoint);
  if (Array.isArray(payload)) return payload as Device[];
  if (Array.isArray(payload.devices)) return payload.devices as Device[];
  return [];
}

export async function loadRealPolicySettings(): Promise<PolicySetting[]> {
  const payload = await requestJson<PolicySetting[] | { policySettings?: PolicySetting[] }>(endpoint("policy-settings/"));
  if (Array.isArray(payload)) return payload;
  return payload.policySettings ?? [];
}

export async function saveRealPolicySettings(policySettings: PolicySetting[]): Promise<PolicySetting[]> {
  const payload = await requestJson<{ policySettings?: PolicySetting[] }>(endpoint("policy-settings/"), {
    method: "PUT",
    body: JSON.stringify({ policySettings }),
  });
  return payload.policySettings ?? policySettings;
}

export async function onboardRealPolicySettings(policySettings: PolicySetting[]): Promise<PolicySetting[]> {
  const payload = await requestJson<{ policySettings?: PolicySetting[] }>(endpoint("policy-settings/"), {
    method: "POST",
    body: JSON.stringify({ policySettings }),
  });
  return payload.policySettings ?? policySettings;
}

export async function deleteRealPolicySettings(policySettingIds: string[]): Promise<PolicySetting[]> {
  const payload = await requestJson<{ policySettings?: PolicySetting[] }>(endpoint("policy-settings/"), {
    method: "DELETE",
    body: JSON.stringify({ ids: policySettingIds }),
  });
  return payload.policySettings ?? [];
}

export async function extractRealPolicySettingsFromDocument(document: File): Promise<PolicySetting[]> {
  const body = new FormData();
  body.append("document", document);
  const payload = await requestFormJson<{ policySettings?: PolicySetting[] }>(endpoint("policy-settings/extract-document/"), body);
  return payload.policySettings ?? [];
}

export async function loadRealTemplates(): Promise<RemediationTemplate[]> {
  const payload = await requestJson<RemediationTemplate[] | { templates?: RemediationTemplate[] }>(endpoint("templates/"));
  if (Array.isArray(payload)) return payload;
  return payload.templates ?? [];
}

export async function saveRealTemplates(templates: RemediationTemplate[]): Promise<RemediationTemplate[]> {
  const payload = await requestJson<{ templates?: RemediationTemplate[] }>(endpoint("templates/"), {
    method: "PUT",
    body: JSON.stringify({ templates }),
  });
  return payload.templates ?? templates;
}

export async function loadRealTemplateRequests(): Promise<TemplateRequest[]> {
  const payload = await requestJson<TemplateRequest[] | { templateRequests?: TemplateRequest[] }>(endpoint("template-requests/"));
  if (Array.isArray(payload)) return payload;
  return payload.templateRequests ?? [];
}

export async function saveRealTemplateRequests(templateRequests: TemplateRequest[]): Promise<TemplateRequest[]> {
  const payload = await requestJson<{ templateRequests?: TemplateRequest[] }>(endpoint("template-requests/"), {
    method: "PUT",
    body: JSON.stringify({ templateRequests }),
  });
  return payload.templateRequests ?? templateRequests;
}

export async function loadRealTickets(): Promise<Ticket[]> {
  const payload = await requestJson<Ticket[] | { tickets?: Ticket[] }>(endpoint("tickets/"));
  if (Array.isArray(payload)) return payload;
  return payload.tickets ?? [];
}

export async function saveRealTickets(tickets: Ticket[]): Promise<Ticket[]> {
  const payload = await requestJson<{ tickets?: Ticket[] }>(endpoint("tickets/"), {
    method: "PUT",
    body: JSON.stringify({ tickets }),
  });
  return payload.tickets ?? tickets;
}

export async function saveRealTicket(ticket: Ticket): Promise<Ticket> {
  const payload = await requestJson<{ ticket?: Ticket }>(endpoint("tickets/"), {
    method: "POST",
    body: JSON.stringify(ticket),
  });
  return payload.ticket ?? ticket;
}
