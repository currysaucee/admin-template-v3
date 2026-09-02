import React from "react";
import { Accordion, AccordionTab } from "primereact/accordion";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Tag } from "primereact/tag";

import { formatDate, formatDateTime } from "./helpers";
import { PageHeader } from "./sharedUi";
import type { PolicySetting } from "./types";

type DraftPolicyRow = {
  rowId: string;
  settingNumber: string;
  title: string;
  expectedConfig: string;
};

function createDraftRow(): DraftPolicyRow {
  return {
    rowId: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    settingNumber: "",
    title: "",
    expectedConfig: "",
  };
}

function normalizePolicyNumber(value: string) {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

function derivePolicyType(title = "", expectedConfig = "") {
  const text = `${title} ${expectedConfig}`.toLowerCase();
  if (/password|secret|credential|username/.test(text)) return "Password Policy";
  if (/telnet|http|https|service|port|daemon/.test(text)) return "Unused / Insecure Services";
  if (/tacacs|aaa|authentication|authorization|accounting/.test(text)) return "Authentication Services";
  if (/snmp/.test(text)) return "SNMP";
  if (/syslog|logging|log /.test(text)) return "Logging";
  if (/ntp|time/.test(text)) return "Time Synchronization";
  if (/banner/.test(text)) return "Banner";
  if (/acl|access-list|access group|access-group|control-plane/.test(text)) return "Access Control";
  if (/ospf|vrf|routing|route/.test(text)) return "Routing";
  return "General Policy";
}

function policyUpdatedAt(setting: PolicySetting) {
  return formatDateTime(setting.updatedAt || setting.createdAt);
}

function policyUpdatedBy(setting: PolicySetting) {
  return setting.updatedBy || "Developer";
}

function toPolicySetting(row: DraftPolicyRow): PolicySetting {
  const settingNumber = normalizePolicyNumber(row.settingNumber);
  const now = formatDate(new Date());
  return {
    id: settingNumber,
    settingNumber,
    title: row.title.trim() || settingNumber,
    settingPayload: row.expectedConfig.trim(),
    standard: derivePolicyType(row.title, row.expectedConfig),
    description: "",
    createdAt: now,
    updatedAt: now,
    updatedBy: "Developer",
  };
}

function toDraftRow(setting: PolicySetting): DraftPolicyRow {
  return {
    rowId: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    settingNumber: setting.settingNumber || setting.id,
    title: setting.title,
    expectedConfig: setting.settingPayload,
  };
}

function mergePolicySettings(current: PolicySetting[], nextPolicies: PolicySetting[]) {
  const byId = new Map(current.map((setting) => [setting.id, setting]));
  nextPolicies.forEach((setting) => byId.set(setting.id, setting));
  return Array.from(byId.values()).sort((a, b) => (a.settingNumber || a.id).localeCompare(b.settingNumber || b.id));
}

function PolicyChip({ setting }: { setting: PolicySetting }) {
  return (
    <span className="policy-chip-line">
      <Tag className="policy-id-tag" value={setting.settingNumber || setting.id} rounded />
      <span>{setting.title}</span>
    </span>
  );
}

export function DeveloperConsolePage({
  policySettings,
  setPolicySettings,
  onOnboardPolicySettings,
  onDeletePolicySetting,
  onExtractDocument,
  onRunScanImport,
  scanImportRunning = false,
  scanImportMessage = "",
  lastScanAt = "",
}: {
  policySettings: PolicySetting[];
  setPolicySettings: React.Dispatch<React.SetStateAction<PolicySetting[]>>;
  onOnboardPolicySettings?: (policySettings: PolicySetting[]) => Promise<PolicySetting[]>;
  onDeletePolicySetting?: (policySettingId: string) => Promise<PolicySetting[]>;
  onExtractDocument?: (document: File) => Promise<PolicySetting[]>;
  onRunScanImport?: () => void;
  scanImportRunning?: boolean;
  scanImportMessage?: string;
  lastScanAt?: string;
}) {
  const [draftRows, setDraftRows] = React.useState<DraftPolicyRow[]>([createDraftRow()]);
  const [filter, setFilter] = React.useState("");
  const [detailPolicy, setDetailPolicy] = React.useState<PolicySetting | null>(null);
  const [editingPolicy, setEditingPolicy] = React.useState(false);
  const [showIntake, setShowIntake] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState("");
  const [documentDialogOpen, setDocumentDialogOpen] = React.useState(false);
  const [documentFile, setDocumentFile] = React.useState<File | null>(null);
  const [documentProcessing, setDocumentProcessing] = React.useState(false);
  const [documentError, setDocumentError] = React.useState("");
  const [activeSections, setActiveSections] = React.useState<number | number[]>([0, 1]);
  const validRows = draftRows.filter((row) => normalizePolicyNumber(row.settingNumber) && row.expectedConfig.trim());
  const filteredPolicies = policySettings.filter((setting) => {
    const haystack = [setting.id, setting.settingNumber, setting.title, setting.settingPayload, policyUpdatedBy(setting)].join(" ").toLowerCase();
    return haystack.includes(filter.trim().toLowerCase());
  });

  const updateDraftRow = (rowId: string, patch: Partial<DraftPolicyRow>) => {
    setDraftRows((rows) => rows.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)));
  };

  const removeDraftRow = (rowId: string) => {
    setDraftRows((rows) => (rows.length === 1 ? rows : rows.filter((row) => row.rowId !== rowId)));
  };

  const onboardPolicies = async () => {
    const nextPolicies = validRows.map(toPolicySetting);
    setSubmitting(true);
    try {
      if (onOnboardPolicySettings) {
        const savedPolicies = await onOnboardPolicySettings(nextPolicies);
        setPolicySettings(savedPolicies);
      } else {
        setPolicySettings((current) => mergePolicySettings(current, nextPolicies));
      }
      setDraftRows([createDraftRow()]);
      setShowIntake(false);
    } finally {
      setSubmitting(false);
    }
  };

  const startEditPolicy = (policy: PolicySetting) => {
    setDraftRows([toDraftRow(policy)]);
    setDetailPolicy(null);
    setEditingPolicy(true);
    setShowIntake(true);
  };

  const deletePolicy = async (policy: PolicySetting) => {
    const policyId = policy.id || policy.settingNumber;
    if (!policyId || !window.confirm(`Delete policy setting ${policy.settingNumber || policy.id}?`)) return;
    setDeletingId(policyId);
    try {
      if (onDeletePolicySetting) {
        const nextPolicies = await onDeletePolicySetting(policyId);
        setPolicySettings(nextPolicies);
      } else {
        setPolicySettings((current) => current.filter((setting) => setting.id !== policyId));
      }
      setDetailPolicy(null);
    } finally {
      setDeletingId("");
    }
  };

  const processDocument = async () => {
    if (!documentFile || !onExtractDocument) return;
    setDocumentProcessing(true);
    setDocumentError("");
    try {
      const extractedPolicies = await onExtractDocument(documentFile);
      const extractedRows = extractedPolicies.map(toDraftRow);
      if (extractedRows.length === 0) {
        setDocumentError("No policy rows were detected. Check that the document contains policy numbers such as AS003 or HWS001.");
        return;
      }
      setDraftRows((rows) => {
        const filledRows = rows.filter((row) => normalizePolicyNumber(row.settingNumber) || row.title.trim() || row.expectedConfig.trim());
        return [...filledRows, ...extractedRows];
      });
      setShowIntake(true);
      setDocumentDialogOpen(false);
      setDocumentFile(null);
    } catch (error) {
      setDocumentError(error instanceof Error ? error.message : "Unable to process document.");
    } finally {
      setDocumentProcessing(false);
    }
  };

  const openNewPolicy = () => {
    setDraftRows([createDraftRow()]);
    setEditingPolicy(false);
    setShowIntake(true);
  };

  return (
    <section className="page-content developer-console-page">
      <PageHeader title="Developer Console" subtitle="Manage supported policy IDs before fixes are exposed to engineers." />

      <Accordion className="developer-console-sections" multiple activeIndex={activeSections} onTabChange={(event) => setActiveSections(event.index)}>
        <AccordionTab header={<span className="developer-section-title"><i className="pi pi-cloud-download" /> Scan Operations</span>}>
          <div className="developer-section-body">
            <div className="developer-operation-row">
              <div>
                <h2>Manual Scan Import</h2>
                <p className="section-subtitle">Download the latest scan payload, overwrite the rolling payload file, and import it into the HCC database.</p>
              </div>
              <div className="developer-heading-actions">
                <Tag value={`Last scan: ${lastScanAt || "Not imported yet"}`} severity={lastScanAt ? "info" : "secondary"} rounded />
                {onRunScanImport ? <Button label="Run Import Scan" icon="pi pi-refresh" loading={scanImportRunning} onClick={onRunScanImport} /> : null}
              </div>
            </div>
            {scanImportMessage ? <div className="inline-info-row">{scanImportMessage}</div> : null}
          </div>
        </AccordionTab>

        <AccordionTab header={<span className="developer-section-title"><i className="pi pi-shield" /> Policy Onboarding</span>}>
          <div className="developer-section-body">
            <Card className="table-card developer-policy-table">
              <div className="developer-table-header">
                <span className="p-input-icon-left grow-input">
                  <i className="pi pi-search" />
                  <InputText value={filter} placeholder="Filter by policy number, title, config text..." onChange={(event) => setFilter(event.target.value)} />
                </span>
                <div className="developer-heading-actions">
                  <Tag value={`${filteredPolicies.length} policies`} severity="info" rounded />
                  <Button label="Onboard New Policy" icon="pi pi-plus" onClick={openNewPolicy} />
                </div>
              </div>
              <DataTable
                value={filteredPolicies}
                dataKey="id"
                paginator
                rows={8}
                emptyMessage="No policy settings onboarded yet."
                rowClassName={() => "policy-list-row"}
                onRowClick={(event) => {
                  setDetailPolicy(event.data as PolicySetting);
                  setEditingPolicy(false);
                }}
              >
                <Column header="Policy" body={(row: PolicySetting) => <PolicyChip setting={row} />} sortable sortField="settingNumber" />
                <Column header="Updated" body={(row: PolicySetting) => policyUpdatedAt(row)} sortable sortField="updatedAt" />
                <Column header="By" body={(row: PolicySetting) => policyUpdatedBy(row)} sortable sortField="updatedBy" />
              </DataTable>
            </Card>

            {showIntake && (
              <Card className="editor-card developer-intake-card">
                <div className="developer-card-heading">
                  <div>
                    <h2>{editingPolicy ? "Edit Policy" : "Onboard New Policy"}</h2>
                    <p>Add one or more policy settings. Existing policy numbers are overwritten so developers can correct mappings without editing code.</p>
                  </div>
                  <div className="developer-heading-actions">
                    <Button label="Add Row" icon="pi pi-plus" outlined onClick={() => setDraftRows((rows) => [...rows, createDraftRow()])} />
                    <Button label="Close" icon="pi pi-times" outlined severity="secondary" onClick={() => setShowIntake(false)} />
                  </div>
                </div>

                <div className="developer-row-stack">
                  {draftRows.map((row, index) => (
                    <div className="developer-policy-row" key={row.rowId}>
                      <div className="developer-policy-row-header">
                        <strong>Policy Row {index + 1}</strong>
                        <Button icon="pi pi-trash" rounded text severity="danger" aria-label="Remove policy row" disabled={draftRows.length === 1} onClick={() => removeDraftRow(row.rowId)} />
                      </div>
                      <div className="developer-policy-grid">
                        <label className="field-block">
                          <span>Policy Number</span>
                          <InputText value={row.settingNumber} placeholder="AS003, HWS001" onChange={(event) => updateDraftRow(row.rowId, { settingNumber: event.target.value })} />
                        </label>
                        <label className="field-block">
                          <span>Policy Title</span>
                          <InputText value={row.title} placeholder="Console idle timeout" onChange={(event) => updateDraftRow(row.rowId, { title: event.target.value })} />
                        </label>
                        <label className="field-block full-span">
                          <span>Expected Config</span>
                          <InputTextarea value={row.expectedConfig} rows={3} autoResize placeholder="Paste the expected configuration rule or policy payload." onChange={(event) => updateDraftRow(row.rowId, { expectedConfig: event.target.value })} />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="developer-submit-row">
                  <span>{validRows.length} ready to onboard</span>
                  <Button label={editingPolicy ? "Save Policy" : "Submit Policy Settings"} icon="pi pi-check" disabled={validRows.length === 0} loading={submitting} onClick={onboardPolicies} />
                </div>
              </Card>
            )}
          </div>
        </AccordionTab>
      </Accordion>

      <Dialog header="Policy Details" visible={Boolean(detailPolicy)} modal style={{ width: "min(760px, calc(100vw - 32px))" }} onHide={() => setDetailPolicy(null)}>
        {detailPolicy && (
          <div className="developer-policy-modal">
            <div className="developer-modal-heading">
              <div>
                <PolicyChip setting={detailPolicy} />
              </div>
              <div className="developer-heading-actions">
                <Button label="Edit" icon="pi pi-pencil" outlined onClick={() => startEditPolicy(detailPolicy)} />
                <Button label="Delete" icon="pi pi-trash" severity="danger" loading={deletingId === (detailPolicy.id || detailPolicy.settingNumber)} onClick={() => deletePolicy(detailPolicy)} />
              </div>
            </div>
            <div className="developer-detail-grid">
              <div className="meta-tile"><span>Updated</span><strong>{policyUpdatedAt(detailPolicy)}</strong></div>
              <div className="meta-tile"><span>By</span><strong>{policyUpdatedBy(detailPolicy)}</strong></div>
            </div>
            <div className="agreed-setting-box">
              <strong>Expected Config</strong>
              <pre>{detailPolicy.settingPayload || "No expected configuration captured."}</pre>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog header="Process Policy Document" visible={documentDialogOpen} modal style={{ width: "min(620px, calc(100vw - 32px))" }} onHide={() => !documentProcessing && setDocumentDialogOpen(false)}>
        <div className="document-process-dialog">
          <label className="developer-upload-drop document-upload-target">
            <i className="pi pi-file-word" />
            <strong>{documentFile ? documentFile.name : "Choose a Word document"}</strong>
            <span>The backend will scan for policy numbers, titles, and expected config text. Nothing is saved until you submit the staged rows.</span>
            <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={documentProcessing} onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)} />
          </label>
          {documentError && <div className="document-process-error"><i className="pi pi-exclamation-triangle" /><span>{documentError}</span></div>}
          <div className="developer-submit-row">
            <Button label="Cancel" outlined severity="secondary" disabled={documentProcessing} onClick={() => setDocumentDialogOpen(false)} />
            <Button label="Process Document" icon="pi pi-cog" loading={documentProcessing} disabled={!documentFile || !onExtractDocument} onClick={processDocument} />
          </div>
        </div>
      </Dialog>
    </section>
  );
}
