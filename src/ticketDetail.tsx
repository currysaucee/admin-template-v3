import React from "react";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import { Card } from "primereact/card";

import type { DeploymentRunResult, PolicySetting, RemediationTemplate, Ticket, TicketStatus, ValidationRunResult } from "./types";
import { getDeploymentRunForTemplate, getStatusSeverity, resolveTemplateForDevice } from "./helpers";
import { ConfigSnapshotDownload, FindingDetailCard, ScriptValidationBlock } from "./remediationViews";
import { MetaTile, PageHeader, TicketActions } from "./sharedUi";

export function TicketDetailPage({ ticket, templates, policySettings, onBack, onStatusChange }: { ticket: Ticket; templates: RemediationTemplate[]; policySettings: PolicySetting[]; onBack: () => void; onStatusChange: (id: string, status: TicketStatus) => void }) {
  const completedDevices = ticket.devices.filter((device) => device.deploymentRun?.status === "Successful").length;
  const failedDevices = ticket.devices.filter((device) => device.deploymentRun?.status === "Failed").length;
  const pendingDevices = ticket.devices.length - completedDevices - failedDevices;
  const hasDeviceResults = completedDevices > 0 || failedDevices > 0;

  return (
    <section className="page-content">
      <div className="detail-header-row">
        <PageHeader title="Ticket Details" subtitle="Review ticket scope, planned window, and finding-level remediation evidence." />
        <div className="detail-actions">
          <Button label="Back to Dashboard" icon="pi pi-arrow-left" outlined onClick={onBack} />
          <TicketActions ticket={ticket} showView={false} onStatusChange={onStatusChange} />
        </div>
      </div>
      <Card className="device-detail-card">
        <div className="device-detail-top">
          <div>
            <h2 className="detail-title">{ticket.id}</h2>
            <p className="detail-subtitle">{ticket.crNumber} • Requested by {ticket.requestor}</p>
          </div>
          <Tag className={ticket.status === "Partially Complete" ? "partial-complete-status" : undefined} value={ticket.status} severity={getStatusSeverity(ticket.status) as any} rounded />
        </div>
        <div className="device-meta-grid">
          <MetaTile label="Requestor" value={ticket.requestor} />
          <MetaTile label="Role" value={ticket.requestorRole} />
          <MetaTile label="Start" value={ticket.plannedStart} />
          <MetaTile label="End" value={ticket.plannedEnd} />
        </div>
        {hasDeviceResults && <div className="device-meta-grid ticket-result-summary">
          <MetaTile label="Successful Devices" value={String(completedDevices)} />
          <MetaTile label="Failed Devices" value={String(failedDevices)} />
          <MetaTile label="Not Completed" value={String(pendingDevices)} />
        </div>}
      </Card>
      <Card className="device-detail-card">
        <div className="reason-box"><span>Implementation Plan</span><p>{ticket.implementationPlan}</p></div>
        <div className="reason-box"><span>Reversion Plan</span><p>{ticket.backoutPlan}</p></div>
      </Card>
      <div className="finding-detail-list">
        {ticket.devices.map((device) => {
          const requiresReversion = device.deploymentRun?.status === "Failed" || device.deploymentRun?.findingResults?.some((result) => result.status === "Post-check Failed");
          return <Card key={device.deviceId} className="finding-detail-card">
            <div className="finding-detail-header">
              <div><h3>{device.hostname}</h3><p>{device.role} • {device.hardwareType} • {device.managementIp}</p></div>
              <div className="action-row">
                {device.deploymentRun && <Tag value={device.deploymentRun.status} severity={device.deploymentRun.status === "Successful" ? "success" : device.deploymentRun.status === "Failed" ? "danger" : "secondary"} rounded />}
                <Tag value={`${device.findings.length} finding${device.findings.length === 1 ? "" : "s"}`} severity="info" rounded />
              </div>
            </div>
            <div className="device-snapshot-row">
              <span>Device Config Snapshot</span>
              <ConfigSnapshotDownload path={device.configSnapshotPath} filename={device.configSnapshotFilename} />
            </div>
            {requiresReversion && <div className="device-reversion-warning"><i className="pi pi-exclamation-triangle" /><div><strong>Reversion required</strong><p>Notify the responsible engineer and execute the approved reversion plan for this device.</p></div></div>}
            {device.findings.map((finding) => {
              const template = resolveTemplateForDevice(device, finding, templates, policySettings);
              const policySetting = template?.policySettingId ? policySettings.find((setting) => setting.id === template.policySettingId) : undefined;
              const evidenceRun = getDeploymentRunForTemplate(device.deploymentRun ?? ticket.deploymentRun, template);
              const executionResult = device.deploymentRun?.findingResults?.find((result) => result.findingId === finding.id);
              return <FindingDetailCard key={finding.id} finding={finding} template={template} policySetting={policySetting} showPolicyModel run={evidenceRun} executionResult={executionResult} implementationOnly defaultExpanded={Boolean(evidenceRun || executionResult)} />;
            })}
          </Card>
        })}
      </div>
    </section>
  );
}

function DeploymentRunPanel({ run }: { run: DeploymentRunResult }) {
  return (
    <div className="deployment-run-panel">
      <div className="deployment-run-header">
        <div>
          <h3>Deployment Run Output</h3>
          <p>{run.runId}</p>
        </div>
        <Tag value={run.status} severity={run.status === "Successful" ? "success" : "danger"} rounded />
      </div>
      {run.failureReason && <div className="run-alert"><strong>{run.failureStage} failed</strong><p>{run.failureReason}</p></div>}
      <RunResultTable title="Pre-check Output" rows={run.preChecks} />
      <div className="execution-section">
        <div className="execution-section-header"><strong>Implementation Commands</strong><Tag value={run.implementationCommands.some((item) => item.status === "Executed") ? "Executed" : "Skipped"} severity={run.implementationCommands.some((item) => item.status === "Executed") ? "success" : "secondary"} /></div>
        <div className="command-list">{run.implementationCommands.map((item, index) => <div key={`${item.command}-${index}`} className="command-line"><span>{index + 1}</span><code>{item.command}</code><Tag value={item.status} severity={item.status === "Executed" ? "success" : "secondary"} /></div>)}</div>
      </div>
      <RunResultTable title="Post-check Output" rows={run.postChecks} />
    </div>
  );
}

function RunResultTable({ title, rows }: { title: string; rows: ValidationRunResult[] }) {
  return (
    <div className="execution-section">
      <div className="execution-section-header"><strong>{title}</strong><Tag value={`${rows.length} script${rows.length === 1 ? "" : "s"}`} severity="info" /></div>
      <div className="script-check-list">
        {rows.map((row, index) => (
          <div key={`${row.phase}-${row.scriptName}`} className="script-check-block">
            <ScriptValidationBlock check={row} index={index} result={row.result} />
            <div className="captured-output-panel">
              <div className="numbered-line-title">Captured Output</div>
              <code>{row.capturedOutput || "<empty output>"}</code>
              <small>{row.analysedAt}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}





