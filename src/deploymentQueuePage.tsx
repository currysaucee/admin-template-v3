import React from "react";
import { Card } from "primereact/card";
import { Tag } from "primereact/tag";
import { Button } from "primereact/button";

import { formatDateTime, getStatusSeverity } from "./helpers";
import { PageHeader } from "./sharedUi";
import type { DeploymentQueueItem, DeploymentWorkerHealth } from "./types";

function formatQueueTime(value?: string) {
  return formatDateTime(value);
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

type DeploymentPhase = "preCheck" | "implementation" | "postCheck";

type PhaseLogEntry = {
  device?: string;
  policyId?: string;
  data: unknown;
};

const phaseDetails: Record<DeploymentPhase, { number: string; title: string; description: string }> = {
  preCheck: { number: "1", title: "Pre-check", description: "Capture device configuration and assess current compliance." },
  implementation: { number: "2", title: "Implementation", description: "Run the remediation commands for policies that still require a fix." },
  postCheck: { number: "3", title: "Post-check", description: "Capture configuration again and confirm the policy is now compliant." },
};

function objectValue(value: unknown): Record<string, any> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : undefined;
}

function deploymentResult(item: DeploymentQueueItem) {
  return objectValue(item.executorResponse?.response) ?? objectValue(item.result);
}

function failedResultPhase(result: Record<string, any>): DeploymentPhase {
  const diagnosticStage = String(objectValue(result.diagnostics)?.stage ?? "").toLowerCase();
  if (diagnosticStage === "pre") return "preCheck";
  if (diagnosticStage === "post") return "postCheck";
  const payloadText = JSON.stringify(result.requestPayload ?? "").toLowerCase();
  if (payloadText.includes("pre-check")) return "preCheck";
  if (payloadText.includes("post-check")) return "postCheck";
  return "implementation";
}

function phaseLogEntries(item: DeploymentQueueItem, phase: DeploymentPhase): PhaseLogEntry[] {
  const result = deploymentResult(item);
  if (!result) return [];
  const entries = (Array.isArray(result.steps) ? result.steps : []).flatMap((rawStep: unknown) => {
    const step = objectValue(rawStep);
    if (!step) return [];
    const data = phase === "implementation" ? step.result : step[phase];
    if (data === null || data === undefined) return [];
    return [{ device: String(step.device ?? ""), policyId: String(step.policyId ?? ""), data }];
  });
  if (entries.length > 0) return entries;
  if (result.success === false && failedResultPhase(result) === phase) {
    return [{ data: result }];
  }
  return [];
}

function DeploymentPhaseLog({ item, phase }: { item: DeploymentQueueItem; phase: DeploymentPhase }) {
  const details = phaseDetails[phase];
  const entries = phaseLogEntries(item, phase);
  return (
    <section className={`queue-phase-log ${phase}`}>
      <header>
        <span className="queue-phase-number">{details.number}</span>
        <div>
          <strong>{details.title}</strong>
          <small>{details.description}</small>
        </div>
        <Tag value={entries.length > 0 ? `${entries.length} log${entries.length === 1 ? "" : "s"}` : "Not recorded"} severity={entries.length > 0 ? "info" : "secondary"} rounded />
      </header>
      {entries.length === 0 ? (
        <p>No {details.title.toLowerCase()} result has been recorded for this ticket.</p>
      ) : entries.map((entry, index) => (
        <div className="queue-phase-entry" key={`${phase}-${entry.device}-${entry.policyId}-${index}`}>
          {(entry.device || entry.policyId) && (
            <div className="queue-phase-context">
              {entry.device && <span>{entry.device}</span>}
              {entry.policyId && <span>{entry.policyId}</span>}
            </div>
          )}
          <pre>{JSON.stringify(entry.data, null, 2)}</pre>
        </div>
      ))}
    </section>
  );
}

function heartbeatAgeLabel(value?: string) {
  if (!value) return "No heartbeat";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const ageSeconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (ageSeconds < 60) return `${ageSeconds}s ago`;
  const ageMinutes = Math.round(ageSeconds / 60);
  if (ageMinutes < 60) return `${ageMinutes}m ago`;
  return `${Math.round(ageMinutes / 60)}h ago`;
}

function countdownLabel(value: string | undefined, now: number) {
  if (!value) return "";
  const remaining = Math.max(0, Math.ceil((new Date(value).getTime() - now) / 1000));
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")} until next fix`;
}

