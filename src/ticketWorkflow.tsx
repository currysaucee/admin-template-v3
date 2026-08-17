import React from "react";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import { Checkbox } from "primereact/checkbox";
import { Calendar } from "primereact/calendar";
import { Card } from "primereact/card";
import { Dialog } from "primereact/dialog";

import type { Device, Finding, PolicySetting, RemediationTemplate, TicketDevice } from "./types";
import { findFindingKey, getFixAvailability, isSupportedPolicyFinding, resolveTemplateForDevice } from "./helpers";
import { PageHeader } from "./sharedUi";

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
  const [showDateDialog, setShowDateDialog] = React.useState(false);
  const today = React.useMemo(() => {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    return value;
  }, []);
  const steps = [{ label: "Findings" }, { label: "Review" }];
  const currentStep = Math.min(props.step, steps.length - 1);
  const canGoNext = currentStep === 0 ? props.selectedFindingKeys.length > 0 : props.selectedCommandCount > 0;
  const setImplementationDate = (date: Date | null) => {
    if (date && date < today) {
      props.setPlannedStart(null);
      return;
    }
    props.setPlannedStart(date);
  };

  return (
    <section className="page-content">
      <PageHeader title="Create Ticket" subtitle="Select approved findings and review the exact implementation commands before submitting." />
      <Card className="wizard-card">
        <div className="ticket-stepper" aria-label="Create ticket steps">
          {steps.map((item, index) => (
            <div key={item.label} className={`ticket-stepper-item ${index === currentStep ? "active" : ""} ${index < currentStep ? "complete" : ""}`}>
              <span>{index + 1}</span>
              <strong>{item.label}</strong>
            </div>
          ))}
        </div>
        <div className="step-content">
          {currentStep === 0 && <ScopeStep {...props} />}
          {currentStep === 1 && <ReviewStep {...props} />}
        </div>
        <div className="wizard-footer">
          <Button label={currentStep === 0 ? "Cancel" : "Back"} icon={currentStep === 0 ? undefined : "pi pi-arrow-left"} outlined onClick={() => (currentStep === 0 ? props.onCancel() : props.setStep(currentStep - 1))} />
          {currentStep < 1 ? (
            <Button label="Next: Review" icon="pi pi-arrow-right" iconPos="right" disabled={!canGoNext} onClick={() => props.setStep(props.step + 1)} />
          ) : (
            <Button label="Submit Ticket" icon="pi pi-check" disabled={!canGoNext} onClick={() => setShowDateDialog(true)} />
          )}
        </div>
      </Card>
      <Dialog visible={showDateDialog} onHide={() => setShowDateDialog(false)} header="Choose Implementation Date" style={{ width: "28rem" }} modal>
        <div className="template-editor-stack">
          <div className="field-block">
            <label>Implementation Date</label>
            <Calendar value={props.plannedStart} onChange={(event) => setImplementationDate(event.value as Date | null)} minDate={today} dateFormat="M dd, yy" showIcon />
          </div>
          <div className="wizard-footer compact-footer">
            <Button label="Cancel" outlined onClick={() => setShowDateDialog(false)} />
            <Button label="Submit Ticket" icon="pi pi-check" disabled={!props.plannedStart} onClick={() => { setShowDateDialog(false); props.onSubmit(); }} />
          </div>
        </div>
      </Dialog>
    </section>
  );
}

