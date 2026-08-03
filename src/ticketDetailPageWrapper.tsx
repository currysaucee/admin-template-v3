import React from "react";
import { Card } from "primereact/card";

import DefaultLayout from "../layout/defaultLayout";
import { TicketDetailPage } from "./ticketDetail";
import { getLatestRuntimeTicketId, getRouteValue, navigateToPortalPath, portalRoutePaths, saveRuntimeTickets, updateTicketStatus, usePortalDevices, usePortalPolicySettings, usePortalTemplates, usePortalTickets } from "./portalRouteState";
import { PageHeader } from "./sharedUi";
import { styles } from "./styles";
import type { Device, Ticket } from "./types";

type TicketDetailPageProps = Partial<React.ComponentProps<typeof TicketDetailPage>> & { devices?: Device[] };

export default function TicketDetailPageWrapper(props: TicketDetailPageProps = {}) {
  const overrideTickets = React.useMemo(() => props.ticket ? [props.ticket] : undefined, [props.ticket]);
  const { items: loadedTickets } = usePortalTickets(overrideTickets);
  const [tickets, setTicketsState] = React.useState(loadedTickets);
  React.useEffect(() => setTicketsState(loadedTickets), [loadedTickets]);
  const setTickets: React.Dispatch<React.SetStateAction<Ticket[]>> = (updater) => {
    setTicketsState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveRuntimeTickets(next);
      return next;
    });
  };
  const ticketId = getRouteValue("ticketId", "netcomply:selectedTicketId") || getLatestRuntimeTicketId();
  const ticket = props.ticket ?? tickets.find((item) => item.id === ticketId) ?? tickets[0];
  const { devices: sourceDevices } = usePortalDevices(props.devices);
  const { items: templates } = usePortalTemplates(props.templates);
  const { items: policySettings } = usePortalPolicySettings(props.policySettings);
  const hydratedTicket = ticket ? {
    ...ticket,
    devices: ticket.devices.map((ticketDevice) => {
      const sourceDevice = sourceDevices.find((device) => device.id === ticketDevice.deviceId || device.hostname === ticketDevice.hostname);
      return {
        ...ticketDevice,
        configSnapshotPath: sourceDevice?.configSnapshotPath ?? ticketDevice.configSnapshotPath,
        configSnapshotFilename: sourceDevice?.configSnapshotFilename ?? ticketDevice.configSnapshotFilename,
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
          templates={templates}
          policySettings={policySettings}
          onBack={props.onBack ?? (() => navigateToPortalPath(portalRoutePaths.dashboard))}
          onStatusChange={props.onStatusChange ?? ((id, status) => setTickets((prev) => updateTicketStatus(prev, id, status)))}
        />
      </div>
    </DefaultLayout>
  );
}