function WorkerHealthStrip({ workers }: { workers: DeploymentWorkerHealth[] }) {
  return (
    <Card className="worker-health-card">
      <div className="worker-health-header">
        <div>
          <h2>Worker Health</h2>
          <p>{workers.length} worker{workers.length === 1 ? "" : "s"} with recorded deployment activity.</p>
        </div>
        <Tag value={workers.length > 0 ? "Activity recorded" : "No workers"} severity={workers.length > 0 ? "success" : "warning"} rounded />
      </div>
      {workers.length === 0 ? (
        <div className="worker-empty">No worker activity has been recorded in the deployment queue yet.</div>
      ) : (
        <div className="worker-health-grid">
          {workers.map((worker) => (
            <div key={worker.workerId} className="worker-health-item">
              <div>
                <strong>{worker.workerId}</strong>
                <span>{worker.detail || "Worker is reachable."}</span>
              </div>
              <Tag value={worker.status} severity={worker.status === "Alive" || worker.status === "Processing" ? "success" : worker.status === "Idle" ? "info" : "warning"} rounded />
              <small>Last alive {heartbeatAgeLabel(worker.lastSeenAt)}</small>
              <small>{worker.processedCount ?? 0} processed{worker.lastQueueId ? ` - ${worker.lastQueueId}` : ""}</small>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function DeploymentQueuePage({ queue, workerHealth = [], onAbort, onViewTicket }: { queue: DeploymentQueueItem[]; workerHealth?: DeploymentWorkerHealth[]; onAbort?: (ticketId: string) => Promise<void> | void; onViewTicket?: (ticketId: string) => void }) {
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());
  const [now, setNow] = React.useState(Date.now());
  const [abortingId, setAbortingId] = React.useState("");
  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
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
      <PageHeader title="Deployment Queue" subtitle="Review released HCC requests in execution order before workers consume them." />
      <WorkerHealthStrip workers={workerHealth} />
      <Card className="queue-board-card">
        {queue.length === 0 ? (
          <div className="empty-row">No released requests are currently queued.</div>
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
                  <div className="queue-item-header" role="button" tabIndex={0} onClick={() => toggleExpanded(item.queueId)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleExpanded(item.queueId); } }} aria-expanded={expanded}>
                    <div className="queue-rank">{index + 1}</div>
                    <div className="queue-ticket-main">
                      <button className="queue-ticket-link" type="button" onClick={(event) => { event.stopPropagation(); onViewTicket?.(item.ticketId); }}>{item.ticketId}</button>
                    </div>
                    <div className="queue-chip-row">
                      <Tag value={`${deviceCount} device${deviceCount === 1 ? "" : "s"}`} severity="info" rounded />
                      <Tag value={`${policyCount} polic${policyCount === 1 ? "y" : "ies"}`} severity="warning" rounded />
                      {pendingCount > 0 && <Tag value={`${pendingCount} ready`} severity="success" rounded />}
                      {skippedCount > 0 && <Tag value={`${skippedCount} skipped`} severity="secondary" rounded />}
                      {item.status === "Waiting" && <Tag value={countdownLabel(item.nextExecutionAt, now)} severity="warning" rounded />}
                    </div>
                    <div className="queue-meta-block">
                      <span>Queued at</span>
                      <strong>{formatQueueTime(item.queuedAt)}</strong>
                    </div>
                    <Tag value={item.status} severity={getStatusSeverity(item.status as any) as any} rounded />
                    <i className={expanded ? "pi pi-chevron-up" : "pi pi-chevron-down"} />
                  </div>
                  {expanded && (
                    <div className="queue-device-list">
                      {["Queued", "Waiting", "Processing"].includes(item.status) && onAbort && (
                        <div className="queue-abort-row">
                          <span>Abort prevents every fix that has not started yet. A command already being executed cannot be recalled.</span>
                          <Button label="Abort Remaining Fixes" icon="pi pi-ban" severity="danger" outlined loading={abortingId === item.queueId} onClick={async () => { if (!window.confirm(`Abort remaining fixes for ${item.ticketId}?`)) return; setAbortingId(item.queueId); try { await onAbort(item.ticketId); } finally { setAbortingId(""); } }} />
                        </div>
                      )}
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
                                <Tag value={finding.status} severity={finding.status === "Reversion Required" ? "danger" : finding.status === "Skipped" ? "secondary" : finding.status === "Pending Execution" ? "info" : "success"} rounded />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      <div className="queue-phase-logs">
                        <DeploymentPhaseLog item={item} phase="preCheck" />
                        <DeploymentPhaseLog item={item} phase="implementation" />
                        <DeploymentPhaseLog item={item} phase="postCheck" />
                      </div>
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
