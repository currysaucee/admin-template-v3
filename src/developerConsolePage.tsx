import React from "react";
import { Accordion, AccordionTab } from "primereact/accordion";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Checkbox } from "primereact/checkbox";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Tag } from "primereact/tag";

import { formatDate, formatDateTime } from "./helpers";
import { PageHeader } from "./sharedUi";
import type { DeploymentQueueItem, PolicyLookupResult, PolicySetting } from "./types";

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
  const text = value.trim().replace(/\s+/g, "").toUpperCase();
  const match = text.match(/^([A-Z]{1,8})[-_]?0*(\d{1,4})$/);
  return match ? `${match[1]}${Number(match[2]).toString().padStart(3, "0")}` : text;
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
      <Tag className="policy-id-tag" value={`${setting.settingNumber || setting.id}${(setting.variantNumber ?? 1) > 1 ? ` · V${setting.variantNumber}` : ""}`} rounded />
      <span>{setting.title}</span>
    </span>
  );
}

export function DeveloperConsolePage({
  policySettings,
  deploymentQueue = [],
  setPolicySettings,
  onOnboardPolicySettings,
  onLookupPolicySetting,
  onDeletePolicySetting,
  onExtractDocument,
  onRunScanImport,
  scanImportRunning = false,
  scanImportMessage = "",
  lastScanAt = "",
}: {
  policySettings: PolicySetting[];
  deploymentQueue?: DeploymentQueueItem[];
  setPolicySettings: React.Dispatch<React.SetStateAction<PolicySetting[]>>;
  onOnboardPolicySettings?: (policySettings: PolicySetting[]) => Promise<PolicySetting[]>;
  onLookupPolicySetting?: (settingNumber: string) => Promise<PolicyLookupResult>;
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
  const [policyLookups, setPolicyLookups] = React.useState<Record<string, PolicyLookupResult | undefined>>({});
  const [lookupLoading, setLookupLoading] = React.useState<Record<string, boolean>>({});
  const [variantAcknowledged, setVariantAcknowledged] = React.useState<Record<string, boolean>>({});
  const [submitError, setSubmitError] = React.useState("");
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
  const capturedExecutorResponses = deploymentQueue.filter((item) => item.result && typeof item.result === "object" && Object.keys(item.result as object).length > 0);
  const rowHasDuplicateConfig = (row: DraftPolicyRow) => Boolean(policyLookups[row.rowId]?.variants.some((variant) => variant.settingPayload.trim() === row.expectedConfig.trim()));
  const cannotSubmit = validRows.length === 0 || validRows.some((row) => {
    const lookup = policyLookups[row.rowId];
    const lookupPending = Boolean(onLookupPolicySetting && (!lookup || lookup.settingNumber !== normalizePolicyNumber(row.settingNumber)));
    return lookupPending || lookupLoading[row.rowId] || rowHasDuplicateConfig(row) || Boolean(lookup?.exists && !variantAcknowledged[row.rowId]);
  });

  React.useEffect(() => {
    if (!showIntake || !onLookupPolicySetting) return;
    const timer = window.setTimeout(() => {
      draftRows.forEach((row) => {
        const settingNumber = normalizePolicyNumber(row.settingNumber);
        if (!settingNumber) return;
        setLookupLoading((current) => ({ ...current, [row.rowId]: true }));
        onLookupPolicySetting(settingNumber)
          .then((lookup) => setPolicyLookups((current) => ({ ...current, [row.rowId]: lookup })))
          .catch(() => setPolicyLookups((current) => ({ ...current, [row.rowId]: undefined })))
          .finally(() => setLookupLoading((current) => ({ ...current, [row.rowId]: false })));
      });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [draftRows.map((row) => row.settingNumber).join("|"), onLookupPolicySetting, showIntake]);

  const updateDraftRow = (rowId: string, patch: Partial<DraftPolicyRow>) => {
    setDraftRows((rows) => rows.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)));
  };

  const removeDraftRow = (rowId: string) => {
    setDraftRows((rows) => (rows.length === 1 ? rows : rows.filter((row) => row.rowId !== rowId)));
  };

  const onboardPolicies = async () => {
    const nextPolicies = validRows.map((row) => ({ ...toPolicySetting(row), confirmNewVariant: Boolean(policyLookups[row.rowId]?.exists && variantAcknowledged[row.rowId]) }));
    setSubmitting(true);
    setSubmitError("");
    try {
      if (onOnboardPolicySettings) {
        const savedPolicies = await onOnboardPolicySettings(nextPolicies);
        setPolicySettings(savedPolicies);
      } else {
        setPolicySettings((current) => mergePolicySettings(current, nextPolicies));
      }
      setDraftRows([createDraftRow()]);
      setShowIntake(false);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to onboard the policy.");
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
    setPolicyLookups({});
    setVariantAcknowledged({});
    setSubmitError("");
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

            <Dialog header={editingPolicy ? "Create Policy Variant" : "Onboard New Policy"} visible={showIntake} modal style={{ width: "min(900px, calc(100vw - 32px))" }} onHide={() => !submitting && setShowIntake(false)}>
              <div className="developer-intake-card">
                <div className="developer-card-heading">
                  <div>
                    <h2>{editingPolicy ? "Create a new policy variant" : "Policy details"}</h2>
                    <p>Existing policies are preserved. Reusing a policy number creates a separately auditable variant.</p>
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
                          <InputText value={row.settingNumber} placeholder="AS003, HWS001" onChange={(event) => { updateDraftRow(row.rowId, { settingNumber: event.target.value }); setPolicyLookups((current) => ({ ...current, [row.rowId]: undefined })); setVariantAcknowledged((current) => ({ ...current, [row.rowId]: false })); }} />
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
                      {lookupLoading[row.rowId] && <div className="policy-lookup-state"><i className="pi pi-spin pi-spinner" /> Checking existing policy and templates…</div>}
                      {!lookupLoading[row.rowId] && policyLookups[row.rowId]?.exists && (
                        <div className="policy-variant-warning">
                          <div><strong>{policyLookups[row.rowId]?.settingNumber} already exists</strong><span>Submitting will create variant {policyLookups[row.rowId]?.nextVariant}; previous variants and their ticket history will remain unchanged.</span></div>
                          <div className="policy-existing-summary">
                            <span>Current expected configuration</span>
                            <pre>{policyLookups[row.rowId]?.currentPolicy?.settingPayload}</pre>
                            <span>Related fix templates</span>
                            <strong>{policyLookups[row.rowId]?.templates.length ? policyLookups[row.rowId]?.templates.map((template) => template.findingName || template.key).join(", ") : "No related fix template"}</strong>
                          </div>
                          {rowHasDuplicateConfig(row) ? <div className="policy-duplicate-error">Expected configuration must differ from every existing variant.</div> : (
                            <label className="variant-confirmation"><Checkbox checked={Boolean(variantAcknowledged[row.rowId])} onChange={(event) => setVariantAcknowledged((current) => ({ ...current, [row.rowId]: Boolean(event.checked) }))} /><span>I understand this creates a new policy variant and does not replace the existing policy.</span></label>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="developer-submit-row">
                  <span>{submitError || `${validRows.length} ready to onboard`}</span>
                  <Button label={editingPolicy ? "Create Variant" : "Submit Policy Settings"} icon="pi pi-check" disabled={cannotSubmit} loading={submitting} onClick={onboardPolicies} />
                </div>
              </div>
            </Dialog>
          </div>
        </AccordionTab>

        <AccordionTab header={<span className="developer-section-title"><i className="pi pi-code" /> Executor Response Inspector</span>}>
          <div className="developer-section-body">
            <div className="developer-operation-row">
              <div><h2>Captured executor responses</h2><p className="section-subtitle">Exact responses stored by the queue worker and linked to their HCC request.</p></div>
              <Tag value={`${capturedExecutorResponses.length} captured`} severity={capturedExecutorResponses.length ? "info" : "secondary"} rounded />
            </div>
            {capturedExecutorResponses.length === 0 ? <div className="empty-row">No executor response has been captured yet.</div> : (
              <div className="executor-response-list">
                {capturedExecutorResponses.map((item) => (
                  <details key={item.queueId} className="executor-response-item">
                    <summary><div><strong>{item.ticketId}</strong><span>{item.queueId} · {formatDateTime(item.completedAt || item.startedAt)}</span></div><Tag value={item.status} severity={item.status === "Complete" ? "success" : item.status === "Failed" ? "danger" : "secondary"} rounded /></summary>
                    <pre>{JSON.stringify(item.result, null, 2)}</pre>
                  </details>
                ))}
              </div>
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
                <Button label="Create New Variant" icon="pi pi-copy" outlined onClick={() => startEditPolicy(detailPolicy)} />
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
