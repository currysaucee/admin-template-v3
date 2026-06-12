import React, { useState } from "react";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import { Card } from "primereact/card";

import type { AutomationValidation, DeploymentRunResult, Finding, FindingExecutionResult, PolicySetting, RemediationTemplate, TicketDevice, ValidationRunResult } from "./types";
import { findRunResultsForTemplate, getPassConditions, getTemplateCommandCount, getTemplateDisplayName, resolveTemplateForDevice, splitCapturedOutputs, splitDisplayLines } from "./helpers";

export function ConfigSnapshotDownload({ path, filename }: { path?: string; filename?: string }) {
  const resolvedPath = path || (filename ? `/config-snapshots/${filename}` : "");
  if (!resolvedPath) return <span className="config-download-empty">No device config snapshot available.</span>;
  const downloadSnapshot = async () => {
    const response = await fetch(resolvedPath);
    if (!response.ok) throw new Error(`Unable to download config snapshot from ${resolvedPath}`);
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

export function FindingDetailCard({ finding, template, run, executionResult, defaultExpanded = false, implementationOnly = false, policySetting, showPolicyModel = false }: { finding: Finding; template?: RemediationTemplate; run?: DeploymentRunResult; executionResult?: FindingExecutionResult; defaultExpanded?: boolean; implementationOnly?: boolean; policySetting?: PolicySetting; showPolicyModel?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <Card className="finding-detail-card">
      <div className="finding-detail-header">
        <div><div className="finding-title-row"><Tag value={finding.id} severity="info" rounded /><h3>{finding.title}</h3></div><p>{finding.detectedAt}</p></div>
        <div className="action-row">{executionResult && <Tag value={executionResult.status} severity={executionResult.status === "Executed Successfully" ? "success" : executionResult.status === "Post-check Failed" ? "danger" : "secondary"} rounded />}{!executionResult && run && <Tag value={run.status} severity={run.status === "Successful" ? "success" : "danger"} rounded />}<Tag value={`${getTemplateCommandCount(template)} total steps`} severity="info" rounded /><Button label={expanded ? "Collapse" : "Expand"} icon={expanded ? "pi pi-chevron-up" : "pi pi-chevron-down"} size="small" outlined onClick={() => setExpanded((prev) => !prev)} /></div>
      </div>
      {expanded && <>
      <div className="finding-detail-grid">
        <div className="noncompliance-box success-box"><span>Agreed Settings (policy)</span><strong>{finding.expectedValue}</strong></div>
      </div>
      <TemplateExecutionPreview template={template} run={run} mode={implementationOnly ? "implementation" : "full"} policySetting={policySetting} showPolicyModel={showPolicyModel} />
      {executionResult?.message && <div className={`finding-result-note ${executionResult.status === "Post-check Failed" ? "failed" : ""}`}>{executionResult.message}</div>}
      </>}
    </Card>
  );
}

export function DeviceFixGroup({ device, templates, policySettings = [], defaultExpanded = false, showFailureBehaviour = false, showPolicyModel = false, implementationOnly = false }: { device: TicketDevice; templates: RemediationTemplate[]; policySettings?: PolicySetting[]; defaultExpanded?: boolean; showFailureBehaviour?: boolean; showPolicyModel?: boolean; implementationOnly?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const stepCount = device.findings.reduce((total, finding) => total + getTemplateCommandCount(resolveTemplateForDevice(device, finding, templates, policySettings)), 0);
  return (
    <div className="nested-card collapsible-device-card">
      <button className="collapsible-header device-collapse-header" type="button" onClick={() => setExpanded((prev) => !prev)} aria-expanded={expanded}>
        <div>
          <h3>{device.hostname}</h3>
          <p>{device.role} • {device.hardwareType} • {device.managementIp}</p>
        </div>
        <div className="collapse-meta">
          <Tag value={`${device.findings.length} fix${device.findings.length === 1 ? "" : "es"}`} severity="info" />
          <Tag value={`${stepCount} step${stepCount === 1 ? "" : "s"}`} severity="secondary" />
          <i className={expanded ? "pi pi-chevron-up" : "pi pi-chevron-down"} />
        </div>
      </button>
      {expanded && (
        <div className="device-fix-stack">
          <div className="device-snapshot-row">
            <span>Device Config Snapshot</span>
            <ConfigSnapshotDownload path={device.configSnapshotPath} filename={device.configSnapshotFilename} />
          </div>
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
          <div className="finding-title-row"><Tag value={finding.id} severity="info" rounded /><strong>{finding.title}</strong></div>
          <span>{template ? `${getTemplateDisplayName(template)} - updated ${template.updatedAt}` : "No template configured yet"}</span>
        </div>
        <div className="collapse-meta">
          <Tag value={`${getTemplateCommandCount(template)} steps`} severity={template ? "success" : "secondary"} />
          <i className={expanded ? "pi pi-chevron-up" : "pi pi-chevron-down"} />
        </div>
      </button>
      {expanded && <TemplateExecutionPreview template={template} policySetting={policySetting} showPolicyModel={showPolicyModel} showFailureBehaviour={showFailureBehaviour} mode={implementationOnly ? "implementation" : "full"} />}
    </div>
  );
}

export function TemplateExecutionPreview({ template, run, showFailureBehaviour = false, mode = "full", policySetting, showPolicyModel = false }: { template?: RemediationTemplate; run?: DeploymentRunResult; showFailureBehaviour?: boolean; mode?: "full" | "implementation"; policySetting?: PolicySetting; showPolicyModel?: boolean }) {
  if (!template) return <div className="empty-pre"><strong>No approved fix template configured.</strong><span>Please contact the hardware SME to upload and approve a fix template in the portal before this finding can be remediated.</span></div>;
  const preCheckResults = run ? findRunResultsForTemplate(run.preChecks, template.preChecks) : undefined;
  const postCheckResults = run ? findRunResultsForTemplate(run.postChecks, template.postChecks) : undefined;
  const showPreChecks = mode === "full" && template.preChecks.length > 0;
  const showPostChecks = mode === "full" && template.postChecks.length > 0;
  return (
    <div className="execution-preview">
      {run && <div className="run-alert-inline"><strong>{run.status === "Successful" ? "Deployment completed" : `${run.failureStage ?? "Deployment"} failed`}</strong><p>{run.failureReason ?? `${run.runId} completed and evidence is shown against each command below.`}</p></div>}
      {showPolicyModel && <PolicyModelBlock setting={policySetting} fallbackPayload={template.agreedSetting} />}
      {showPreChecks && <ValidationTable phase="pre" title="1. Automated Pre-check" badge={run ? "Executed evidence" : "Gate before push"} rows={template.preChecks} results={preCheckResults} />}
      <CommandList phase="fix" title={showPreChecks ? "2. Implementation Commands" : "Implementation Commands"} badge={run ? (run.implementationCommands.some((item) => item.status === "Executed") ? "Executed" : "Skipped") : "Config push"} commands={template.implementationCommands} runCommands={run?.implementationCommands} />
      {showPostChecks && <ValidationTable phase="post" title={showPreChecks ? "3. Automated Post-check" : "Automated Post-check"} badge={run ? "Executed evidence" : "Proof capture"} rows={template.postChecks} results={postCheckResults} />}
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

function ValidationTable({ phase, title, badge, rows, results }: { phase: "pre" | "post"; title: string; badge: string; rows: AutomationValidation[]; results?: Array<ValidationRunResult | undefined> }) {
  return (
    <div className={`execution-section phase-section phase-${phase}`}>
      <div className="execution-section-header"><strong>{title}</strong><Tag value={badge} severity="info" /></div>
      <div className="script-check-list">
        {rows.map((row, index) => <ScriptValidationBlock key={`${row.scriptName}-${index}`} check={results?.[index] ?? row} index={index} result={results?.[index]?.result} analysedAt={results?.[index]?.analysedAt} capturedOutput={results?.[index]?.capturedOutput} />)}
      </div>
    </div>
  );
}

export function ScriptValidationBlock({ check, index, result, capturedOutput, analysedAt }: { check: Pick<AutomationValidation, "scriptName" | "command" | "expectedCondition" | "passCriteria">; index: number; result?: ValidationRunResult["result"]; capturedOutput?: string; analysedAt?: string }) {
  const commandLines = splitDisplayLines(check.command);
  const capturedOutputs = capturedOutput === undefined ? undefined : splitCapturedOutputs(capturedOutput, commandLines.length);
  return (
    <div className="script-check-block">
      <div className="script-check-head">
        <div>
          <span className="script-check-index">Script {index + 1}</span>
          <strong>{check.scriptName}</strong>
        </div>
        {result && <Tag value={result} severity={result === "Passed" ? "success" : result === "Failed" ? "danger" : "secondary"} rounded />}
      </div>
      <div className="script-check-columns">
        {capturedOutputs ? <CommandOutputList commandLines={commandLines} capturedOutputs={capturedOutputs} /> : <NumberedLineList title="Commands Run" lines={commandLines} code />}
        <NumberedLineList title="Pass When" lines={getPassConditions(check)} />
      </div>
      {analysedAt && <div className="script-check-footer">Analysed {analysedAt}</div>}
    </div>
  );
}

function CommandOutputList({ commandLines, capturedOutputs }: { commandLines: string[]; capturedOutputs: string[] }) {
  return (
    <div className="numbered-line-panel command-output-panel">
      <div className="numbered-line-title">Commands And Captured Output</div>
      <div className="command-output-list">
        {(commandLines.length ? commandLines : ["Command not specified"]).map((command, index) => (
          <div key={`${command}-${index}`} className="command-output-row">
            <span>{index + 1}</span>
            <div>
              <code className="command-output-command">{command}</code>
              <code className={`command-output-capture ${capturedOutputs[index] ? "" : "empty-terminal"}`}>{capturedOutputs[index] || "No outputs captured from the commands run."}</code>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NumberedLineList({ title, lines, code = false }: { title: string; lines: string[]; code?: boolean }) {
  return (
    <div className="numbered-line-panel">
      <div className="numbered-line-title">{title}</div>
      <div className="numbered-line-list">
        {(lines.length ? lines : ["Not specified"]).map((line, index) => (
          <div key={`${line}-${index}`} className="numbered-line">
            <span>{index + 1}</span>
            {code ? <code>{line}</code> : <p>{line}</p>}
          </div>
        ))}
      </div>
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





