import React from "react";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";

import type { Device, Page, Ticket, TicketStatus, UserRole } from "./types";
import { roleOptions, ticketStatusOptions } from "./types";
import { getStatusSeverity } from "./helpers";

export function SideMenu({ activePage, onNavigate, onCreate }: { activePage: Page; onNavigate: (page: Page) => void; onCreate: () => void }) {
  const mainItems: Array<{ page: Page; label: string; icon: string; onClick?: () => void }> = [
    { page: "dashboard", label: "Dashboard", icon: "pi pi-table" },
    { page: "inventory", label: "Exceptions", icon: "pi pi-server" },
    { page: "createTicket", label: "Create Ticket", icon: "pi pi-plus-circle", onClick: onCreate },
  ];
  const smeItems: Array<{ page: Page; label: string; icon: string; onClick?: () => void }> = [
    { page: "templateRequests", label: "Template Requests", icon: "pi pi-inbox" },
    { page: "templates", label: "Fix Templates", icon: "pi pi-code" },
  ];
  const isActive = (item: { page: Page }) => activePage === item.page || (activePage === "deviceDetail" && item.page === "inventory") || (activePage === "ticketDetail" && item.page === "dashboard");

  return (
    <aside className="side-menu">
      <div className="brand">
        <div className="brand-mark">N</div>
        <div>
          <div className="brand-name">NetComply</div>
          <div className="brand-subtitle">Compliance Portal</div>
        </div>
      </div>
      <div className="menu-group-label">MAIN</div>
      <nav className="menu-list">
        {mainItems.map((item) => (
          <button key={item.page} className={`menu-item ${isActive(item) ? "active" : ""}`} onClick={() => (item.onClick ? item.onClick() : onNavigate(item.page))}>
            <i className={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="menu-group-label sme-label">SME</div>
      <nav className="menu-list">
        {smeItems.map((item) => (
          <button key={item.page} className={`menu-item ${isActive(item) ? "active" : ""}`} onClick={() => (item.onClick ? item.onClick() : onNavigate(item.page))}>
            <i className={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}

export function TopBar({ currentRole, setCurrentRole }: { currentRole: UserRole; setCurrentRole: (role: UserRole) => void }) {
  return (
    <header className="top-bar">
      <span className="p-input-icon-left top-search">
        <i className="pi pi-search" />
        <InputText placeholder="Search devices, tickets, CRs, findings..." />
      </span>
      <div className="top-actions">
        <div className="scan-clock">
          <i className="pi pi-clock" />
          <div>
            <strong>May 15, 2025 7:15 AM</strong>
            <span>Last scan</span>
          </div>
        </div>
        <Dropdown value={currentRole} options={roleOptions} onChange={(e) => setCurrentRole(e.value as UserRole)} className="role-dropdown" />
      </div>
    </header>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="page-header">
      <div className="breadcrumb">{title}</div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  );
}

export function MetaTile({ label, value }: { label: string; value: string }) {
  return <div className="meta-tile"><span>{label}</span><strong>{value}</strong></div>;
}

export function StatusPill({ value, severity }: { value: string; severity: string }) {
  return <div className="status-cell"><Tag className="status-pill" value={value} severity={severity as any} rounded /></div>;
}

export function UserCell({ name, role }: { name: string; role: string }) {
  return <div className="user-cell"><div className="avatar">{name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div><div><strong>{name}</strong><span>{role}</span></div></div>;
}

export function DeviceCell({ device }: { device: Device }) {
  return <div className="device-cell"><div className="device-icon"><i className="pi pi-server" /></div><div><strong>{device.hostname}</strong><span>{device.hardwareType} - {device.site}</span></div></div>;
}

export function TicketDeviceCell({ ticket }: { ticket: Ticket }) {
  const first = ticket.devices[0];
  if (!first) return <span>No device</span>;
  const extra = ticket.devices.length - 1;
  return <div className="device-cell"><div className="device-icon"><i className="pi pi-server" /></div><div><strong>{first.hostname}{extra > 0 ? ` +${extra}` : ""}</strong><span>{first.role} • {first.managementIp}</span></div></div>;
}

export function WindowCell({ start, end }: { start: string; end: string }) {
  return <div className="window-cell"><i className="pi pi-calendar" /><div><strong>{start.split(",")[0]}</strong><span>{start.includes(",") ? start.split(",").slice(1).join(",") : start} to {end}</span></div></div>;
}

export function TicketActions({ ticket, currentRole, onView, onEdit, onStatusChange }: { ticket: Ticket; currentRole: UserRole; onView: (ticket: Ticket) => void; onEdit: (ticket: Ticket) => void; onStatusChange: (id: string, status: TicketStatus) => void }) {
  const canApprove = (currentRole === "Approver" || currentRole === "Change Manager") && ticket.status === "Pending Approval";
  const canDeploy = currentRole === "Network Engineer" && ticket.status === "Approved";
  const canCancel = currentRole !== "Approver" && ["Pending Approval", "Approved", "Scheduled", "In Progress"].includes(ticket.status);
  return <div className="action-row"><Button label="View" icon="pi pi-eye" size="small" onClick={() => onView(ticket)} /><Button label="Update" icon="pi pi-pencil" size="small" severity="warning" onClick={() => onEdit(ticket)} />{canApprove && <Button label="Approve" icon="pi pi-check" size="small" severity="success" onClick={() => onStatusChange(ticket.id, "Approved")} />}{canApprove && <Button label="Reject" icon="pi pi-times" size="small" severity="danger" outlined onClick={() => onStatusChange(ticket.id, "Rejected")} />}{canDeploy && <Button label="Deploy" icon="pi pi-upload" size="small" onClick={() => onStatusChange(ticket.id, "Deployed")} />}{canCancel && <Button label="Cancel" icon="pi pi-ban" size="small" severity="danger" outlined onClick={() => onStatusChange(ticket.id, "Cancelled")} />}</div>;
}

export function DeviceOptionTemplate({ device }: { device: Device }) {
  const visibleFindings = device.findings.slice(0, 2);
  const remaining = Math.max(device.findings.length - visibleFindings.length, 0);

  return (
    <div className="device-option-template">
      <div className="device-option-top">
        <div>
          <strong>{device.hostname}</strong>
          <span>{device.role} • {device.hardwareType}</span>
        </div>
        <Tag value={`${device.findings.length} finding${device.findings.length === 1 ? "" : "s"}`} severity={device.findings.length ? "danger" : "success"} rounded />
      </div>
      <div className="device-option-chip-row">
        {visibleFindings.map((finding) => (
          <Tag key={finding.id} value={`${finding.id} - ${finding.title}`} severity="warning" rounded />
        ))}
        {remaining > 0 && <Tag value={`+${remaining} more`} severity="info" rounded />}
      </div>
    </div>
  );
}

export function DeviceMiniCard({ device, onRemove }: { device: Device; onRemove?: () => void }) {
  return <div className="device-mini-card"><i className="pi pi-server" /><div><strong>{device.hostname}</strong><span>{device.role} • {device.hardwareType} • {device.managementIp}</span></div><Tag value={`${device.findings.length} finding${device.findings.length !== 1 ? "s" : ""}`} severity={device.findings.length ? "danger" : "success"} />{onRemove && <Button icon="pi pi-times" rounded text severity="secondary" aria-label={`Remove ${device.hostname}`} onClick={onRemove} />}</div>;
}






