import React from "react";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import { InputText } from "primereact/inputtext";
import { MultiSelect } from "primereact/multiselect";
import { Checkbox } from "primereact/checkbox";
import { Calendar } from "primereact/calendar";
import { InputTextarea } from "primereact/inputtextarea";
import { Card } from "primereact/card";

import type { Device, Finding, PolicySetting, RemediationTemplate, TicketDevice } from "./types";
import { findFindingKey, formatDate, getFixAvailability, getTemplateCommandCount, hasExecutableFix } from "./helpers";
import { DeviceFixGroup } from "./remediationViews";
import { DeviceMiniCard, DeviceOptionTemplate, PageHeader } from "./sharedUi";

export function CreateTicketPage(props: {
  devices: Device[];
  templates: RemediationTemplate[];
  policySettings: PolicySetting[];
  step: number;
  setStep: (step: number) => void;
  selectedDeviceIds: string[];
  setSelectedDeviceIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedFindingKeys: string[];
  setSelectedFindingKeys: React.Dispatch<React.SetStateAction<string[]>>;
  selectedDevices: Device[];
  selectedTicketDevices: TicketDevice[];
  selectedCommandCount: number;
  plannedStart: Date | null;
  setPlannedStart: (date: Date | null) => void;
  plannedEnd: Date | null;
  setPlannedEnd: (date: Date | null) => void;
  implementationPlan: string;
  setImplementationPlan: (value: string) => void;
  backoutPlan: string;
  setBackoutPlan: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const steps = [{ label: "Scope" }, { label: "Remediation Items" }, { label: "Change Request" }, { label: "Review & Submit" }];
  const canGoNext = props.step === 0 ? props.selectedDeviceIds.length > 0 && props.selectedFindingKeys.length > 0 : props.step === 1 ? props.selectedCommandCount > 0 : props.step === 2 ? Boolean(props.plannedStart && props.plannedEnd) : true;

  return (
    <section className="page-content">
      <PageHeader title="Create Ticket" subtitle="Fix templates are used here immediately after you update them in Fix Templates." />
      <Card className="wizard-card">
        <div className="ticket-stepper" aria-label="Create ticket steps">
          {steps.map((item, index) => (
            <div key={item.label} className={`ticket-stepper-item ${index === props.step ? "active" : ""} ${index < props.step ? "complete" : ""}`}>
              <span>{index + 1}</span>
              <strong>{item.label}</strong>
            </div>
          ))}
        </div>
        <div className="step-content">
          {props.step === 0 && <ScopeStep {...props} />}
          {props.step === 1 && <RemediationStep {...props} />}
          {props.step === 2 && <ChangeRequestStep {...props} />}
          {props.step === 3 && <ReviewStep {...props} />}
        </div>
        <div className="wizard-footer">
          <Button label={props.step === 0 ? "Cancel" : "Back"} icon={props.step === 0 ? undefined : "pi pi-arrow-left"} outlined onClick={() => (props.step === 0 ? props.onCancel() : props.setStep(props.step - 1))} />
          {props.step < 3 ? (
            <Button label={props.step === 0 ? "Next: Remediation Items" : props.step === 1 ? "Next: Change Request" : "Next: Review & Submit"} icon="pi pi-arrow-right" iconPos="right" disabled={!canGoNext} onClick={() => props.setStep(props.step + 1)} />
          ) : (
            <Button label="Create Ticket" icon="pi pi-check" onClick={props.onSubmit} />
          )}
        </div>
      </Card>
    </section>
  );
}

function ScopeStep({ devices, templates, policySettings, selectedDeviceIds, setSelectedDeviceIds, selectedFindingKeys, setSelectedFindingKeys, selectedDevices }: Parameters<typeof CreateTicketPage>[0]) {
  return (
    <div className="scope-grid">
      <div className="field-block full-span">
        <label>Select Device(s)</label>
        <MultiSelect value={selectedDeviceIds} options={devices} optionLabel="hostname" optionValue="id" display="chip" placeholder="Search and select device(s)..." filter itemTemplate={(device: Device) => <DeviceOptionTemplate device={device} />} onChange={(e) => { const ids = e.value as string[]; setSelectedDeviceIds(ids); setSelectedFindingKeys((prev) => prev.filter((key) => ids.some((id) => key.startsWith(`${id}:`)))); }} />
        <small className="muted-note">Only non-compliant devices with findings are shown. Removing a device also removes its selected findings.</small>
      </div>
      <div className="summary-card full-span">
        <h3>Selected Device(s)</h3>
        {selectedDevices.length === 0 ? <p className="empty-text">No device selected yet.</p> : <div className="device-list-mini">{selectedDevices.map((device) => <DeviceMiniCard key={device.id} device={device} onRemove={() => { setSelectedDeviceIds(selectedDeviceIds.filter((id) => id !== device.id)); setSelectedFindingKeys(selectedFindingKeys.filter((key) => !key.startsWith(`${device.id}:`))); }} />)}</div>}
      </div>
      <div className="summary-card full-span">
        <h3>Findings</h3>
        <p className="section-subtitle">Select one or more findings to remediate for the selected device scope.</p>
        {selectedDevices.length === 0 ? (
          <p className="empty-text">Select a device to load findings.</p>
        ) : (
          selectedDevices.map((device) => (
            <div key={device.id} className="finding-group">
              <div className="finding-group-title">{device.hostname}</div>
              {device.findings.length === 0 ? (
                <div className="empty-row">No open compliance findings for this device.</div>
              ) : (
                <div className="finding-list-table">
                  <div className="finding-list-header">
                    <span></span>
                    <span>Finding Rule</span>
                    <span>Standard / Expected Config</span>
                  </div>
                  {device.findings.map((finding) => {
                    const key = findFindingKey(device.id, finding.id);
                    const checked = selectedFindingKeys.includes(key);
                    const availability = getFixAvailability(device, finding, templates, policySettings);
                    const hasTemplateFix = availability.executable;
                    return (
                      <div key={key} className={`finding-list-row ${hasTemplateFix ? "" : "finding-list-row-disabled"}`}>
                        <Checkbox
                          checked={checked}
                          disabled={!hasTemplateFix}
                          onChange={(e) => {
                            if (!hasTemplateFix) return;
                            const next = Boolean(e.checked);
                            setSelectedFindingKeys((prev) => {
                              if (next) return Array.from(new Set([...prev, key]));
                              return prev.filter((item) => item !== key);
                            });
                          }}
                        />
                        <div className="finding-rule-cell">
                          <span className="mobile-field-label">Finding Rule</span>
                          <div className="finding-title-row"><Tag value={finding.id} severity="info" rounded /><strong>{finding.title}</strong></div>
                          <div className="template-availability-row">
                            <Tag value={availability.label} severity={availability.severity} rounded />
                            {availability.template && <Tag value={availability.template.findingName} severity="info" rounded />}
                          </div>
                          <small className="template-availability-note">{availability.note}</small>
                        </div>
                        <div className="finding-standard-cell">
                          <span className="mobile-field-label">Standard / Expected Config</span>
                          <strong className="payload-config-text">Agreed setting: {finding.expectedValue}</strong>
                          {!hasTemplateFix && <div className="template-disabled-note"><i className="pi pi-lock" />No template fix has been configured yet.</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function RemediationStep({ selectedTicketDevices, templates, policySettings, selectedCommandCount }: Parameters<typeof CreateTicketPage>[0]) {
  return (
    <div className="step-stack">
      {selectedTicketDevices.map((device) => <DeviceFixGroup key={device.deviceId} device={device} templates={templates} policySettings={policySettings} showPolicyModel defaultExpanded />)}
    </div>
  );
}

function ChangeRequestStep({ selectedTicketDevices, plannedStart, setPlannedStart, plannedEnd, setPlannedEnd, implementationPlan, setImplementationPlan, backoutPlan, setBackoutPlan }: Parameters<typeof CreateTicketPage>[0]) {
  return (
    <div className="step-stack">
      <div className="summary-card">
        <h3>Change Request Details</h3>
        <div className="implementation-banner"><p>Implementation commands are only pushed after automation pre-checks pass for each device and each finding.</p></div>
        <div className="form-grid">
          <div className="field-block"><label>Change Start</label><Calendar value={plannedStart} onChange={(e) => setPlannedStart(e.value as Date | null)} showTime hourFormat="12" /></div>
          <div className="field-block"><label>Change End</label><Calendar value={plannedEnd} onChange={(e) => setPlannedEnd(e.value as Date | null)} showTime hourFormat="12" /></div>
          <div className="field-block full-span"><label>Implementation Plan</label><InputTextarea value={implementationPlan} onChange={(e) => setImplementationPlan(e.target.value)} rows={4} autoResize /></div>
          <div className="field-block full-span"><label>Reversion Plan</label><InputTextarea value={backoutPlan} onChange={(e) => setBackoutPlan(e.target.value)} rows={4} autoResize /></div>
        </div>
      </div>
    </div>
  );
}

function ReviewStep({ selectedTicketDevices, templates, policySettings, selectedCommandCount, plannedStart, plannedEnd }: Parameters<typeof CreateTicketPage>[0]) {
  const findings = selectedTicketDevices.flatMap((device) => device.findings);
  return (
    <div className="step-stack">
      <div className="review-card">
        <h3>1. Scope</h3>
        <div className="review-grid">
          <div><strong>Devices ({selectedTicketDevices.length})</strong>{selectedTicketDevices.length === 0 ? <p>No devices selected.</p> : selectedTicketDevices.map((device) => <p key={device.deviceId}>{device.hostname} • {device.role} • {device.managementIp}</p>)}</div>
          <div><strong>Remediation Items ({findings.length})</strong>{findings.length === 0 ? <p>No findings selected.</p> : findings.map((finding) => <p key={finding.id}>{finding.id} • {finding.title} • {finding.standard}</p>)}</div>
        </div>
        <div className="review-scope-remediation">
          <div className="review-section-heading">
            <strong>Remediation Steps</strong>
            <Tag value={`${selectedCommandCount} step${selectedCommandCount === 1 ? "" : "s"}`} severity="info" rounded />
          </div>
          <p className="section-subtitle">Open each device and finding to review the approved implementation commands before submission.</p>
        </div>
        <div className="review-remediation-stack">
          {selectedTicketDevices.length === 0 ? <p className="empty-text">No remediation selected.</p> : selectedTicketDevices.map((device) => <DeviceFixGroup key={device.deviceId} device={device} templates={templates} policySettings={policySettings} showPolicyModel showFailureBehaviour />)}
        </div>
      </div>
      <div className="review-card"><h3>2. Change Request</h3><p><strong>Change Window:</strong> {formatDate(plannedStart)} to {formatDate(plannedEnd)}</p></div>
    </div>
  );
}





