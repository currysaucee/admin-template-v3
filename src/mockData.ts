import type { Device, PolicySetting, RemediationTemplate, TemplateRequest, Ticket } from "./types";

// Active seed file for the UI shell. Keep committed data empty; use ignored
// local-mock-data files or backend/API wiring for demos and real payloads.
export const initialDevices: Device[] = [];

export const initialPolicySettings: PolicySetting[] = [];

export const policySourcePayload = {
  source: "",
  settings: [],
};

export const initialTemplates: RemediationTemplate[] = [];

export const initialTemplateRequests: TemplateRequest[] = [];

export const initialTickets: Ticket[] = [];
