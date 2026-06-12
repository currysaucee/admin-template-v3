export type Page = "dashboard" | "inventory" | "deviceDetail" | "ticketDetail" | "createTicket" | "templates" | "templateRequests";
export type UserRole = "Network Engineer" | "Approver" | "Change Manager";
export type ComplianceStatus = "Compliant" | "Non-Compliant" | "Scan Pending";
export type TicketStatus = "Pending Approval" | "Approved" | "Released" | "In Progress" | "Complete" | "Partially Complete" | "Rejected" | "Cancelled";
export type TemplateApprovalStatus = "Pending Approval" | "Approved" | "Rejected";

export type Finding = {
  id: string;
  templateKey: string;
  title: string;
  standard: string;
  reason: string;
  currentValue: string;
  expectedValue: string;
  detectedAt: string;
};

export type Device = {
  id: string;
  hostname: string;
  role: string;
  hardwareType: string;
  managementIp: string;
  configSnapshotPath?: string;
  configSnapshotFilename?: string;
  site: string;
  lastScanned: string;
  complianceStatus: ComplianceStatus;
  findings: Finding[];
};

export type AutomationValidation = {
  scriptName: string;
  command: string;
  expectedCondition: string;
  passCriteria: string;
  capturedResult: string;
};

export type RemediationTemplate = {
  hardwareTypes: string[];
  key: string;
  policySettingId?: string;
  findingName: string;
  agreedSetting: string;
  standard: string;
  preChecks: AutomationValidation[];
  implementationCommands: string[];
  postChecks: AutomationValidation[];
  failureBehaviour: string;
  approvalStatus: TemplateApprovalStatus;
  updatedAt: string;
};

export type PolicySetting = {
  id: string;
  settingNumber: string;
  title: string;
  settingPayload: string;
  standard: string;
  description: string;
  createdAt: string;
};

export type TemplateRequest = {
  id: string;
  templateKey: string;
  findingName: string;
  hardwareType: string;
  policySettingTitle: string;
  requestor: string;
  submitterComment: string;
  status: TemplateApprovalStatus;
  submittedAt: string;
  reviewer?: string;
  reviewNote?: string;
};

export type TicketDevice = {
  deviceId: string;
  hostname: string;
  role: string;
  hardwareType: string;
  managementIp: string;
  configSnapshotPath?: string;
  configSnapshotFilename?: string;
  findings: Finding[];
  deploymentRun?: DeploymentRunResult;
};

export type ValidationRunResult = {
  scriptName: string;
  phase: "Pre-check" | "Post-check";
  command: string;
  expectedCondition: string;
  passCriteria: string;
  capturedOutput: string;
  result: "Passed" | "Failed" | "Skipped";
  analysedAt: string;
};

export type DeploymentRunResult = {
  runId: string;
  status: "Successful" | "Failed" | "Not Started";
  failureStage?: "Pre-check" | "Implementation" | "Post-check";
  failureReason?: string;
  preChecks: ValidationRunResult[];
  implementationCommands: Array<{ command: string; status: "Executed" | "Skipped" }>;
  postChecks: ValidationRunResult[];
};

export type Ticket = {
  id: string;
  crNumber: string;
  requestor: string;
  requestorRole: UserRole;
  devices: TicketDevice[];
  plannedStart: string;
  plannedEnd: string;
  status: TicketStatus;
  implementationPlan: string;
  backoutPlan: string;
  createdAt: string;
  deploymentRun?: DeploymentRunResult;
};


export const roleOptions: UserRole[] = ["Network Engineer", "Approver", "Change Manager"];
export const ticketStatusOptions: TicketStatus[] = ["Pending Approval", "Approved", "Released", "In Progress", "Complete", "Partially Complete", "Rejected", "Cancelled"];
export const pageValues: Page[] = ["dashboard", "inventory", "deviceDetail", "ticketDetail", "createTicket", "templates", "templateRequests"];





