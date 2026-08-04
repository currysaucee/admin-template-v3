import React from "react";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Tag } from "primereact/tag";

import { formatDate } from "./helpers";
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

function toPolicySetting(row: DraftPolicyRow): PolicySetting {
  const settingNumber = normalizePolicyNumber(row.settingNumber);
  return {
    id: settingNumber,
    settingNumber,
    title: row.title.trim() || settingNumber,
    settingPayload: row.expectedConfig.trim(),
    standard: derivePolicyType(row.title, row.expectedConfig),
    description: "",
    createdAt: formatDate(new Date()),
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
}: {
  policySettings: PolicySetting[];
  setPolicySettings: React.Dispatch<React.SetStateAction<PolicySetting[]>>;
  onOnboardPolicySettings?: (policySettings: PolicySetting[]) => Promise<PolicySetting[]>;
  onDeletePolicySetting?: (policySettingId: string) => Promise<PolicySetting[]>;
  onExtractDocument?: (document: File) => Promise<PolicySetting[]>;
}) {
  const [draftRows, setDraftRows] = React.useState<DraftPolicyRow[]>([createDraftRow()]);
  const [filter, setFilter] = React.useState("");
  const [selectedPolicy, setSelectedPolicy] = React.useState<PolicySetting | null>(policySettings[0] ?? null);
  const [submitting, setSubmitting] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState("");
  const [documentDialogOpen, setDocumentDialogOpen] = React.useState(false);
  const [documentFile, setDocumentFile] = React.useState<File | null>(null);
  const [documentProcessing, setDocumentProcessing] = React.useState(false);
  const [documentError, setDocumentError] = React.useState("");
  const validRows = draftRows.filter((row) => normalizePolicyNumber(row.settingNumber) && row.expectedConfig.trim());
  const filteredPolicies = policySettings.filter((setting) => {
    const haystack = [setting.id, setting.settingNumber, setting.title, setting.standard, setting.settingPayload].join(" ").toLowerCase();
    return haystack.includes(filter.trim().toLowerCase());
  });

  React.useEffect(() => {
    if (!selectedPolicy || !policySettings.some((setting) => setting.id === selectedPolicy.id)) {
      setSelectedPolicy(policySettings[0] ?? null);
    }
  }, [policySettings, selectedPolicy]);

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
    } finally {
      setSubmitting(false);
    }
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
        setDocumentError("No policy rows were detected. Check that the document contains policy numbers such as AS003 or HWS-001.");
        return;
      }
      setDraftRows((rows) => {
        const filledRows = rows.filter((row) => normalizePolicyNumber(row.settingNumber) || row.title.trim() || row.expectedConfig.trim());
        return [...filledRows, ...extractedRows];
      });
      setDocumentDialogOpen(false);
      setDocumentFile(null);
    } catch (error) {
      setDocumentError(error instanceof Error ? error.message : "Unable to process document.");
    } finally {
      setDocumentProcessing(false);
    }
  };

  return (
    <section className="page-content developer-console-page">
      <PageHeader title="Developer Console" subtitle="Onboard policy settings, inspect policy mappings, and prepare policy IDs before fixes are exposed to engineers." />

      <div className="developer-console-layout">
        <Card className="editor-card developer-intake-card">
          <div className="developer-card-heading">
            <div>
              <h2>Policy Intake</h2>
              <p>Add policy settings in batches. Existing policy numbers are overwritten so developers can correct a policy row without editing code.</p>
            </div>
            <div className="developer-heading-actions">
              <Button label="Process Document" icon="pi pi-file-word" outlined onClick={() => setDocumentDialogOpen(true)} />
              <Button label="Add Row" icon="pi pi-plus" outlined onClick={() => setDraftRows((rows) => [...rows, createDraftRow()])} />
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
                    <InputText value={row.settingNumber} placeholder="AS003, HWS-001" onChange={(event) => updateDraftRow(row.rowId, { settingNumber: event.target.value })} />
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
            <Button label="Onboard Policy Settings" icon="pi pi-check" disabled={validRows.length === 0} loading={submitting} onClick={onboardPolicies} />
          </div>
        </Card>

      </div>

      <Card className="table-card developer-policy-table">
        <div className="template-directory-toolbar">
          <span className="p-input-icon-left grow-input">
            <i className="pi pi-search" />
            <InputText value={filter} placeholder="Filter by policy number, type, title, config text..." onChange={(event) => setFilter(event.target.value)} />
          </span>
          <Tag value={`${filteredPolicies.length} policies`} severity="info" rounded />
        </div>
        <DataTable value={filteredPolicies} selectionMode="single" selection={selectedPolicy} onSelectionChange={(event) => setSelectedPolicy(event.value as PolicySetting)} dataKey="id" paginator rows={8} emptyMessage="No policy settings onboarded yet.">
          <Column header="Policy" body={(row: PolicySetting) => <PolicyChip setting={row} />} sortable sortField="settingNumber" />
          <Column header="Policy Type" field="standard" body={(row: PolicySetting) => <Tag value={row.standard || derivePolicyType(row.title, row.settingPayload)} severity="secondary" rounded />} />
          <Column header="Updated" field="createdAt" />
          <Column header="Actions" body={(row: PolicySetting) => <Button icon="pi pi-trash" rounded text severity="danger" aria-label={`Delete ${row.settingNumber || row.id}`} loading={deletingId === (row.id || row.settingNumber)} onClick={() => deletePolicy(row)} />} />
        </DataTable>
      </Card>

      {selectedPolicy && (
        <Card className="device-detail-card developer-policy-detail">
          <div className="developer-card-heading">
            <div>
              <h2><PolicyChip setting={selectedPolicy} /></h2>
              <p>{selectedPolicy.standard || derivePolicyType(selectedPolicy.title, selectedPolicy.settingPayload)}</p>
            </div>
            <Tag value={selectedPolicy.standard || derivePolicyType(selectedPolicy.title, selectedPolicy.settingPayload)} severity="info" rounded />
          </div>
          <div className="agreed-setting-box">
            <strong>Expected Config</strong>
            <pre>{selectedPolicy.settingPayload || "No expected configuration captured."}</pre>
          </div>
        </Card>
      )}

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
