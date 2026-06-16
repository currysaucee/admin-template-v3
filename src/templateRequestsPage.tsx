import React, { useState } from "react";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Tag } from "primereact/tag";

import type { PolicySetting, RemediationTemplate, TemplateApprovalStatus, TemplateRequest } from "./types";
import { getTemplatePolicySetting } from "./helpers";
import { TemplateExecutionPreview } from "./remediationViews";
import { MetaTile, PageHeader, StatusPill, UserCell } from "./sharedUi";

function requestSeverity(status: TemplateApprovalStatus) {
  if (status === "Approved") return "success";
  if (status === "Rejected") return "danger";
  return "warning";
}

function PolicyChip({ setting }: { setting: PolicySetting }) {
  return <span className="policy-chip-line"><Tag className="review-policy-id-tag" value={setting.settingNumber} rounded /><span>{setting.title}</span></span>;
}

export function TemplateRequestsPage({ requests, setRequests, templates, setTemplates, policySettings }: { requests: TemplateRequest[]; setRequests: React.Dispatch<React.SetStateAction<TemplateRequest[]>>; templates: RemediationTemplate[]; setTemplates: React.Dispatch<React.SetStateAction<RemediationTemplate[]>>; policySettings: PolicySetting[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TemplateApprovalStatus | "All">("All");
  const [selectedRequest, setSelectedRequest] = useState<TemplateRequest | null>(null);
  const filteredRequests = requests.filter((request) => `${request.id} ${request.findingName} ${request.hardwareType} ${request.policySettingTitle} ${request.requestor}`.toLowerCase().includes(search.toLowerCase()) && (status === "All" || request.status === status));

  const updateRequestStatus = (request: TemplateRequest, nextStatus: TemplateApprovalStatus) => {
    const nextRequest = {
      ...request,
      status: nextStatus,
      reviewer: "Network SME",
      reviewNote: nextStatus === "Approved" ? "Approved for use in ticket creation." : nextStatus === "Rejected" ? "Rejected by SME review." : request.reviewNote,
    };
    setRequests((prev) => prev.map((item) => item.id === request.id ? nextRequest : item));
    setTemplates((prev) => prev.map((template) => template.key === request.templateKey ? { ...template, approvalStatus: nextStatus } : template));
    setSelectedRequest(nextRequest);
  };

  if (selectedRequest) {
    const proposedTemplate = templates.find((template) => template.key === selectedRequest.templateKey);
    const policySetting = getTemplatePolicySetting(proposedTemplate, policySettings);
    return (
      <section className="page-content">
        <div className="detail-header-row">
          <PageHeader title="Template Request Detail" subtitle="Review the proposed fix template before approving it for use." />
          <div className="detail-actions">
            <Button label="Back to Requests" icon="pi pi-arrow-left" outlined onClick={() => setSelectedRequest(null)} />
            {selectedRequest.status === "Pending Approval" && <Button label="Approve" icon="pi pi-check" severity="success" onClick={() => updateRequestStatus(selectedRequest, "Approved")} />}
            {selectedRequest.status === "Pending Approval" && <Button label="Reject" icon="pi pi-times" severity="danger" outlined onClick={() => updateRequestStatus(selectedRequest, "Rejected")} />}
          </div>
        </div>
        <Card className="device-detail-card">
          <div className="device-detail-top">
            <div>
              <h2 className="detail-title">{selectedRequest.id}</h2>
              <p className="detail-subtitle">{selectedRequest.findingName}</p>
            </div>
            <StatusPill value={selectedRequest.status} severity={requestSeverity(selectedRequest.status)} />
          </div>
          <div className="device-meta-grid">
            <MetaTile label="Requester" value={selectedRequest.requestor} />
            <MetaTile label="Hardware Type" value={selectedRequest.hardwareType} />
            <MetaTile label="Submitted" value={selectedRequest.submittedAt} />
            <MetaTile label="Template Key" value={selectedRequest.templateKey} />
          </div>
        </Card>
        <Card className="device-detail-card">
          <div className="reason-box"><span>Policy Setting</span><p>{policySetting ? <PolicyChip setting={policySetting} /> : selectedRequest.policySettingTitle}</p></div>
          <div className="reason-box"><span>Submitter Comment</span><p>{selectedRequest.submitterComment}</p></div>
          <div className="reason-box"><span>Review Note</span><p>{selectedRequest.reviewNote ?? "Pending SME decision."}</p></div>
        </Card>
        <Card className="device-detail-card">
          <div className="card-title-row">
            <div>
              <h3>Proposed Fix Template</h3>
              <p>SMEs review these exact automation steps before approval.</p>
            </div>
          </div>
          <TemplateExecutionPreview template={proposedTemplate} policySetting={policySetting} mode="implementation" />
        </Card>
      </section>
    );
  }

  return (
    <section className="page-content">
      <PageHeader title="Template Requests" subtitle="SMEs review proposed fix templates before they become available for ticket creation." />
      <div className="filter-card">
        <span className="p-input-icon-left grow-input">
          <i className="pi pi-search" />
          <InputText value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search template requests..." />
        </span>
        <Dropdown value={status} options={["All", "Pending Approval", "Approved", "Rejected"]} onChange={(event) => setStatus(event.value)} placeholder="Status" />
      </div>
      <Card className="table-card">
        <DataTable value={filteredRequests} paginator rows={8} dataKey="id" responsiveLayout="stack" breakpoint="1440px" tableStyle={{ width: "100%" }}>
          <Column field="id" header="Request ID" sortable body={(row: TemplateRequest) => <button className="link-button" onClick={() => setSelectedRequest(row)}>{row.id}</button>} />
          <Column header="Requester" body={(row: TemplateRequest) => <UserCell name={row.requestor} role="Template Submitter" />} />
          <Column field="hardwareType" header="Hardware Type" sortable />
          <Column header="Status" body={(row: TemplateRequest) => <StatusPill value={row.status} severity={requestSeverity(row.status)} />} />
          <Column header="Actions" body={(row: TemplateRequest) => (
            <div className="action-row">
              <Button label="View" icon="pi pi-eye" size="small" onClick={() => setSelectedRequest(row)} />
              {row.status === "Pending Approval" && <Button label="Approve" icon="pi pi-check" size="small" severity="success" onClick={() => updateRequestStatus(row, "Approved")} />}
              {row.status === "Pending Approval" && <Button label="Reject" icon="pi pi-times" size="small" severity="danger" outlined onClick={() => updateRequestStatus(row, "Rejected")} />}
            </div>
          )} />
        </DataTable>
      </Card>
    </section>
  );
}





