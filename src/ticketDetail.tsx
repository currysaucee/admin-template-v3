import React from "react";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import { Card } from "primereact/card";

import type { PolicySetting, RemediationTemplate, Ticket, TicketStatus } from "./types";
import { getDeploymentRunForTemplate, getStatusSeverity, getTicketReconciliationSummary, isFindingNoLongerDetected, resolveTemplateForDevice } from "./helpers";
import { ConfigSnapshotDownload, FindingDetailCard } from "./remediationViews";
import { MetaTile, PageHeader, TicketActions } from "./sharedUi";

export function TicketDetailPage({ ticket, templates, policySettings, onBack, onStatusChange }: { ticket: Ticket; templates: RemediationTemplate[]; policySettings: PolicySetting[]; onBack: () => void; onStatusChange: (id: string, status: TicketStatus) => void }) {
  const completedDevices = ticket.devices.filter((device) => device.deploymentRun?.status === "Successful").length;
  const failedDevices = ticket.devices.filter((device) => device.deploymentRun?.status === "Failed").length;
  const pendingDevices = ticket.devices.length - completedDevices - failedDevices;
  const hasDeviceResults = completedDevices > 0 || failedDevices > 0;
  const reconciliation = getTicketReconciliationSummary(ticket);

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
          <MetaTile label="Implementation Date" value={ticket.plannedStart || "Not selected"} />
        </div>
        {hasDeviceResults && <div className="device-meta-grid ticket-result-summary">
          <MetaTile label="Successful Devices" value={String(completedDevices)} />
          <MetaTile label="Failed Devices" value={String(failedDevices)} />
          <MetaTile label="Not Completed" value={String(pendingDevices)} />
        </div>}
        {reconciliation.hasChangedScope && <div className={`latest-scan-reconcile-box ${reconciliation.allResolved ? "all-resolved" : ""}`}><i className="pi pi-info-circle" /><div><strong>{reconciliation.allResolved ? "Ticket no longer has active findings in the latest scan" : "Ticket scope changed after the latest scan"}</strong><p>{reconciliation.allResolved ? "All findings in this ticket are no longer detected. The remediation should not push configuration unless a new scan reopens the findings." : `${reconciliation.skipped} of ${reconciliation.total} finding${reconciliation.total === 1 ? "" : "s"} will be skipped because the latest scan no longer detects them. Remaining active findings can still proceed.`}</p></div></div>}
      </Card>
      <div className="finding-detail-list">
        {ticket.devices.map((device) => {
          const requiresReversion = device.deploymentRun?.status === "Failed" || device.deploymentRun?.findingResults?.some((result) => result.status === "Validation Failed");
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
              const noLongerDetected = isFindingNoLongerDetected(finding);
              const template = resolveTemplateForDevice(device, finding, templates, policySettings);
              const policySetting = template?.policySettingId ? policySettings.find((setting) => setting.id === template.policySettingId) : undefined;
              const evidenceRun = getDeploymentRunForTemplate(device.deploymentRun ?? ticket.deploymentRun, template);
              const executionResult = device.deploymentRun?.findingResults?.find((result) => result.findingId === finding.id);
              return <FindingDetailCard key={finding.id} finding={finding} template={template} policySetting={policySetting} run={noLongerDetected ? undefined : evidenceRun} executionResult={noLongerDetected ? { findingId: finding.id, status: "Skipped", message: finding.latestScanNote } : executionResult} skipRemediationReason={noLongerDetected ? finding.latestScanNote : undefined} implementationOnly defaultExpanded={Boolean(noLongerDetected || evidenceRun || executionResult)} />;
            })}
          </Card>
        })}
      </div>
    </section>
  );
}





