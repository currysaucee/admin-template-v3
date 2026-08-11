import React, { useState } from "react";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { Card } from "primereact/card";

import type { Device, ComplianceStatus, PolicySetting, RemediationTemplate, Ticket, TicketStatus } from "./types";
import { ticketStatusOptions } from "./types";
import { getAvailableFixCount, getExecutableFindings, getFixAvailability, getStatusSeverity, hasConfigSnapshot, resolveTemplateForDevice } from "./helpers";
import { DeviceCell, ImplementationDateCell, PageHeader, StatusPill, TicketActions, TicketDeviceCell, UserCell, MetaTile } from "./sharedUi";
import { ConfigSnapshotDownload, FindingDetailCard as RemediationFindingDetailCard } from "./remediationViews";

export function DashboardPage({ tickets, onView, onStatusChange }: { tickets: Ticket[]; onView: (ticket: Ticket) => void; onStatusChange: (id: string, status: TicketStatus) => void }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TicketStatus | "All">("All");
  const statusOptions: Array<TicketStatus | "All"> = ["All", ...ticketStatusOptions];
  const filteredTickets = tickets.filter((ticket) => `${ticket.id} ${ticket.requestor} ${ticket.crNumber} ${ticket.devices.map((device) => device.hostname).join(" ")}`.toLowerCase().includes(search.toLowerCase()) && (status === "All" || ticket.status === status));

  return (
    <section className="page-content">
      <PageHeader title="Dashboard" subtitle="View, approve, reject, cancel, or release remediation tickets." />
      <div className="filter-card">
        <span className="p-input-icon-left grow-input">
          <i className="pi pi-search" />
          <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tickets..." />
        </span>
        <Dropdown value={status} options={statusOptions} onChange={(e) => setStatus(e.value as TicketStatus | "All")} placeholder="Status" />
      </div>
      <Card className="table-card">
        <DataTable value={filteredTickets} paginator rows={8} dataKey="id" responsiveLayout="stack" breakpoint="1440px" tableStyle={{ width: "100%" }}>
          <Column field="id" header="Ticket ID" sortable body={(row: Ticket) => <button className="link-button" onClick={() => onView(row)}>{row.id}</button>} />
          <Column header="Requestor" body={(row: Ticket) => <UserCell name={row.requestor} role={row.requestorRole} />} />
          <Column header="Device" body={(row: Ticket) => <TicketDeviceCell ticket={row} />} />
          <Column header="Implementation Date" sortable body={(row: Ticket) => <ImplementationDateCell date={row.plannedStart} />} />
          <Column header="Status" body={(row: Ticket) => <TicketStatusCell status={row.status} />} />
          <Column header="Actions" body={(row: Ticket) => <TicketActions ticket={row} onView={onView} onStatusChange={onStatusChange} />} />
        </DataTable>
      </Card>
    </section>
  );
}

function TicketStatusCell({ status }: { status: TicketStatus }) {
  if (status === "Partially Complete") {
    return (
      <div className="status-cell">
        <Tag
          className="status-pill partial-complete-status"
          value={status}
          severity="success"
          rounded
          style={{ background: "#dcfce7", color: "#166534", border: "1px solid #86efac" }}
        />
      </div>
    );
  }

  return <StatusPill value={status} severity={getStatusSeverity(status)} />;
}

export function InventoryPage({ devices, templates, policySettings, scanImportRunning = false, scanImportMessage = "", bulkInventorySelection, setBulkInventorySelection, onBulkCreate, onCreateTicket, onViewDevice, onRunScanImport }: { devices: Device[]; templates: RemediationTemplate[]; policySettings: PolicySetting[]; scanImportRunning?: boolean; scanImportMessage?: string; bulkInventorySelection: Device[]; setBulkInventorySelection: (devices: Device[]) => void; onBulkCreate: () => void; onCreateTicket: (device: Device) => void; onViewDevice: (device: Device) => void; onRunScanImport?: () => void }) {
  const [search, setSearch] = useState("");
  const [findingSearch, setFindingSearch] = useState("");
  const [status, setStatus] = useState<ComplianceStatus | "All">("All");
  const filteredDevices = devices.filter((device) => {
    const deviceMatch = `${device.hostname} ${device.hardwareType} ${device.role} ${device.managementIp} ${device.site}`.toLowerCase().includes(search.toLowerCase());
    const findingMatch = !findingSearch.trim() || device.findings.some((finding) => `${finding.id} ${finding.title} ${finding.standard} ${finding.expectedValue} ${finding.currentValue} ${finding.reason}`.toLowerCase().includes(findingSearch.toLowerCase()));
    return deviceMatch && findingMatch && (status === "All" || device.complianceStatus === status);
  });
  const canBulkSelectDevice = (device: Device) => device.complianceStatus === "Non-Compliant" && hasConfigSnapshot(device) && getAvailableFixCount(device, templates, policySettings) > 0;

  return (
    <section className="page-content">
      <PageHeader title="Exceptions" subtitle="Review non-compliant devices from the latest compliance scan and create remediation tickets." />
      <div className="filter-card">
        <span className="p-input-icon-left grow-input">
          <i className="pi pi-search" />
          <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search devices..." />
        </span>
        <span className="p-input-icon-left grow-input">
          <i className="pi pi-filter" />
          <InputText value={findingSearch} onChange={(e) => setFindingSearch(e.target.value)} placeholder="Filter finding or policy ID..." />
        </span>
        <Dropdown value={status} options={["All", "Non-Compliant"]} onChange={(e) => setStatus(e.value as ComplianceStatus | "All")} placeholder="Compliance Status" />
        {onRunScanImport ? <Button label="Run Scan Import" icon="pi pi-refresh" loading={scanImportRunning} outlined onClick={onRunScanImport} /> : null}
      </div>
      {scanImportMessage ? <div className="inline-info-row">{scanImportMessage}</div> : null}
      <Card className="table-card">
        <DataTable value={filteredDevices} selection={bulkInventorySelection} onSelectionChange={(e) => setBulkInventorySelection((e.value as Device[]).filter(canBulkSelectDevice))} isDataSelectable={(event) => canBulkSelectDevice(event.data as Device)} selectionMode="multiple" paginator rows={8} dataKey="id" responsiveLayout="stack" breakpoint="1440px" tableStyle={{ width: "100%" }}>
          <Column selectionMode="multiple" headerStyle={{ width: '4rem' }} bodyStyle={{ opacity: 1 }} />
          <Column header="Device" sortable body={(row: Device) => <DeviceCell device={row} />} />
          <Column field="hardwareType" header="Hardware Type" sortable />
          <Column field="managementIp" header="Management IP" sortable />
          <Column field="lastScanned" header="Last Scanned" sortable />
          <Column header="Compliance Status" body={(row: Device) => <StatusPill value={row.complianceStatus} severity={getStatusSeverity(row.complianceStatus)} />} />
          <Column header="Findings / Fixes" body={(row: Device) => <FindingFixCount device={row} templates={templates} policySettings={policySettings} />} />
          <Column header="Actions" body={(row: Device) => (
            <div className="action-row">
              <Button label="View" icon="pi pi-eye" size="small" outlined onClick={() => onViewDevice(row)} />
              <Button label="Create Ticket" icon="pi pi-plus-circle" size="small" disabled={bulkInventorySelection.length > 0 || row.complianceStatus !== "Non-Compliant" || !hasConfigSnapshot(row) || getAvailableFixCount(row, templates, policySettings) === 0} onClick={() => onCreateTicket(row)} />
            </div>
          )} />
        </DataTable>
        <div className="bulk-ticket-footer">
          <div className="bulk-selection-info">{bulkInventorySelection.length} selected</div>
          <Button label="Create Bulk Ticket" icon="pi pi-plus-circle" disabled={bulkInventorySelection.length === 0} onClick={onBulkCreate} />
        </div>
      </Card>
    </section>
  );
}

