import React from "react";

import { getStoredDataMode, loadRealDevices } from "./dataMode";
import { formatDate, findFindingKey, getExecutableFindings, getTemplateCommandCount, hasExecutableFix, resolveTemplateForDevice } from "./helpers";
import { initialDevices, initialPolicySettings, initialTemplateRequests, initialTemplates, initialTickets } from "./mockData";
import type { Device, PolicySetting, RemediationTemplate, TemplateRequest, Ticket, TicketDevice, TicketStatus, UserRole } from "./types";

export const portalRoutePaths = {
  dashboard: "/dashboard",
  inventory: "/exceptions",
  deviceDetail: "/exceptions/device-detail",
  ticketDetail: "/tickets/detail",
  createTicket: "/tickets/create",
  templates: "/fix-templates",
  templateRequests: "/fix-template-requests",
};

export function navigateToPortalPath(path: string, params: Record<string, string> = {}) {
  const query = new URLSearchParams(params);
  const nextUrl = query.size > 0 ? `${path}?${query.toString()}` : path;
  window.location.assign(nextUrl);
}

export function getRouteValue(paramName: string, storageKey: string) {
  const routeValue = new URLSearchParams(window.location.search).get(paramName);
  return routeValue || window.sessionStorage.getItem(storageKey) || "";
}

export function setRouteValue(storageKey: string, value: string) {
  window.sessionStorage.setItem(storageKey, value);
}

export function getInitialDevices() {
  return initialDevices;
}

export function usePortalDevices(overrideDevices?: Device[]) {
  const [devices, setDevices] = React.useState<Device[]>(overrideDevices ?? getInitialDevices());
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (overrideDevices) {
      setDevices(overrideDevices);
      setLoading(false);
      setError(null);
      return;
    }

    if (getStoredDataMode() !== "real") {
      setDevices(getInitialDevices());
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    loadRealDevices()
      .then((nextDevices) => {
        if (!cancelled) setDevices(nextDevices);
      })
      .catch((nextError: unknown) => {
        if (!cancelled) {
          setDevices([]);
          setError(nextError instanceof Error ? nextError.message : "Unable to load real scan devices.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [overrideDevices]);

  return { devices, loading, error };
}

export function getInitialPolicySettings() {
  return initialPolicySettings;
}

export function getInitialTemplates() {
  return initialTemplates;
}

export function getInitialTemplateRequests() {
  return initialTemplateRequests;
}

export function getInitialTickets() {
  return initialTickets;
}

const runtimeTicketsKey = "netcomply:runtimeTickets";
const latestRuntimeTicketIdKey = "netcomply:latestRuntimeTicketId";
const runtimeTemplatesKey = "netcomply:runtimeTemplates";
const runtimeTemplateRequestsKey = "netcomply:runtimeTemplateRequests";

function readRuntimeArray<T>(storageKey: string, fallback: T[]) {
  const stored = window.sessionStorage.getItem(storageKey);
  if (!stored) return fallback;

  try {
    const parsed = JSON.parse(stored) as T[];
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeRuntimeArray<T>(storageKey: string, value: T[]) {
  window.sessionStorage.setItem(storageKey, JSON.stringify(value));
}

export function getRuntimeTemplates() {
  return readRuntimeArray<RemediationTemplate>(runtimeTemplatesKey, getInitialTemplates());
}

export function saveRuntimeTemplates(templates: RemediationTemplate[]) {
  writeRuntimeArray(runtimeTemplatesKey, templates);
}

export function getRuntimeTemplateRequests() {
  return readRuntimeArray<TemplateRequest>(runtimeTemplateRequestsKey, getInitialTemplateRequests());
}

export function saveRuntimeTemplateRequests(requests: TemplateRequest[]) {
  writeRuntimeArray(runtimeTemplateRequestsKey, requests);
}

export function getRuntimeTickets() {
  return readRuntimeArray<Ticket>(runtimeTicketsKey, getInitialTickets());
}

export function saveRuntimeTickets(tickets: Ticket[]) {
  writeRuntimeArray(runtimeTicketsKey, tickets);
}

export function addRuntimeTicket(ticket: Ticket) {
  const nextTickets = [ticket, ...getRuntimeTickets().filter((item) => item.id !== ticket.id)];
  saveRuntimeTickets(nextTickets);
  setRouteValue(latestRuntimeTicketIdKey, ticket.id);
  return nextTickets;
}

export function getLatestRuntimeTicketId() {
  return window.sessionStorage.getItem(latestRuntimeTicketIdKey) || "";
}

export function updateRuntimeTicketStatus(id: string, status: TicketStatus) {
  const nextTickets = updateTicketStatus(getRuntimeTickets(), id, status);
  saveRuntimeTickets(nextTickets);
  return nextTickets;
}

export type CreateTicketState = {
  selectedDeviceIds: string[];
  selectedFindingKeys: string[];
  plannedStart: Date | null;
  plannedEnd: Date | null;
  implementationPlan: string;
  backoutPlan: string;
};

export function createInitialTicketState(): CreateTicketState {
  return {
    selectedDeviceIds: [],
    selectedFindingKeys: [],
    plannedStart: null,
    plannedEnd: null,
    implementationPlan: "",
    backoutPlan: "",
  };
}

export function getSelectedTicketDevices(devices: Device[], selectedDeviceIds: string[], selectedFindingKeys: string[], templates: RemediationTemplate[], policySettings: PolicySetting[]): TicketDevice[] {
  return devices
    .filter((device) => selectedDeviceIds.includes(device.id))
    .map((device) => ({
      deviceId: device.id,
      hostname: device.hostname,
      role: device.role,
      hardwareType: device.hardwareType,
      managementIp: device.managementIp,
      configSnapshotPath: device.configSnapshotPath,
      configSnapshotFilename: device.configSnapshotFilename,
      findings: device.findings.filter((finding) => selectedFindingKeys.includes(findFindingKey(device.id, finding.id)) && hasExecutableFix(device, finding, templates, policySettings)),
    }))
    .filter((device) => device.findings.length > 0);
}

export function getSelectedCommandCount(selectedTicketDevices: TicketDevice[], templates: RemediationTemplate[], policySettings: PolicySetting[]) {
  return selectedTicketDevices.reduce((total, device) => total + device.findings.reduce((count, finding) => count + getTemplateCommandCount(resolveTemplateForDevice(device, finding, templates, policySettings)), 0), 0);
}

export function getPreselectedFindingKeys(device: Device, templates: RemediationTemplate[], policySettings: PolicySetting[]) {
  return getExecutableFindings(device, templates, policySettings).map((finding) => findFindingKey(device.id, finding.id));
}

export function createPendingTicket(currentRole: UserRole, tickets: Ticket[], selectedTicketDevices: TicketDevice[], state: CreateTicketState): Ticket {
  return {
    id: `TKT-${2846 + tickets.length}`,
    crNumber: `CR-2025-${String(126 + tickets.length).padStart(6, "0")}`,
    requestor: "Current User",
    requestorRole: currentRole,
    devices: selectedTicketDevices,
    plannedStart: formatDate(state.plannedStart),
    plannedEnd: "",
    status: "Pending Approval",
    implementationPlan: "",
    backoutPlan: "",
    createdAt: formatDate(new Date()),
  };
}

export function updateTicketStatus(tickets: Ticket[], id: string, status: TicketStatus) {
  return tickets.map((ticket) => (ticket.id === id ? { ...ticket, status } : ticket));
}
