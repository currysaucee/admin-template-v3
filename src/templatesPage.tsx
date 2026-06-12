import React, { useState } from "react";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Card } from "primereact/card";
import { Divider } from "primereact/divider";
import { AutoComplete, AutoCompleteCompleteEvent } from "primereact/autocomplete";
import { Dropdown } from "primereact/dropdown";

import type { PolicySetting, RemediationTemplate, TemplateRequest } from "./types";
import { formatDate, getTemplatePolicySetting } from "./helpers";
import { TemplateExecutionPreview } from "./remediationViews";
import { MetaTile, PageHeader } from "./sharedUi";

const defaultHardwareTypeOptions = [
  "Arista Switch",
  "Cisco Switch",
  "Cisco Router",
  "Juniper Switch",
  "Juniper Router",
  "Fortinet Firewall",
  "Palo Alto Firewall",
  "F5 Load Balancer",
  "Network Switch",
  "Network Router",
  "Network Firewall",
  "Wireless Controller",
  "Load Balancer",
];

function filterOptions(options: string[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return options;
  return options.filter((option) => option.toLowerCase().includes(normalizedQuery));
}

export function TemplatePage({ templates, setTemplates, setTemplateRequests, policySettings, onRequestSubmitted }: { templates: RemediationTemplate[]; setTemplates: React.Dispatch<React.SetStateAction<RemediationTemplate[]>>; setTemplateRequests: React.Dispatch<React.SetStateAction<TemplateRequest[]>>; policySettings: PolicySetting[]; onRequestSubmitted: () => void }) {
  const hardwareTypeOptions = Array.from(new Set([...defaultHardwareTypeOptions, ...templates.flatMap((template) => template.hardwareTypes)])).sort();
  const [selectedKey, setSelectedKey] = useState(templates[0]?.key ?? "");
  const [viewMode, setViewMode] = useState<"list" | "detail" | "edit" | "create">("list");
  const [search, setSearch] = useState("");
  const selectedTemplate = templates.find((template) => template.key === selectedKey) ?? templates[0];
  const [draftImplementationCommands, setDraftImplementationCommands] = useState<string[]>(selectedTemplate?.implementationCommands ?? []);
  const [draftFailureBehaviour, setDraftFailureBehaviour] = useState(selectedTemplate?.failureBehaviour ?? "");
  const [draftTemplateKey, setDraftTemplateKey] = useState(selectedTemplate?.key ?? "");
  const [draftPolicySettingId, setDraftPolicySettingId] = useState(selectedTemplate?.policySettingId ?? policySettings[0]?.id ?? "");
  const [draftHardwareTypes, setDraftHardwareTypes] = useState<string[]>(selectedTemplate?.hardwareTypes ?? []);
  const [draftRequestComment, setDraftRequestComment] = useState("");
  const [hardwareTypeSuggestions, setHardwareTypeSuggestions] = useState<string[]>(hardwareTypeOptions);
  const [draftMeta, setDraftMeta] = useState({ findingName: selectedTemplate?.findingName ?? "", standard: selectedTemplate?.standard ?? "" });
  const filteredTemplates = templates.filter((template) => template.approvalStatus === "Approved").filter((template) => {
    const policySetting = getTemplatePolicySetting(template, policySettings);
    return `${template.findingName} ${policySetting?.title ?? ""} ${policySetting?.settingPayload ?? template.agreedSetting} ${template.hardwareTypes.join(" ")} ${template.standard} ${template.key}`.toLowerCase().includes(search.toLowerCase());
  });

  const loadDraft = (template: RemediationTemplate) => {
    setSelectedKey(template.key);
    setDraftTemplateKey(template.key);
    setDraftPolicySettingId(template.policySettingId ?? "");
    setDraftMeta({ findingName: template.findingName, standard: template.standard });
    setDraftHardwareTypes(template.hardwareTypes);
    setDraftImplementationCommands(template.implementationCommands);
    setDraftFailureBehaviour(template.failureBehaviour);
  };

  const selectTemplate = (template: RemediationTemplate) => {
    loadDraft(template);
    setViewMode("detail");
  };

  const beginEdit = (template: RemediationTemplate) => {
    loadDraft(template);
    setViewMode("edit");
  };

  const saveTemplate = () => {
    const selectedPolicySetting = policySettings.find((setting) => setting.id === draftPolicySettingId);
    const inferredKey = `${draftMeta.findingName}_${draftHardwareTypes[0] ?? "Hardware"}`
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    const nextKey = selectedKey.startsWith("CUSTOM_") ? inferredKey || selectedKey : draftTemplateKey.trim() || selectedKey;
    setTemplates((prev) => prev.map((template) => template.key === selectedKey ? { ...template, ...draftMeta, key: nextKey,
          policySettingId: draftPolicySettingId || undefined, agreedSetting: selectedPolicySetting?.settingPayload ?? template.agreedSetting,
          standard: selectedPolicySetting?.standard ?? draftMeta.standard, hardwareTypes: draftHardwareTypes.map((item) => item.trim()).filter(Boolean), preChecks: [], implementationCommands: draftImplementationCommands.map((command) => command.trim()).filter(Boolean), postChecks: [], failureBehaviour: draftFailureBehaviour.trim(), updatedAt: formatDate(new Date()) } : template));
    setSelectedKey(nextKey);
    setViewMode("detail");
  };

  const startCreateTemplate = () => {
    const defaultSetting = policySettings[0];
    setSelectedKey("");
    setDraftTemplateKey("");
    setDraftPolicySettingId(defaultSetting?.id ?? "");
    setDraftMeta({ findingName: "", standard: defaultSetting?.standard ?? "policy setting" });
    setDraftHardwareTypes([]);
    setDraftImplementationCommands([""]);
    setDraftFailureBehaviour("Implementation commands are reviewed by the SME before approval.");
    setDraftRequestComment("");
    setViewMode("create");
  };

  const submitTemplateRequest = () => {
    const selectedPolicySetting = policySettings.find((setting) => setting.id === draftPolicySettingId);
    const submittedAt = formatDate(new Date());
    const inferredKey = `${draftMeta.findingName || "New Finding Template"}_${draftHardwareTypes[0] ?? "Hardware"}_${Date.now()}`
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    const nextTemplate: RemediationTemplate = {
      key: inferredKey,
      policySettingId: draftPolicySettingId || undefined,
      findingName: draftMeta.findingName.trim() || "New Finding Template",
      agreedSetting: selectedPolicySetting?.settingPayload ?? "",
      standard: selectedPolicySetting?.standard ?? draftMeta.standard,
      hardwareTypes: draftHardwareTypes.map((item) => item.trim()).filter(Boolean),
      preChecks: [],
      implementationCommands: draftImplementationCommands.map((command) => command.trim()).filter(Boolean),
      postChecks: [],
      failureBehaviour: draftFailureBehaviour.trim(),
      approvalStatus: "Pending Approval",
      updatedAt: submittedAt,
    };
    const nextRequest: TemplateRequest = {
      id: `FTR-${String(2050 + templates.length).padStart(4, "0")}`,
      templateKey: nextTemplate.key,
      findingName: nextTemplate.findingName,
      hardwareType: nextTemplate.hardwareTypes.join(", "),
      policySettingTitle: selectedPolicySetting ? `${selectedPolicySetting.settingNumber} - ${selectedPolicySetting.title}` : "No policy setting linked",
      requestor: "Current User",
      submitterComment: draftRequestComment.trim(),
      status: "Pending Approval",
      submittedAt,
      reviewNote: "Pending SME decision.",
    };
    setTemplates((prev) => [nextTemplate, ...prev]);
    setTemplateRequests((prev) => [nextRequest, ...prev]);
    onRequestSubmitted();
  };

  if (viewMode === "detail" && selectedTemplate) {
    const selectedPolicySetting = getTemplatePolicySetting(selectedTemplate, policySettings);
    return (
      <section className="page-content">
        <div className="detail-header-row">
          <PageHeader title="Fix Template Detail" subtitle="Review the runtime template before making changes." />
          <div className="detail-actions">
            <Button label="Back to Templates" icon="pi pi-arrow-left" outlined onClick={() => setViewMode("list")} />
            <Button label="Edit Template" icon="pi pi-pencil" onClick={() => beginEdit(selectedTemplate)} />
          </div>
        </div>
        <Card className="editor-card template-detail-page">
          <div className="template-editor-heading">
            <div>
              <h2>{selectedTemplate.findingName}</h2>
            </div>
          </div>
          <div className="template-detail-meta">
            <MetaTile label="Hardware Type" value={selectedTemplate.hardwareTypes.join(", ")} />
            <MetaTile label="Policy Setting" value={selectedPolicySetting ? `${selectedPolicySetting.settingNumber} - ${selectedPolicySetting.title}` : "Not linked"} />
            <MetaTile label="Status" value={selectedTemplate.approvalStatus} />
            <MetaTile label="Updated" value={selectedTemplate.updatedAt} />
          </div>
          <TemplateExecutionPreview template={selectedTemplate} policySetting={selectedPolicySetting} mode="implementation" />
        </Card>
      </section>
    );
  }

  if ((viewMode === "edit" && selectedTemplate) || viewMode === "create") {
    const selectedPolicySetting = policySettings.find((setting) => setting.id === draftPolicySettingId);
    const isCreating = viewMode === "create";
    return (
      <section className="page-content">
        <div className="detail-header-row">
          <PageHeader title={isCreating ? "Create New Fix Template" : "Edit Fix Template"} subtitle="Select the Policy Setting, then configure the exact implementation commands for this remediation." />
          {!isCreating && <div className="detail-actions">
            <Button label="Back to Templates" icon="pi pi-arrow-left" outlined onClick={() => setViewMode("list")} />
            <Button label="Update Template" icon="pi pi-save" onClick={saveTemplate} />
          </div>}
        </div>
        <Card className="editor-card template-edit-page">
          <div className="template-editor-heading"><h2>{draftMeta.findingName || "New Fix Template"}</h2><p>{isCreating ? "Draft request" : draftTemplateKey || selectedTemplate?.key}</p></div>
          <div className="template-editor-stack">
            <div className="form-grid">
              <div className="field-block full-span">
                <label>Finding Name</label>
                <InputText value={draftMeta.findingName} onChange={(e) => setDraftMeta((prev) => ({ ...prev, findingName: e.target.value }))} placeholder="Type the template display name" />
              </div>
              <div className="field-block full-span">
                <label>Policy Setting</label>
                <Dropdown
                  className="policy-setting-dropdown"
                  value={draftPolicySettingId}
                  options={policySettings}
                  optionLabel="title"
                  optionValue="id"
                  filter
                  panelClassName="policy-setting-dropdown-panel"
                  placeholder="Select policy setting"
                  onChange={(event) => {
                    const setting = policySettings.find((item) => item.id === event.value);
                    setDraftPolicySettingId(event.value);
                    if (setting) {
                      setDraftMeta((prev) => ({ ...prev, standard: setting.standard }));
                    }
                  }}
                  itemTemplate={(setting: PolicySetting) => <span>{setting.settingNumber} - {setting.title}</span>}
                  valueTemplate={(setting?: PolicySetting) => setting ? <span>{setting.settingNumber} - {setting.title}</span> : <span>Select policy setting</span>}
                />
                <small className="muted-note">Select a setting from the policy source payload.</small>
                {selectedPolicySetting && <small className="muted-note">Mapped from policy source: {selectedPolicySetting.settingNumber} - {selectedPolicySetting.title}</small>}
              </div>
              <div className="field-block">
                <label>Hardware Type</label>
                <AutoComplete
                  value={draftHardwareTypes}
                  suggestions={hardwareTypeSuggestions}
                  completeMethod={(event: AutoCompleteCompleteEvent) => setHardwareTypeSuggestions(filterOptions(hardwareTypeOptions, event.query))}
                  onChange={(e) => setDraftHardwareTypes(e.value)}
                  multiple
                  dropdown
                  forceSelection={false}
                  placeholder="Search hardware type"
                />
              </div>
            </div>
            <Divider />
            <CommandRowsEditor title="Implementation Commands" commands={draftImplementationCommands} setCommands={setDraftImplementationCommands} addLabel="Add implementation command" />
            {isCreating && <div className="field-block"><label>Request Comment</label><InputTextarea value={draftRequestComment} onChange={(event) => setDraftRequestComment(event.target.value)} rows={3} autoResize placeholder="Explain what the SME should review and why this template is needed" /></div>}
          </div>
          {isCreating && <div className="template-submit-footer"><Button label="Submit Template Request" icon="pi pi-send" onClick={submitTemplateRequest} disabled={!draftMeta.findingName.trim() || draftHardwareTypes.length === 0 || draftImplementationCommands.every((command) => !command.trim()) || !draftRequestComment.trim()} /></div>}
        </Card>
      </section>
    );
  }

  return (
    <section className="page-content">
      <PageHeader title="Fix Templates" subtitle="Templates are tied to an onboarded Policy Setting and hardware type during ticket creation." />
      <Card className="table-card template-directory">
        <div className="template-directory-toolbar">
          <span className="p-input-icon-left grow-input">
            <i className="pi pi-search" />
            <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search findings, Policy Settings, hardware types..." />
          </span>
          <Button label="New Template" icon="pi pi-plus" onClick={startCreateTemplate} />
        </div>
        <div className="template-card-list">
          {filteredTemplates.map((template) => (
            <button key={template.key} className="template-list-row" onClick={() => selectTemplate(template)}>
              <div>
                <strong>{template.findingName}</strong>
                <span>{(() => { const setting = getTemplatePolicySetting(template, policySettings); return setting ? `Policy ${setting.settingNumber} - ${setting.title}` : "No policy setting linked"; })()}</span>
              </div>
              <div className="template-list-meta">
                <span>{template.hardwareTypes.join(", ")}</span>
                <span>{template.updatedAt}</span>
                <span>{template.implementationCommands.length} implementation command{template.implementationCommands.length === 1 ? "" : "s"}</span>
              </div>
              <i className="pi pi-arrow-right" />
            </button>
          ))}
          {filteredTemplates.length === 0 && <div className="empty-row">No templates match your search.</div>}
        </div>
      </Card>
    </section>
  );
}

function CommandRowsEditor({ title, commands, setCommands, addLabel, onCommandChange }: { title: string; commands: string[]; setCommands: React.Dispatch<React.SetStateAction<string[]>> | ((updater: string[] | ((prev: string[]) => string[])) => void); addLabel: string; onCommandChange?: (index: number, value: string) => void }) {
  const safeCommands = commands.length ? commands : [""];
  const updateCommand = (index: number, value: string) => {
    if (onCommandChange) {
      onCommandChange(index, value);
      return;
    }
    setCommands((prev) => prev.map((command, commandIndex) => commandIndex === index ? value : command));
  };

  return (
    <div className="field-block command-row-editor">
      <div className="structured-section-header compact">
        <label>{title}</label>
        <Button label={addLabel} icon="pi pi-plus" size="small" outlined onClick={() => setCommands((prev) => [...prev, ""])} />
      </div>
      <div className="command-edit-row-list">
        {safeCommands.map((command, index) => (
          <div key={`${title}-${index}`} className="command-edit-row">
            <span>{index + 1}</span>
            <InputText value={command} onChange={(e) => updateCommand(index, e.target.value)} placeholder="Enter command to run" />
            <Button icon="pi pi-trash" rounded text severity="danger" aria-label={`Delete command ${index + 1}`} disabled={safeCommands.length === 1} onClick={() => setCommands((prev) => prev.filter((_, commandIndex) => commandIndex !== index))} />
          </div>
        ))}
      </div>
    </div>
  );
}





