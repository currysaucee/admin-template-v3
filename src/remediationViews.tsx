import React, { useState } from "react";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import { Card } from "primereact/card";

import type { DeploymentRunResult, Finding, FindingExecutionResult, PolicySetting, RemediationTemplate, TicketDevice } from "./types";
import { getTemplateCommandCount, getTemplateDisplayName, resolveTemplateForDevice } from "./helpers";
import { normalizeConfigSnapshotPath, resolveRealApiUrl } from "./dataMode";

export function ConfigSnapshotDownload({ path, filename }: { path?: string; filename?: string }) {
  const resolvedPath = normalizeConfigSnapshotPath(path || (filename ? `/config-snapshots/${filename}` : ""));
  if (!resolvedPath) return <span className="config-download-empty">No device config snapshot available.</span>;
  const downloadSnapshot = async () => {
    const downloadUrl = resolveRealApiUrl(resolvedPath);
    const response = await fetch(downloadUrl);
    if (!response.ok) throw new Error(`Unable to download config snapshot from ${downloadUrl}`);
    const snapshotText = await response.text();
    const blob = new Blob([snapshotText], { type: "text/plain;charset=utf-8" });
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename?.toLowerCase().endsWith(".txt") ? filename : `${filename || "device-config-snapshot"}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(objectUrl);
  };
  return <Button className="config-download-button" label="Download Config Snapshot" icon="pi pi-download" size="small" outlined onClick={downloadSnapshot} />;
}

export function FindingDetailCard({ finding, template, run, executionResult, defaultExpanded = false, implementationOnly = false, policySetting, policySupported = true, showPolicyModel = false, skipRemediationReason }: { finding: Finding; template?: RemediationTemplate; run?: DeploymentRunResult; executionResult?: FindingExecutionResult; defaultExpanded?: boolean; implementationOnly?: boolean; policySetting?: PolicySetting; policySupported?: boolean; showPolicyModel?: boolean; skipRemediationReason?: string }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const executionStatus = executionResult ? displayExecutionStatus(executionResult.status) : "";
  const executionFailed = executionStatus === "Validation Failed";
  const isSkippedByLatestScan = Boolean(skipRemediationReason);
  return (
    <Card className="finding-detail-card">
      <div className="finding-detail-header">
        <div><div className="finding-title-row"><Tag className={`policy-id-tag ${policySupported ? "" : "unsupported-policy-tag"}`} value={finding.id} severity={policySupported ? "info" : "secondary"} rounded />{!policySupported && <Tag value="Unsupported" severity="secondary" rounded />}<h3>{finding.title}</h3></div><p>{finding.detectedAt}</p></div>
        <div className="action-row">{isSkippedByLatestScan && <Tag value="Skipped by latest scan" severity="warning" rounded />}{!isSkippedByLatestScan && executionResult && <Tag value={executionStatus} severity={executionStatus === "Executed Successfully" ? "success" : executionFailed ? "danger" : "secondary"} rounded />}{!isSkippedByLatestScan && !executionResult && run && <Tag value={run.status} severity={run.status === "Successful" ? "success" : "danger"} rounded />}<Tag value={`${getTemplateCommandCount(template)} total steps`} severity="info" rounded /><Button label={expanded ? "Collapse" : "Expand"} icon={expanded ? "pi pi-chevron-up" : "pi pi-chevron-down"} size="small" outlined onClick={() => setExpanded((prev) => !prev)} /></div>
      </div>
      {expanded && <>
      {isSkippedByLatestScan && <div className="latest-scan-skip-box"><i className="pi pi-info-circle" /><div><strong>Execution will skip this finding</strong><p>{skipRemediationReason}</p></div></div>}
      <TemplateExecutionPreview template={template} run={run} mode={implementationOnly ? "implementation" : "full"} policySetting={policySetting} showPolicyModel={showPolicyModel} />
      {executionResult?.message && <div className={`finding-result-note ${executionFailed ? "failed" : ""}`}>{executionResult.message}</div>}
      </>}
    </Card>
  );
}

function displayExecutionStatus(status: FindingExecutionResult["status"]) {
  return status;
}

function displayFailureStage(stage?: string) {
  if (!stage) return "Deployment";
  return stage;
}

export function DeviceFixGroup({ device, templates, policySettings = [], defaultExpanded = false, showFailureBehaviour = false, showPolicyModel = false, implementationOnly = false, showSnapshot = true }: { device: TicketDevice; templates: RemediationTemplate[]; policySettings?: PolicySetting[]; defaultExpanded?: boolean; showFailureBehaviour?: boolean; showPolicyModel?: boolean; implementationOnly?: boolean; showSnapshot?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <div className="nested-card collapsible-device-card">
      <button className="collapsible-header device-collapse-header" type="button" onClick={() => setExpanded((prev) => !prev)} aria-expanded={expanded}>
        <div>
          <h3>{device.hostname}</h3>
          <p>{device.role} • {device.hardwareType} • {device.managementIp}</p>
        </div>
        <div className="collapse-meta">
          <i className={expanded ? "pi pi-chevron-up" : "pi pi-chevron-down"} />
        </div>
      </button>
      {expanded && (
        <div className="device-fix-stack">
          {showSnapshot && <div className="device-snapshot-row">
            <span>Device Config Snapshot</span>
            <ConfigSnapshotDownload path={device.configSnapshotPath} filename={device.configSnapshotFilename} />
          </div>}
          {device.findings.map((finding, index) => {
            const template = resolveTemplateForDevice(device, finding, templates, policySettings);
            return <FindingFixAccordion key={finding.id} finding={finding} template={template} policySetting={template?.policySettingId ? policySettings.find((setting) => setting.id === template.policySettingId) : undefined} defaultExpanded={index === 0} showFailureBehaviour={showFailureBehaviour} showPolicyModel={showPolicyModel} implementationOnly={implementationOnly} />;
          })}
        </div>
      )}
    </div>
  );
}

function FindingFixAccordion({ finding, template, policySetting, defaultExpanded = false, showFailureBehaviour = false, showPolicyModel = false, implementationOnly = false }: { finding: Finding; template?: RemediationTemplate; policySetting?: PolicySetting; defaultExpanded?: boolean; showFailureBehaviour?: boolean; showPolicyModel?: boolean; implementationOnly?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <div className="command-block">
      <button className="collapsible-header command-header" type="button" onClick={() => setExpanded((prev) => !prev)} aria-expanded={expanded}>
        <div>
          <div className="finding-title-row"><Tag className="policy-id-tag" value={finding.id} severity="info" rounded /><strong>{finding.title}</strong></div>
          <span>{template ? `${getTemplateDisplayName(template)} - updated ${template.updatedAt}` : "No template configured yet"}</span>
        </div>
        <div className="collapse-meta">
          <i className={expanded ? "pi pi-chevron-up" : "pi pi-chevron-down"} />
        </div>
      </button>
      {expanded && <TemplateExecutionPreview template={template} policySetting={policySetting} showPolicyModel={showPolicyModel} showFailureBehaviour={showFailureBehaviour} mode={implementationOnly ? "implementation" : "full"} />}
    </div>
  );
}

export function TemplateExecutionPreview({ template, run, showFailureBehaviour = false, mode = "full", policySetting, showPolicyModel = false }: { template?: RemediationTemplate; run?: DeploymentRunResult; showFailureBehaviour?: boolean; mode?: "full" | "implementation"; policySetting?: PolicySetting; showPolicyModel?: boolean }) {
  if (!template) return <div className="empty-pre"><strong>No approved fix template configured.</strong><span>Please contact the hardware SME to upload and approve a fix template in the portal before this finding can be remediated.</span></div>;
  return (
    <div className="execution-preview">
      {run && <div className="run-alert-inline"><strong>{run.status === "Successful" ? "Deployment completed" : `${displayFailureStage(run.failureStage)} failed`}</strong><p>{run.failureReason ?? `${run.runId} completed and evidence is shown against each command below.`}</p></div>}
      {showPolicyModel && <PolicyModelBlock setting={policySetting} fallbackPayload={template.agreedSetting} />}
      <CommandList phase="fix" title="Implementation Commands" badge={run ? (run.implementationCommands.some((item) => item.status === "Executed") ? "Executed" : "Skipped") : "Config push"} commands={template.implementationCommands} runCommands={run?.implementationCommands} />
      {showFailureBehaviour && <div className="failure-behaviour-box"><strong>Failure behaviour</strong><p>{template.failureBehaviour}</p></div>}
    </div>
  );
}

function PolicyModelBlock({ setting, fallbackPayload }: { setting?: PolicySetting; fallbackPayload: string }) {
  return (
    <div className="policy-model-block">
      <div>
        <span>Policy Setting model</span>
        <strong>{setting?.title ?? "Template-linked policy payload"}</strong>
      </div>
      <pre>{setting?.settingPayload || fallbackPayload || "No Policy Setting payload linked."}</pre>
    </div>
  );
}

function CommandList({ phase = "fix", title, badge, commands, runCommands }: { phase?: "fix"; title: string; badge: string; commands: string[]; runCommands?: DeploymentRunResult["implementationCommands"] }) {
  return (
    <div className={`execution-section phase-section phase-${phase}`}>
      <div className="execution-section-header"><strong>{title}</strong><Tag value={badge} severity="warning" /></div>
      <div className="command-list">{commands.map((command, index) => {
        const runCommand = runCommands?.[index];
        return <div key={`${command}-${index}`} className="command-line"><span>{index + 1}</span><code>{command}</code>{runCommand && <Tag value={runCommand.status} severity={runCommand.status === "Executed" ? "success" : "secondary"} />}</div>;
      })}</div>
    </div>
  );
}





