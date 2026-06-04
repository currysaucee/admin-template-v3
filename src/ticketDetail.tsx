import React from "react";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import { InputTextarea } from "primereact/inputtextarea";
import { Dropdown } from "primereact/dropdown";
import { Card } from "primereact/card";
import { Dialog } from "primereact/dialog";

import type { DeploymentRunResult, PolicySetting, RemediationTemplate, Ticket, TicketStatus, ValidationRunResult } from "./types";
import { ticketStatusOptions } from "./types";
import { getDeploymentRunForTemplate, getStatusSeverity, resolveTemplateForDevice } from "./helpers";
import { ConfigSnapshotDownload, FindingDetailCard, ScriptValidationBlock } from "./remediationViews";
import { MetaTile, PageHeader } from "./sharedUi";

export function TicketDetailPage({ ticket, templates, policySettings, onBack, onEdit }: { ticket: Ticket; templates: RemediationTemplate[]; policySettings: PolicySetting[]; onBack: () => void; onEdit: (ticket: Ticket) => void }) {
  return (
    <section className="page-content">
      <div className="detail-header-row">
        <PageHeader title="Ticket Details" subtitle="Review ticket scope, planned window, and finding-level remediation evidence." />
        <div className="detail-actions">
          <Button label="Back to Dashboard" icon="pi pi-arrow-left" outlined onClick={onBack} />
          <Button label="Update Ticket" icon="pi pi-pencil" outlined onClick={() => onEdit(ticket)} />
        </div>
      </div>
      <Card className="device-detail-card">
        <div className="device-detail-top">
          <div>
            <h2 className="detail-title">{ticket.id}</h2>
            <p className="detail-subtitle">{ticket.crNumber} • Requested by {ticket.requestor}</p>
          </div>
          <Tag value={ticket.status} severity={getStatusSeverity(ticket.status) as any} rounded />
        </div>
        <div className="device-meta-grid">
          <MetaTile label="Requestor" value={ticket.requestor} />
          <MetaTile label="Role" value={ticket.requestorRole} />
          <MetaTile label="Start" value={ticket.plannedStart} />
          <MetaTile label="End" value={ticket.plannedEnd} />
        </div>
      </Card>
      <Card className="device-detail-card">
        <div className="reason-box"><span>Implementation Plan</span><p>{ticket.implementationPlan}</p></div>
        <div className="reason-box"><span>Reversion Plan</span><p>{ticket.backoutPlan}</p></div>
      </Card>
      <div className="finding-detail-list">
        {ticket.devices.map((device) => (
          <Card key={device.deviceId} className="finding-detail-card">
            <div className="finding-detail-header">
              <div><h3>{device.hostname}</h3><p>{device.role} • {device.hardwareType} • {device.managementIp}</p></div>
              <Tag value={`${device.findings.length} finding${device.findings.length === 1 ? "" : "s"}`} severity="info" rounded />
            </div>
            <div className="device-snapshot-row">
              <span>Device Config Snapshot</span>
              <ConfigSnapshotDownload path={device.configSnapshotPath} filename={device.configSnapshotFilename} />
            </div>
            {device.findings.map((finding) => {
              const template = resolveTemplateForDevice(device, finding, templates, policySettings);
              const policySetting = template?.policySettingId ? policySettings.find((setting) => setting.id === template.policySettingId) : undefined;
              const evidenceRun = getDeploymentRunForTemplate(ticket.deploymentRun, template);
              return <FindingDetailCard key={finding.id} finding={finding} template={template} policySetting={policySetting} showPolicyModel run={evidenceRun} defaultExpanded={Boolean(evidenceRun)} />;
            })}
          </Card>
        ))}
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

export function TicketEditDialog({ ticketDraft, setTicketDraft, onSave }: { ticketDraft: Ticket | null; setTicketDraft: (ticket: Ticket | null) => void; onSave: () => void }) {
  return (
    <Dialog visible={Boolean(ticketDraft)} onHide={() => setTicketDraft(null)} header={ticketDraft ? `Update ${ticketDraft.id}` : "Update Ticket"} style={{ width: "48rem" }} modal>
      {!ticketDraft ? null : (
        <div className="template-editor-stack">
          <div className="field-block"><label>Status</label><Dropdown value={ticketDraft.status} options={ticketStatusOptions} onChange={(e) => setTicketDraft({ ...ticketDraft, status: e.value as TicketStatus })} /></div>
          <div className="field-block"><label>Implementation Plan</label><InputTextarea value={ticketDraft.implementationPlan} onChange={(e) => setTicketDraft({ ...ticketDraft, implementationPlan: e.target.value })} rows={5} autoResize /></div>
          <div className="field-block"><label>Reversion Plan</label><InputTextarea value={ticketDraft.backoutPlan} onChange={(e) => setTicketDraft({ ...ticketDraft, backoutPlan: e.target.value })} rows={4} autoResize /></div>
          <Button label="Save Ticket Update" icon="pi pi-save" onClick={onSave} />
        </div>
      )}
    </Dialog>
  );
}





