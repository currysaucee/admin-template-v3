import type { AutomationValidation, DeploymentRunResult, Device, Finding, ComplianceStatus, PolicySetting, RemediationTemplate, TicketDevice, TicketStatus, ValidationRunResult } from "./types";

export function getStatusSeverity(status: TicketStatus | ComplianceStatus) {
  switch (status) {
    case "Compliant":
    case "Approved":
    case "Complete":
      return "success";
    case "Non-Compliant":
    case "Rejected":
      return "danger";
    case "Pending Approval":
    case "Scan Pending":
    case "Partially Complete":
      return "warning";
    case "Released":
    case "In Progress":
      return "info";
    case "Cancelled":
      return "secondary";
    default:
      return "info";
  }
}

export function formatDate(date: Date | null) {
  if (!date) return "Not selected";
  return date.toLocaleString("en-SG", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
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

export function getTemplatePolicySetting(template: RemediationTemplate | undefined, policySettings: PolicySetting[] = []) {
  if (!template?.policySettingId) return undefined;
  return policySettings.find((setting) => setting.id === template.policySettingId);
}

export function getTemplateAgreedSetting(template: RemediationTemplate | undefined, policySettings: PolicySetting[] = []) {
  if (!template) return "";
  return getTemplatePolicySetting(template, policySettings)?.settingPayload ?? template.agreedSetting;
}

export function resolveTemplateForDevice(device: { hardwareType: string }, finding: Finding, templates: RemediationTemplate[], policySettings: PolicySetting[] = []) {
  const findingAgreedSettingHash = hashAgreedSetting(finding.expectedValue);
  return templates.find((template) => template.hardwareTypes.includes(device.hardwareType) && hashAgreedSetting(getTemplateAgreedSetting(template, policySettings)) === findingAgreedSettingHash);
}

export function isExecutableTemplate(template?: RemediationTemplate) {
  if (!template) return false;
  return template.approvalStatus === "Approved" && template.implementationCommands.length > 0 && template.implementationCommands.every((command) => command.trim().length > 0 && !/unknown|not configured|<[^>]+>/i.test(command));
}

export function hasConfigSnapshot(device: { configSnapshotPath?: string; configSnapshotFilename?: string }) {
  return Boolean(device.configSnapshotPath?.trim() || device.configSnapshotFilename?.trim());
}

export function getTemplateAvailability(device: { hardwareType: string }, finding: Finding, templates: RemediationTemplate[], policySettings: PolicySetting[] = []) {
  const findingHash = hashAgreedSetting(finding.expectedValue);
  const hashMatches = templates.filter((template) => hashAgreedSetting(getTemplateAgreedSetting(template, policySettings)) === findingHash);
  const hardwareMatches = hashMatches.filter((template) => template.hardwareTypes.includes(device.hardwareType));
  const template = hardwareMatches[0];
  const executable = isExecutableTemplate(template);

  if (template && executable) {
    return { template, executable, label: "1 fix available", severity: "success" as const, note: template.findingName };
  }
  if (template) {
    return { template, executable, label: "0 fixes available", severity: "warning" as const, note: "Template matched, but implementation commands are empty or not executable." };
  }
  if (hashMatches.length > 0) {
    const hardwareTypes = Array.from(new Set(hashMatches.flatMap((template) => template.hardwareTypes))).join(", ");
    return { template: undefined, executable: false, label: "0 fixes available", severity: "secondary" as const, note: `Agreed setting matches a template, but hardware type is ${hardwareTypes || "not set"} instead of ${device.hardwareType}.` };
  }
  return { template: undefined, executable: false, label: "0 fixes available", severity: "secondary" as const, note: "No template has the same agreed-setting payload." };
}

export function getFixAvailability(device: { hardwareType: string; configSnapshotPath?: string }, finding: Finding, templates: RemediationTemplate[], policySettings: PolicySetting[] = []) {
  const availability = getTemplateAvailability(device, finding, templates, policySettings);

  if (availability.executable && !hasConfigSnapshot(device)) {
    return { ...availability, executable: false, severity: "warning" as const, note: "Fix template is available, but device config snapshot is required before a remediation ticket can be created." };
  }

  return availability;
}

export function hasExecutableFix(device: { hardwareType: string; configSnapshotPath?: string }, finding: Finding, templates: RemediationTemplate[], policySettings: PolicySetting[] = []) {
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

export function getPassConditions(check: Pick<AutomationValidation, "expectedCondition" | "passCriteria">) {
  const merged = [check.expectedCondition, check.passCriteria].filter(Boolean).join("\n");
  return Array.from(new Set(splitDisplayLines(merged)));
}

export function splitCapturedOutputs(value: string, commandCount: number) {
  const parts = value.split(/\r?\n---\r?\n|\\n---\\n/).map((part) => part.trim());
  if (parts.length > 1) return parts;
  if (commandCount <= 1) return [value.trim()];
  return [value.trim(), ...Array.from({ length: commandCount - 1 }, () => "No separate output captured.")];
}

export function findRunResultsForTemplate(rows: ValidationRunResult[], templateRows: AutomationValidation[]) {
  return templateRows.map((templateRow) => rows.find((row) => row.scriptName === templateRow.scriptName || row.command === templateRow.command));
}

export function getDeploymentRunForTemplate(run: DeploymentRunResult | undefined, template: RemediationTemplate | undefined) {
  if (!run || !template) return undefined;
  const templateScripts = new Set([...template.preChecks, ...template.postChecks].map((check) => check.scriptName));
  const templateCommands = new Set(template.implementationCommands.map((command) => command.trim()).filter(Boolean));
  const hasMatchingValidation = [...run.preChecks, ...run.postChecks].some((row) => templateScripts.has(row.scriptName));
  const hasMatchingImplementation = run.implementationCommands.some((row) => templateCommands.has(row.command.trim()));
  const hasMatchingEvidence = hasMatchingValidation || hasMatchingImplementation;
  return hasMatchingEvidence ? run : undefined;
}

export function escapeTemplateCell(value: string) {
  return value.replace(/\r?\n/g, "\\n");
}

export function unescapeTemplateCell(value: string) {
  return value.replace(/\\n/g, "\n");
}

export function validationToText(check: AutomationValidation) {
  return [check.scriptName, check.command, getPassConditions(check).join("\\n"), check.capturedResult].map(escapeTemplateCell).join(" :: ");
}

export function textToValidation(line: string): AutomationValidation {
  const isStructured = line.includes(" :: ");
  const parts = isStructured ? line.split(" :: ") : line.split("|");
  const [scriptName = "unnamed-script", command = "", expectedCondition = "", passCriteria = "", capturedResult = "Captured automatically during deployment run."] = parts.map((part) => unescapeTemplateCell(part.trim()));
  const combinedCriteria = isStructured ? expectedCondition : [expectedCondition, passCriteria].filter(Boolean).join("\n");
  return {
    scriptName: scriptName || "unnamed-script",
    command: command || "Command not specified",
    expectedCondition: combinedCriteria || "Pass condition not specified",
    passCriteria: "",
    capturedResult: (isStructured ? passCriteria : capturedResult) || "Captured automatically during deployment run.",
  };
}

export function validationsToText(checks: AutomationValidation[]) {
  return checks.map(validationToText).join("\n");
}

export function textToValidations(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map(textToValidation);
}

export function commandsToText(commands: string[]) {
  return commands.join("\n");
}

export function textToCommands(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}






