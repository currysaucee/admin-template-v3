import React from "react";
import { Card } from "primereact/card";

import DefaultLayout from "../layout/defaultLayout";
import { TicketDetailPage } from "./ticketDetail";
import { getInitialDevices, getInitialPolicySettings, getRuntimeTemplates, getLatestRuntimeTicketId, getRouteValue, getRuntimeTickets, navigateToPortalPath, portalRoutePaths, updateRuntimeTicketStatus } from "./portalRouteState";
import { PageHeader } from "./sharedUi";
import { styles } from "./styles";
import type { Device } from "./types";

type TicketDetailPageProps = Partial<React.ComponentProps<typeof TicketDetailPage>> & { devices?: Device[] };

export default function TicketDetailPageWrapper(props: TicketDetailPageProps = {}) {
  const [tickets, setTickets] = React.useState(getRuntimeTickets);
  const ticketId = getRouteValue("ticketId", "netcomply:selectedTicketId") || getLatestRuntimeTicketId();
  const ticket = props.ticket ?? tickets.find((item) => item.id === ticketId) ?? tickets[0];
  const sourceDevices = props.devices ?? getInitialDevices();
  const hydratedTicket = ticket ? {
    ...ticket,
    devices: ticket.devices.map((ticketDevice) => {
      const sourceDevice = sourceDevices.find((device) => device.id === ticketDevice.deviceId || device.hostname === ticketDevice.hostname);
      return {
        ...ticketDevice,
        configSnapshotPath: ticketDevice.configSnapshotPath ?? sourceDevice?.configSnapshotPath,
        configSnapshotFilename: ticketDevice.configSnapshotFilename ?? sourceDevice?.configSnapshotFilename,
      };
    }),
  } : undefined;

  if (!hydratedTicket) {
    return (
      <DefaultLayout>
        <style>{styles}</style>
        <div className="netcomply-page-wrapper netcomply-ticket-detail-wrapper">
          <section className="page-content"><PageHeader title="Ticket Details" subtitle="No ticket is selected for this route." /><Card className="device-detail-card"><div className="empty-row">Open this page with a ticket ID or select a ticket from Dashboard.</div></Card></section>
        </div>
      </DefaultLayout>
    );
  }

  return (
    <DefaultLayout>
      <style>{styles}</style>
      <div className="netcomply-page-wrapper netcomply-ticket-detail-wrapper">
        <TicketDetailPage
          ticket={hydratedTicket}
          templates={props.templates ?? getRuntimeTemplates()}
          policySettings={props.policySettings ?? getInitialPolicySettings()}
          onBack={props.onBack ?? (() => navigateToPortalPath(portalRoutePaths.dashboard))}
          onStatusChange={props.onStatusChange ?? ((id, status) => setTickets(updateRuntimeTicketStatus(id, status)))}
        />
      </div>
    </DefaultLayout>
  );
}
