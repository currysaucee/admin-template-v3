import React from "react";

import {
  deleteRealPolicySettings,
  enqueueRealDeployment,
  extractRealPolicySettingsFromDocument,
  loadRealDeploymentQueueState,
  loadRealDeploymentQueue,
  loadRealDevices,
  loadRealPolicySettings,
  loadRealTemplateRequests,
  loadRealTemplates,
  loadRealTickets,
  onboardRealPolicySettings,
  runRealScanImport,
  saveRealPolicySettings,
  saveRealTemplateRequests,
  saveRealTemplates,
  saveRealTicket,
  saveRealTickets,
  updateRealTicketStatus,
} from "./dataMode";
import { formatDate, findFindingKey, getExecutableFindings, getTemplateCommandCount, hasExecutableFix, resolveTemplateForDevice } from "./helpers";
import type { DeploymentQueueItem, DeploymentWorkerHealth, Device, PolicySetting, RemediationTemplate, TemplateRequest, Ticket, TicketDevice, TicketStatus, UserRole } from "./types";

export const portalRoutePaths = {
  dashboard: "/dashboard",
  inventory: "/exceptions",
  deviceDetail: "/exceptions/device-detail",
  ticketDetail: "/tickets/detail",
  createTicket: "/tickets/create",
  templates: "/fix-templates",
  templateRequests: "/fix-template-requests",
  developerConsole: "/developer-console",
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
  return [];
}

export function usePortalDevices(overrideDevices?: Device[]) {
  const [devices, setDevices] = React.useState<Device[]>(overrideDevices ?? []);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (overrideDevices) {
      setDevices(overrideDevices);
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

export async function runRuntimeScanImport() {
  return runRealScanImport();
}

export function getInitialPolicySettings() {
  return [];
}

function usePortalCollection<T>(fallback: T[], loader: () => Promise<T[]>, override?: T[]) {
  const [items, setItems] = React.useState<T[]>(override ?? []);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (override) {
      setItems(override);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    loader()
      .then((nextItems) => {
        if (!cancelled) setItems(nextItems);
      })
      .catch((nextError: unknown) => {
        if (!cancelled) {
          setItems([]);
          setError(nextError instanceof Error ? nextError.message : "Unable to load real data.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [override, fallback, loader]);

  return { items, setItems, loading, error };
}

export function usePortalPolicySettings(overridePolicySettings?: PolicySetting[]) {
  const fallback = React.useMemo(() => getRuntimePolicySettings(), []);
  return usePortalCollection<PolicySetting>(fallback, loadRealPolicySettings, overridePolicySettings);
}

export function getInitialTemplates() {
  return [];
}

export function usePortalTemplates(overrideTemplates?: RemediationTemplate[]) {
  const fallback = React.useMemo(() => getRuntimeTemplates(), []);
  return usePortalCollection<RemediationTemplate>(fallback, loadRealTemplates, overrideTemplates);
}

export function getInitialTemplateRequests() {
  return [];
}

export function usePortalTemplateRequests(overrideRequests?: TemplateRequest[]) {
  const fallback = React.useMemo(() => getRuntimeTemplateRequests(), []);
  return usePortalCollection<TemplateRequest>(fallback, loadRealTemplateRequests, overrideRequests);
}

export function getInitialTickets() {
  return [];
}

export function usePortalTickets(overrideTickets?: Ticket[]) {
  const fallback = React.useMemo(() => getRuntimeTickets(), []);
  return usePortalCollection<Ticket>(fallback, loadRealTickets, overrideTickets);
}

const runtimeTicketsKey = "netcomply:runtimeTickets";
const latestRuntimeTicketIdKey = "netcomply:latestRuntimeTicketId";
const runtimePolicySettingsKey = "netcomply:runtimePolicySettings";
const runtimeTemplatesKey = "netcomply:runtimeTemplates";
const runtimeTemplateRequestsKey = "netcomply:runtimeTemplateRequests";
const runtimeDeploymentQueueKey = "netcomply:runtimeDeploymentQueue";

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

export function getRuntimePolicySettings() {
  return readRuntimeArray<PolicySetting>(runtimePolicySettingsKey, getInitialPolicySettings());
}

export function saveRuntimePolicySettings(policySettings: PolicySetting[]) {
  void saveRealPolicySettings(policySettings);
}

export async function onboardRuntimePolicySettings(policySettings: PolicySetting[]) {
  return onboardRealPolicySettings(policySettings);
}

export async function deleteRuntimePolicySettings(policySettingIds: string[]) {
  return deleteRealPolicySettings(policySettingIds);
}

export async function extractRuntimePolicySettingsFromDocument(document: File) {
  return extractRealPolicySettingsFromDocument(document);
}

export function saveRuntimeTemplates(templates: RemediationTemplate[]) {
  void saveRealTemplates(templates);
}

export function getRuntimeTemplateRequests() {
  return readRuntimeArray<TemplateRequest>(runtimeTemplateRequestsKey, getInitialTemplateRequests());
}

export function saveRuntimeTemplateRequests(requests: TemplateRequest[]) {
  void saveRealTemplateRequests(requests);
}

export function getRuntimeTickets() {
  return readRuntimeArray<Ticket>(runtimeTicketsKey, getInitialTickets());
}

export function saveRuntimeTickets(tickets: Ticket[]) {
  void saveRealTickets(tickets);
}

export function addRuntimeTicket(ticket: Ticket) {
  const nextTickets = [ticket, ...getRuntimeTickets().filter((item) => item.id !== ticket.id)];
  void saveRealTicket(ticket);
  setRouteValue(latestRuntimeTicketIdKey, ticket.id);
  return nextTickets;
}

export function getLatestRuntimeTicketId() {
  return window.sessionStorage.getItem(latestRuntimeTicketIdKey) || "";
}

export async function updateRuntimeTicketStatus(id: string, status: TicketStatus) {
  return updateRealTicketStatus(id, status);
}

export function getRuntimeDeploymentQueue() {
  return readRuntimeArray<DeploymentQueueItem>(runtimeDeploymentQueueKey, []);
}

export function usePortalDeploymentQueue(overrideQueue?: DeploymentQueueItem[]) {
  return usePortalCollection<DeploymentQueueItem>(getRuntimeDeploymentQueue(), loadRealDeploymentQueue, overrideQueue);
}

export function usePortalDeploymentQueueState(overrideQueue?: DeploymentQueueItem[]) {
  const [queue, setQueue] = React.useState<DeploymentQueueItem[]>(overrideQueue ?? getRuntimeDeploymentQueue());
  const [workerHealth, setWorkerHealth] = React.useState<DeploymentWorkerHealth[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (overrideQueue) {
      setQueue(overrideQueue);
      setWorkerHealth([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    loadRealDeploymentQueueState()
      .then((state) => {
        if (!cancelled) {
          setQueue(state.queue);
          setWorkerHealth(state.workerHealth);
        }
      })
      .catch((nextError: unknown) => {
        if (!cancelled) {
          setQueue([]);
          setWorkerHealth([]);
          setError(nextError instanceof Error ? nextError.message : "Unable to load deployment queue state.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [overrideQueue]);

  return { queue, workerHealth, loading, error };
}

export async function enqueueRuntimeDeployment(ticket: Ticket) {
  return enqueueRealDeployment(ticket.id);
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
