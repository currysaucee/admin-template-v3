import type { DeploymentRunResult, Device, Finding, ComplianceStatus, PolicySetting, RemediationTemplate, Ticket, TicketDevice, TicketStatus } from "./types";

export function getStatusSeverity(status: TicketStatus | ComplianceStatus) {
  switch (status) {
    case "Compliant":
    case "Approved":
    case "Complete":
    case "Partially Complete":
      return "success";
    case "Non-Compliant":
    case "Rejected":
      return "danger";
    case "Pending Approval":
    case "Scan Pending":
      return "warning";
    case "Queued":
    case "In Progress":
      return "info";
    case "Failed":
      return "danger";
    case "Cancelled":
    case "Skipped":
      return "secondary";
    default:
      return "info";
  }
}

export function formatDate(date: Date | null) {
  if (!date) return "Not selected";
  return date.toISOString();
}

export function formatDateTime(value?: string | Date | null) {
  if (!value) return "Not set";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function findFindingKey(deviceId: string, findingId: string) {
  return `${deviceId}:${findingId}`;
}

export function getTemplateCommandCount(template?: RemediationTemplate) {
  if (!template) return 0;
  return template.implementationCommands.length;
}

export function normalizeAgreedSetting(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/^agreed settings?\s*(?:\(policy\))?\s*:\s*/gim, "")
    .replace(/^standard \/ expected config\s*:\s*/gim, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function hashAgreedSetting(value: string) {
  const normalized = normalizeAgreedSetting(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function normalizePolicyReference(value?: string) {
  const text = (value ?? "").trim();
  const match = text.match(/^([A-Za-z]{1,8})[-_\s]?0*(\d{1,4})$/);
  if (match) return `${match[1].toUpperCase()}${Number(match[2]).toString().padStart(3, "0")}`;
  return text.toUpperCase();
}

function findingReferences(finding: Finding) {
  return [finding.id, finding.templateKey].map((value) => normalizePolicyReference(value)).filter(Boolean);
}

export function findPolicySettingForFinding(finding: Finding, policySettings: PolicySetting[] = []) {
  const findingRefs = new Set(findingReferences(finding));
  return policySettings.find((setting) => {
    const settingRefs = [setting.id, setting.settingNumber].map((value) => normalizePolicyReference(value)).filter(Boolean);
    return settingRefs.some((ref) => findingRefs.has(ref));
  });
}

export function getFindingDisplayTitle(finding: Finding, policySettings: PolicySetting[] = []) {
  const policySetting = findPolicySettingForFinding(finding, policySettings);
  const normalizedTitle = normalizePolicyReference(finding.title);
  const normalizedId = normalizePolicyReference(finding.id);
  if (policySetting?.title) return policySetting.title;
  if (!policySetting) return "Unsupported policy";
  if (finding.title && normalizedTitle !== normalizedId) return finding.title;
  return finding.description || finding.id;
}

export function isSupportedPolicyFinding(finding: Finding, policySettings: PolicySetting[] = []) {
  return Boolean(findPolicySettingForFinding(finding, policySettings));
}

export function isFindingNoLongerDetected(finding: Finding) {
  return finding.latestScanStatus === "No Longer Detected" || finding.latestScanStatus === "Device Not In Latest Scan";
}

export function reconcileTicketWithLatestScan(ticket: Ticket, latestDevices: Device[]) {
  return {
    ...ticket,
    devices: ticket.devices.map((ticketDevice) => {
      const latestDevice = latestDevices.find((device) => device.id === ticketDevice.deviceId || device.hostname === ticketDevice.hostname);
      const latestFindingRefs = new Set(latestDevice?.findings.flatMap(findingReferences) ?? []);
      return {
        ...ticketDevice,
        configSnapshotPath: latestDevice?.configSnapshotPath ?? ticketDevice.configSnapshotPath,
        configSnapshotFilename: latestDevice?.configSnapshotFilename ?? ticketDevice.configSnapshotFilename,
        findings: ticketDevice.findings.map((finding) => {
          const stillDetected = Boolean(latestDevice && findingReferences(finding).some((ref) => latestFindingRefs.has(ref)));
          if (stillDetected) {
            return {
              ...finding,
              latestScanStatus: "Still Detected" as const,
              latestScanNote: "This finding is still present in the latest scan and remains in scope for remediation.",
            };
          }
          if (!latestDevice) {
            return {
              ...finding,
              latestScanStatus: "Device Not In Latest Scan" as const,
              latestScanNote: "This device is not present in the latest non-compliance scan. Treat this finding as skipped unless a fresh scan confirms it again.",
            };
          }
          return {
            ...finding,
            latestScanStatus: "No Longer Detected" as const,
            latestScanNote: "This finding is no longer present in the latest scan. Automation should skip this policy and leave the device untouched for this item.",
          };
        }),
      };
    }),
  };
}

export function getTicketReconciliationSummary(ticket: Ticket) {
  const findings = ticket.devices.flatMap((device) => device.findings);
  const skipped = findings.filter(isFindingNoLongerDetected).length;
  const stillDetected = findings.filter((finding) => finding.latestScanStatus === "Still Detected").length;
  return {
    total: findings.length,
    skipped,
    stillDetected,
    hasChangedScope: skipped > 0,
    allResolved: findings.length > 0 && skipped === findings.length,
  };
}

export function getTemplatePolicySetting(template: RemediationTemplate | undefined, policySettings: PolicySetting[] = []) {
  if (!template?.policySettingId) return undefined;
  return policySettings.find((setting) => setting.id === template.policySettingId);
}

export function getTemplateAgreedSetting(template: RemediationTemplate | undefined, policySettings: PolicySetting[] = []) {
  if (!template) return "";
  return getTemplatePolicySetting(template, policySettings)?.settingPayload ?? template.agreedSetting;
}

export function templateMatchesFindingPolicy(template: RemediationTemplate, finding: Finding, policySettings: PolicySetting[] = []) {
  const setting = getTemplatePolicySetting(template, policySettings);
  const findingRefs = new Set([normalizePolicyReference(finding.id), normalizePolicyReference(finding.templateKey)].filter(Boolean));
  const templateRefs = [
    template.key,
    template.policySettingId,
    setting?.id,
    setting?.settingNumber,
  ].map((value) => normalizePolicyReference(value)).filter(Boolean);

  return templateRefs.some((ref) => findingRefs.has(ref));
}

export function resolveTemplateForDevice(device: { hardwareType: string }, finding: Finding, templates: RemediationTemplate[], policySettings: PolicySetting[] = []) {
  const hardwareMatches = templates.filter((template) => template.hardwareTypes.includes(device.hardwareType));
  return hardwareMatches.find((template) => templateMatchesFindingPolicy(template, finding, policySettings));
}

export function isExecutableTemplate(template?: RemediationTemplate) {
  if (!template) return false;
  return template.approvalStatus === "Approved" && template.implementationCommands.length > 0 && template.implementationCommands.every((command) => command.trim().length > 0 && !/unknown|not configured|<[^>]+>/i.test(command));
}

export function hasConfigSnapshot(device: { configSnapshotPath?: string; configSnapshotFilename?: string; findings?: Array<{ currentValue?: string }> }) {
  return Boolean(
    device.configSnapshotPath?.trim()
    || device.configSnapshotFilename?.trim()
    || device.findings?.some((finding) => finding.currentValue?.trim())
  );
}

export function getTemplateAvailability(device: { hardwareType: string }, finding: Finding, templates: RemediationTemplate[], policySettings: PolicySetting[] = []) {
  const policyMatches = templates.filter((template) => templateMatchesFindingPolicy(template, finding, policySettings));
  const policyHardwareMatches = policyMatches.filter((template) => template.hardwareTypes.includes(device.hardwareType));
  const template = policyHardwareMatches[0];
  const executable = isExecutableTemplate(template);

  if (template && executable) {
    return { template, executable, label: "1 fix available", severity: "success" as const, note: template.findingName };
  }
  if (template) {
    return { template, executable, label: "0 fixes available", severity: "warning" as const, note: "Template matched, but implementation commands are empty or not executable." };
  }
  if (policyMatches.length > 0) {
    const hardwareTypes = Array.from(new Set(policyMatches.flatMap((template) => template.hardwareTypes))).join(", ");
    return { template: undefined, executable: false, label: "0 fixes available", severity: "secondary" as const, note: `Policy ID matches a template, but hardware type is ${hardwareTypes || "not set"} instead of ${device.hardwareType}.` };
  }
  return { template: undefined, executable: false, label: "0 fixes available", severity: "secondary" as const, note: "No approved template is linked to this policy ID." };
}

export function getFixAvailability(device: { hardwareType: string; configSnapshotPath?: string; configSnapshotFilename?: string; findings?: Array<{ currentValue?: string }> }, finding: Finding, templates: RemediationTemplate[], policySettings: PolicySetting[] = []) {
  const availability = getTemplateAvailability(device, finding, templates, policySettings);

  if (availability.executable && !hasConfigSnapshot(device)) {
    return { ...availability, executable: false, severity: "warning" as const, note: "Fix template is available, but device config snapshot is required before a remediation request can be created." };
  }

  return availability;
}

export function hasExecutableFix(device: { hardwareType: string; configSnapshotPath?: string; configSnapshotFilename?: string; findings?: Array<{ currentValue?: string }> }, finding: Finding, templates: RemediationTemplate[], policySettings: PolicySetting[] = []) {
  return getFixAvailability(device, finding, templates, policySettings).executable;
}

export function getExecutableFindings(device: Device, templates: RemediationTemplate[], policySettings: PolicySetting[] = []) {
  return device.findings.filter((finding) => hasExecutableFix(device, finding, templates, policySettings));
}

export function getAvailableFixCount(device: Device, templates: RemediationTemplate[], policySettings: PolicySetting[] = []) {
  return getExecutableFindings(device, templates, policySettings).length;
}

export function getTemplateDisplayName(template?: RemediationTemplate) {
  if (!template) return "Unknown Template";
  return template.hardwareTypes.join(", ");
}

export function splitDisplayLines(value: string) {
  return value.split(/\r?\n|\\n/).map((line) => line.trim()).filter(Boolean);
}

export function splitCapturedOutputs(value: string, commandCount: number) {
  const parts = value.split(/\r?\n---\r?\n|\\n---\\n/).map((part) => part.trim());
  if (parts.length > 1) return parts;
  if (commandCount <= 1) return [value.trim()];
  return [value.trim(), ...Array.from({ length: commandCount - 1 }, () => "No separate output captured.")];
}

export function getDeploymentRunForTemplate(run: DeploymentRunResult | undefined, template: RemediationTemplate | undefined) {
  if (!run || !template) return undefined;
  const templateCommands = new Set(template.implementationCommands.map((command) => command.trim()).filter(Boolean));
  const hasMatchingImplementation = run.implementationCommands.some((row) => templateCommands.has(row.command.trim()));
  return hasMatchingImplementation ? run : undefined;
}

export function escapeTemplateCell(value: string) {
  return value.replace(/\r?\n/g, "\\n");
}

export function unescapeTemplateCell(value: string) {
  return value.replace(/\\n/g, "\n");
}

export function commandsToText(commands: string[]) {
  return commands.join("\n");
}

export function textToCommands(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}






