export type Page = "dashboard" | "inventory" | "deviceDetail" | "ticketDetail" | "createTicket" | "deploymentQueue" | "templates" | "templateRequests" | "developerConsole";
export type UserRole = "Network Engineer" | "Approver" | "Change Manager";
export type ComplianceStatus = "Compliant" | "Non-Compliant" | "Scan Pending";
export type TicketStatus = "Pending Approval" | "Approved" | "Queued" | "In Progress" | "Complete" | "Partially Complete" | "Skipped" | "Failed" | "Rejected" | "Cancelled";
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
  latestScanStatus?: "Still Detected" | "No Longer Detected" | "Device Not In Latest Scan";
  latestScanNote?: string;
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

export type RemediationTemplate = {
  hardwareTypes: string[];
  key: string;
  policySettingId?: string;
  findingName: string;
  agreedSetting: string;
  standard: string;
  implementationCommands: string[];
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
  updatedAt?: string;
  updatedBy?: string;
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

export type FindingExecutionStatus = "Executed Successfully" | "Skipped" | "Validation Failed";

export type FindingExecutionResult = {
  findingId: string;
  status: FindingExecutionStatus;
  message?: string;
};

export type DeploymentRunResult = {
  runId: string;
  status: "Successful" | "Failed" | "Not Started";
  failureStage?: "Validation" | "Implementation";
  failureReason?: string;
  implementationCommands: Array<{ command: string; status: "Executed" | "Skipped" }>;
  findingResults?: FindingExecutionResult[];
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

export type DeploymentQueueItem = {
  queueId: string;
  ticketId: string;
  status: "Queued" | "Processing" | "Complete" | "Skipped" | "Failed" | string;
  priority: number;
  queuedBy?: string;
  deviceCount?: number;
  policyCount?: number;
  queuedAt: string;
  availableAt: string;
  lockedAt?: string;
  lockedBy?: string;
  startedAt?: string;
  completedAt?: string;
  attemptCount: number;
  lastError?: string;
  ticket?: Ticket;
  executionPlan?: DeploymentExecutionPlan;
  result?: unknown;
};

export type DeploymentWorkerHealth = {
  workerId: string;
  status: string;
  lastSeenAt: string;
  detail?: string;
  processedCount?: number;
  lastQueueId?: string;
};

export type DeploymentExecutionPlan = {
  ticketId?: string;
  devices: Array<{
    hostname?: string;
    managementIp?: string;
    hardwareType?: string;
    findings: Array<{
      policyId: string;
      title?: string;
      status: "Pending Execution" | "Skipped" | string;
      reason?: string;
      implementationCommands?: string[];
    }>;
  }>;
};


export const roleOptions: UserRole[] = ["Network Engineer", "Approver", "Change Manager"];
export const ticketStatusOptions: TicketStatus[] = ["Pending Approval", "Approved", "Queued", "In Progress", "Complete", "Partially Complete", "Skipped", "Failed", "Rejected", "Cancelled"];
export const pageValues: Page[] = ["dashboard", "inventory", "deviceDetail", "ticketDetail", "createTicket", "deploymentQueue", "templates", "templateRequests", "developerConsole"];





