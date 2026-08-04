import React from "react";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Tag } from "primereact/tag";

import { formatDate } from "./helpers";
import { PageHeader } from "./sharedUi";
import type { PolicySetting } from "./types";

type DraftPolicyRow = {
  rowId: string;
  sourceUuid: string;
  settingNumber: string;
  title: string;
  expectedConfigType: string;
  expectedConfig: string;
  actualConfigExample: string;
  riskTag: string;
};

const expectedConfigTypes = ["Must exist", "Must not exist", "Must equal", "Regex match", "Manual review"];

function createDraftRow(): DraftPolicyRow {
  return {
    rowId: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    sourceUuid: "",
    settingNumber: "",
    title: "",
    expectedConfigType: "Must exist",
    expectedConfig: "",
    actualConfigExample: "",
    riskTag: "",
  };
}

function normalizePolicyNumber(value: string) {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

function toPolicySetting(row: DraftPolicyRow): PolicySetting {
  const settingNumber = normalizePolicyNumber(row.settingNumber);
  return {
    id: settingNumber,
    sourceUuid: row.sourceUuid.trim(),
    settingNumber,
    title: row.title.trim() || settingNumber,
    settingPayload: row.expectedConfig.trim(),
    actualConfigExample: row.actualConfigExample.trim(),
    expectedConfigType: row.expectedConfigType,
    riskTag: row.riskTag.trim(),
    standard: row.expectedConfigType,
    description: row.riskTag.trim(),
    createdAt: formatDate(new Date()),
  };
}

function PolicyChip({ setting }: { setting: PolicySetting }) {
  return (
    <span className="policy-chip-line">
      <Tag className="policy-id-tag" value={setting.settingNumber || setting.id} rounded />
      <span>{setting.title}</span>
    </span>
  );
}

export function DeveloperConsolePage({ policySettings, setPolicySettings }: { policySettings: PolicySetting[]; setPolicySettings: React.Dispatch<React.SetStateAction<PolicySetting[]>> }) {
  const [draftRows, setDraftRows] = React.useState<DraftPolicyRow[]>([createDraftRow()]);
  const [filter, setFilter] = React.useState("");
  const [selectedPolicy, setSelectedPolicy] = React.useState<PolicySetting | null>(policySettings[0] ?? null);
  const validRows = draftRows.filter((row) => normalizePolicyNumber(row.settingNumber) && row.expectedConfig.trim());
  const filteredPolicies = policySettings.filter((setting) => {
    const haystack = [setting.id, setting.settingNumber, setting.title, setting.sourceUuid, setting.expectedConfigType, setting.settingPayload, setting.actualConfigExample].join(" ").toLowerCase();
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

  const onboardPolicies = () => {
    const nextPolicies = validRows.map(toPolicySetting);
    setPolicySettings((current) => {
      const byId = new Map(current.map((setting) => [setting.id, setting]));
      nextPolicies.forEach((setting) => byId.set(setting.id, setting));
      return Array.from(byId.values()).sort((a, b) => (a.settingNumber || a.id).localeCompare(b.settingNumber || b.id));
    });
    setDraftRows([createDraftRow()]);
  };

  return (
    <section className="page-content developer-console-page">
      <PageHeader title="Developer Console" subtitle="Onboard policy settings, inspect source mappings, and prepare policy IDs before fixes are exposed to engineers." />

      <div className="developer-console-layout">
        <Card className="editor-card developer-intake-card">
          <div className="developer-card-heading">
            <div>
              <h2>Policy Intake</h2>
              <p>Add source UUIDs and policy numbers in batches. Existing policy numbers are overwritten so developers can correct a source row without editing code.</p>
            </div>
            <Button label="Add Row" icon="pi pi-plus" outlined onClick={() => setDraftRows((rows) => [...rows, createDraftRow()])} />
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
                    <span>Source UUID</span>
                    <InputText value={row.sourceUuid} placeholder="Document/source UUID" onChange={(event) => updateDraftRow(row.rowId, { sourceUuid: event.target.value })} />
                  </label>
                  <label className="field-block">
                    <span>Policy Number</span>
                    <InputText value={row.settingNumber} placeholder="AS003, HWS-001" onChange={(event) => updateDraftRow(row.rowId, { settingNumber: event.target.value })} />
                  </label>
                  <label className="field-block">
                    <span>Policy Title</span>
                    <InputText value={row.title} placeholder="Console idle timeout" onChange={(event) => updateDraftRow(row.rowId, { title: event.target.value })} />
                  </label>
                  <label className="field-block">
                    <span>Expected Config Type</span>
                    <Dropdown value={row.expectedConfigType} options={expectedConfigTypes} onChange={(event) => updateDraftRow(row.rowId, { expectedConfigType: event.value })} />
                  </label>
                  <label className="field-block full-span">
                    <span>Expected Config</span>
                    <InputTextarea value={row.expectedConfig} rows={3} autoResize placeholder="Paste the expected configuration rule or policy payload." onChange={(event) => updateDraftRow(row.rowId, { expectedConfig: event.target.value })} />
                  </label>
                  <label className="field-block full-span">
                    <span>Actual Config Example</span>
                    <InputTextarea value={row.actualConfigExample} rows={3} autoResize placeholder="Optional sample from the device config snapshot or scan payload." onChange={(event) => updateDraftRow(row.rowId, { actualConfigExample: event.target.value })} />
                  </label>
                  <label className="field-block full-span">
                    <span>Generic Risk / Capability Tag</span>
                    <InputText value={row.riskTag} placeholder="Simple one-line remediation, config-only validation, manual-review candidate..." onChange={(event) => updateDraftRow(row.rowId, { riskTag: event.target.value })} />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="developer-submit-row">
            <span>{validRows.length} ready to onboard</span>
            <Button label="Onboard Policy Settings" icon="pi pi-check" disabled={validRows.length === 0} onClick={onboardPolicies} />
          </div>
        </Card>

        <Card className="editor-card developer-upload-card">
          <div className="developer-card-heading">
            <div>
              <h2>Experimental Document Upload</h2>
              <p>Use this as a future intake slot for `.docx` policy documents. Parsing should be handled server-side before it writes into the same policy setting table.</p>
            </div>
          </div>
          <label className="developer-upload-drop">
            <i className="pi pi-file-word" />
            <strong>Drop-in parser placeholder</strong>
            <span>Accepts `.docx` selection for now; extraction is intentionally not executed in the browser.</span>
            <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
          </label>
        </Card>
      </div>

      <Card className="table-card developer-policy-table">
        <div className="template-directory-toolbar">
          <span className="p-input-icon-left grow-input">
            <i className="pi pi-search" />
            <InputText value={filter} placeholder="Filter by policy number, UUID, title, config text..." onChange={(event) => setFilter(event.target.value)} />
          </span>
          <Tag value={`${filteredPolicies.length} policies`} severity="info" rounded />
        </div>
        <DataTable value={filteredPolicies} selectionMode="single" selection={selectedPolicy} onSelectionChange={(event) => setSelectedPolicy(event.value as PolicySetting)} dataKey="id" paginator rows={8} emptyMessage="No policy settings onboarded yet.">
          <Column header="Policy" body={(row: PolicySetting) => <PolicyChip setting={row} />} sortable sortField="settingNumber" />
          <Column header="Source UUID" field="sourceUuid" body={(row: PolicySetting) => row.sourceUuid || "Not provided"} />
          <Column header="Expected Type" field="expectedConfigType" body={(row: PolicySetting) => <Tag value={row.expectedConfigType || row.standard || "Unspecified"} severity="secondary" rounded />} />
          <Column header="Updated" field="createdAt" />
        </DataTable>
      </Card>

      {selectedPolicy && (
        <Card className="device-detail-card developer-policy-detail">
          <div className="developer-card-heading">
            <div>
              <h2><PolicyChip setting={selectedPolicy} /></h2>
              <p>{selectedPolicy.sourceUuid ? `Source UUID: ${selectedPolicy.sourceUuid}` : "No source UUID linked yet."}</p>
            </div>
            <Tag value={selectedPolicy.expectedConfigType || selectedPolicy.standard || "Unspecified"} severity="info" rounded />
          </div>
          <div className="developer-detail-grid">
            <div className="agreed-setting-box">
              <strong>Expected Config</strong>
              <pre>{selectedPolicy.settingPayload || "No expected configuration captured."}</pre>
            </div>
            <div className="agreed-setting-box">
              <strong>Actual Config Example</strong>
              <pre>{selectedPolicy.actualConfigExample || "No actual configuration example captured."}</pre>
            </div>
          </div>
          {selectedPolicy.riskTag && <div className="guardrail-box"><strong>Governance note</strong><p>{selectedPolicy.riskTag}</p></div>}
        </Card>
      )}
    </section>
  );
}