function ScopeStep({ devices, templates, policySettings, selectedDeviceIds, setSelectedDeviceIds, selectedFindingKeys, setSelectedFindingKeys, selectedDevices }: Parameters<typeof CreateTicketPage>[0]) {
  const visibleDevices = selectedDeviceIds.length > 0 ? selectedDevices : devices;
  return (
    <div className="scope-grid">
      <div className="summary-card full-span">
        <h3>Findings</h3>
        <p className="section-subtitle">Select one or more approved finding fixes. Use the Exceptions page filters to narrow this list before creating a ticket.</p>
        {visibleDevices.length === 0 ? (
          <p className="empty-text">No eligible findings are available.</p>
        ) : (
          visibleDevices.map((device) => (
            <div key={device.id} className="finding-group">
              <div className="finding-group-title">{device.hostname}</div>
              {device.findings.length === 0 ? (
                <div className="empty-row">No open compliance findings for this device.</div>
              ) : (
                <div className="finding-list-table">
                  <div className="finding-list-header">
                    <span></span>
                    <span>Finding Rule</span>
                    <span>Implementation Commands</span>
                  </div>
                  {device.findings.map((finding) => {
                    const key = findFindingKey(device.id, finding.id);
                    const checked = selectedFindingKeys.includes(key);
                    const availability = getFixAvailability(device, finding, templates, policySettings);
                    const hasTemplateFix = availability.executable;
                    const supported = isSupportedPolicyFinding(finding, policySettings);
                    const implementationCommands = availability.template?.implementationCommands ?? [];
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
                            setSelectedDeviceIds((prev) => {
                              if (next) return Array.from(new Set([...prev, device.id]));
                              const remainingFindingKeys = selectedFindingKeys.filter((item) => item !== key);
                              return remainingFindingKeys.some((item) => item.startsWith(`${device.id}:`)) ? prev : prev.filter((id) => id !== device.id);
                            });
                          }}
                        />
                        <div className="finding-rule-cell">
                          <span className="mobile-field-label">Finding Rule</span>
                          <div className="finding-title-row"><Tag className={`policy-id-tag ${supported ? "" : "unsupported-policy-tag"}`} value={finding.id} severity={supported ? "info" : "secondary"} rounded />{!supported && <Tag value="Unsupported" severity="secondary" rounded />}<strong>{finding.title}</strong></div>
                          {!hasTemplateFix && <small className="template-availability-note">{availability.note}</small>}
                        </div>
                        <div className="finding-standard-cell">
                          <span className="mobile-field-label">Implementation Commands</span>
                          <div className="command-list compact-command-list implementation-command-preview">
                            {(implementationCommands.length ? implementationCommands : ["No implementation command configured."]).map((command, index) => (
                              <div key={`${command}-${index}`} className="command-line"><span>{index + 1}</span><code>{command}</code></div>
                            ))}
                          </div>
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

function ReviewStep({ selectedTicketDevices, templates, policySettings }: Parameters<typeof CreateTicketPage>[0]) {
  const findingCount = selectedTicketDevices.reduce((total, device) => total + device.findings.length, 0);

  return (
    <div className="step-stack">
      <div className="review-card">
        <div className="review-table-title">
          <h3>Review</h3>
          <span>{selectedTicketDevices.length} device{selectedTicketDevices.length === 1 ? "" : "s"} - {findingCount} finding{findingCount === 1 ? "" : "s"}</span>
        </div>
        {selectedTicketDevices.length === 0 ? <p className="empty-text">No remediation selected.</p> : (
          <div className="review-device-list">
            {selectedTicketDevices.map((device) => (
              <div key={device.deviceId} className="review-device-card">
                <div className="review-device-heading">
                  <div>
                    <strong>{device.hostname}</strong>
                    <span>{device.hardwareType} - {device.managementIp}</span>
                  </div>
                </div>
                <div className="review-finding-list">
                  {device.findings.map((finding) => {
                    const template = resolveTemplateForDevice(device, finding, templates, policySettings);
                    return (
                      <div key={finding.id} className="review-finding-row">
                        <div className="finding-title-row"><Tag className="policy-id-tag review-policy-id-tag" value={finding.id} severity="info" rounded /><strong>{finding.title}</strong></div>
                        <div className="command-list compact-command-list implementation-command-preview">
                          {(template?.implementationCommands.length ? template.implementationCommands : ["No implementation command configured."]).map((command, index) => (
                            <div key={`${device.deviceId}-${finding.id}-${command}-${index}`} className="command-line"><span>{index + 1}</span><code>{command}</code></div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