export function DeviceDetailPage({ device, templates, policySettings, onBack, onCreateTicket }: { device: Device; templates: RemediationTemplate[]; policySettings: PolicySetting[]; onBack: () => void; onCreateTicket: (device: Device) => void }) {
  return (
    <section className="page-content">
      <div className="detail-header-row">
        <div className="plain-page-title"><h1>Device Findings</h1></div>
        <div className="detail-actions">
          <Button label="Back to Exceptions" icon="pi pi-arrow-left" outlined onClick={onBack} />
          <Button label="Create Ticket" icon="pi pi-plus-circle" disabled={!hasConfigSnapshot(device) || getAvailableFixCount(device, templates, policySettings) === 0} onClick={() => onCreateTicket(device)} />
        </div>
      </div>
      <Card className="device-detail-card">
        <div className="device-detail-top">
          <DeviceCell device={device} />
          <StatusPill value={device.complianceStatus} severity={getStatusSeverity(device.complianceStatus)} />
        </div>
        <div className="device-info-split">
          <div className="device-info-column">
            <MetaTile label="Management IP" value={device.managementIp} />
            <MetaTile label="Hardware Type" value={device.hardwareType} />
          </div>
          <div className="device-info-column">
            <MetaTile label="Last Scanned" value={device.lastScanned} />
            <MetaTile label="Site" value={device.site} />
          </div>
        </div>
        <div className="device-snapshot-row">
          <span>Device Config Snapshot</span>
          <ConfigSnapshotDownload path={device.configSnapshotPath} filename={device.configSnapshotFilename} />
        </div>
      </Card>
      {device.findings.length === 0 ? (
        <Card className="device-detail-card"><div className="empty-row">No non-compliant findings were detected in today's compliance scan.</div></Card>
      ) : (
        <div className="finding-detail-list">
          {device.findings.map((finding) => {
            const template = resolveTemplateForDevice(device, finding, templates, policySettings);
            const policySetting = template?.policySettingId ? policySettings.find((setting) => setting.id === template.policySettingId) : undefined;
            return <RemediationFindingDetailCard key={finding.id} finding={finding} template={template} policySetting={policySetting} implementationOnly />;
          })}
        </div>
      )}
    </section>
  );
}

function FindingFixCount({ device, templates, policySettings }: { device: Device; templates: RemediationTemplate[]; policySettings: PolicySetting[] }) {
  const findingAvailability = device.findings.map((finding) => ({ finding, availability: getFixAvailability(device, finding, templates, policySettings) }));
  const availableFixCount = findingAvailability.filter((item) => item.availability.executable).length;
  const summarySeverity = availableFixCount === device.findings.length && device.findings.length > 0 ? "success" : availableFixCount > 0 ? "warning" : "secondary";
  return (
    <div className="fix-availability-cell">
      <Tag value={`${availableFixCount} of ${device.findings.length} findings ready`} severity={summarySeverity} rounded />
      <div className="finding-coverage-list">
        {findingAvailability.length === 0 ? (
          <small className="template-availability-note">No open findings.</small>
        ) : (
          findingAvailability.map(({ finding, availability }) => (
            <div key={finding.id} className="finding-coverage-row">
              <span className="policy-code">{finding.id}</span>
              <span>{finding.title}</span>
              <strong className={availability.executable ? "ready" : "blocked"}>{availability.executable ? "Fix ready" : availability.template ? "Needs snapshot" : "No template"}</strong>
            </div>
          ))
        )}
      </div>
    </div>
  );
}





