import React from "react";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Tag } from "primereact/tag";

import { getStatusSeverity } from "./helpers";
import { PageHeader } from "./sharedUi";
import type { DeploymentQueueItem } from "./types";

function formatQueueTime(value?: string) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-SG", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function planDeviceCount(item: DeploymentQueueItem) {
  return item.deviceCount ?? item.executionPlan?.devices.length ?? 0;
}

function planPolicyCount(item: DeploymentQueueItem) {
  return item.policyCount ?? item.executionPlan?.devices.reduce((total, device) => total + device.findings.length, 0) ?? 0;
}

function pendingPolicyCount(item: DeploymentQueueItem) {
  return item.executionPlan?.devices.reduce((total, device) => total + device.findings.filter((finding) => finding.status === "Pending Execution").length, 0) ?? 0;
}

function skippedPolicyCount(item: DeploymentQueueItem) {
  return item.executionPlan?.devices.reduce((total, device) => total + device.findings.filter((finding) => finding.status === "Skipped").length, 0) ?? 0;
}

export function DeploymentQueuePage({ queue }: { queue: DeploymentQueueItem[] }) {
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());
  const toggleExpanded = (queueId: string) => {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(queueId)) next.delete(queueId);
      else next.add(queueId);
      return next;
    });
  };

  return (
    <section className="page-content">
      <PageHeader title="Deployment Queue" subtitle="Review released tickets in execution order before workers consume them." />
      <Card className="queue-board-card">
        {queue.length === 0 ? (
          <div className="empty-row">No released tickets are currently queued.</div>
        ) : (
          <div className="queue-board">
            {queue.map((item, index) => {
              const expanded = expandedIds.has(item.queueId);
              const deviceCount = planDeviceCount(item);
              const policyCount = planPolicyCount(item);
              const pendingCount = pendingPolicyCount(item);
              const skippedCount = skippedPolicyCount(item);
              return (
                <div key={item.queueId} className={`queue-item ${expanded ? "expanded" : ""}`}>
                  <button className="queue-item-header" type="button" onClick={() => toggleExpanded(item.queueId)} aria-expanded={expanded}>
                    <div className="queue-rank">{index + 1}</div>
                    <div className="queue-ticket-main">
                      <strong>{item.ticketId}</strong>
                      <span>{item.queueId}</span>
                    </div>
                    <div className="queue-chip-row">
                      <Tag value={`${deviceCount} device${deviceCount === 1 ? "" : "s"}`} severity="info" rounded />
                      <Tag value={`${policyCount} polic${policyCount === 1 ? "y" : "ies"}`} severity="warning" rounded />
                      {pendingCount > 0 && <Tag value={`${pendingCount} ready`} severity="success" rounded />}
                      {skippedCount > 0 && <Tag value={`${skippedCount} skipped`} severity="secondary" rounded />}
                    </div>
                    <div className="queue-meta-block">
                      <span>Queued by</span>
                      <strong>{item.queuedBy || item.ticket?.requestor || "Unknown"}</strong>
                    </div>
                    <div className="queue-meta-block">
                      <span>Queued at</span>
                      <strong>{formatQueueTime(item.queuedAt)}</strong>
                    </div>
                    <Tag value={item.status} severity={getStatusSeverity(item.status as any) as any} rounded />
                    <i className={expanded ? "pi pi-chevron-up" : "pi pi-chevron-down"} />
                  </button>
                  {expanded && (
                    <div className="queue-device-list">
                      {(item.executionPlan?.devices ?? []).map((device, deviceIndex) => (
                        <div key={`${item.queueId}-${device.hostname || deviceIndex}`} className="queue-device-row">
                          <div className="queue-device-identity">
                            <strong>{device.hostname || "Unknown device"}</strong>
                            <span>{device.hardwareType || "Hardware type not provided"} - {device.managementIp || "No management IP"}</span>
                          </div>
                          <div className="queue-policy-list">
                            {device.findings.map((finding) => (
                              <div key={`${finding.policyId}-${finding.title}`} className="queue-policy-row">
                                <Tag className="policy-id-tag" value={finding.policyId} severity={finding.status === "Skipped" ? "secondary" : "info"} rounded />
                                <div>
                                  <strong>{finding.title || finding.policyId}</strong>
                                  <span>{finding.reason || "Ready for executor."}</span>
                                </div>
                                <Tag value={finding.status} severity={finding.status === "Skipped" ? "secondary" : "success"} rounded />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </section>
  );
}
