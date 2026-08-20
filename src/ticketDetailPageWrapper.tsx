import React from "react";
import { Card } from "primereact/card";

import DefaultLayout from "../layout/defaultLayout";
import { TicketDetailPage } from "./ticketDetail";
import { reconcileTicketWithLatestScan } from "./helpers";
import { enqueueRuntimeDeployment, getLatestRuntimeTicketId, getRouteValue, navigateToPortalPath, portalRoutePaths, updateRuntimeTicketStatus, usePortalDevices, usePortalPolicySettings, usePortalTemplates, usePortalTickets } from "./portalRouteState";
import { PageHeader } from "./sharedUi";
import { styles } from "./styles";
import type { Device, Ticket, TicketStatus } from "./types";

type TicketDetailPageProps = Partial<React.ComponentProps<typeof TicketDetailPage>> & { devices?: Device[] };

export default function TicketDetailPageWrapper(props: TicketDetailPageProps = {}) {
  const overrideTickets = React.useMemo(() => props.ticket ? [props.ticket] : undefined, [props.ticket]);
  const { items: loadedTickets } = usePortalTickets(overrideTickets);
  const [tickets, setTicketsState] = React.useState(loadedTickets);
  const [actionNotice, setActionNotice] = React.useState("");
  React.useEffect(() => setTicketsState(loadedTickets), [loadedTickets]);
  const ticketId = getRouteValue("ticketId", "netcomply:selectedTicketId") || getLatestRuntimeTicketId();
  const ticket = tickets.find((item) => item.id === ticketId) ?? props.ticket ?? tickets[0];
  const { devices: sourceDevices, loading: devicesLoading } = usePortalDevices(props.devices);
  const { items: templates } = usePortalTemplates(props.templates);
  const { items: policySettings } = usePortalPolicySettings(props.policySettings);
  const hydratedTicket = ticket ? (devicesLoading ? ticket : reconcileTicketWithLatestScan(ticket, sourceDevices)) : undefined;
  const applyConfirmedTicket = React.useCallback((confirmedTicket: Ticket) => {
    setTicketsState((prev) => prev.map((item) => (item.id === confirmedTicket.id ? confirmedTicket : item)));
  }, []);
  const handleStatusChange = React.useCallback((id: string, status: TicketStatus) => {
    const currentTicket = hydratedTicket && hydratedTicket.id === id ? hydratedTicket : tickets.find((item) => item.id === id);
    if (!currentTicket) return;
    if (status === "Queued") {
      enqueueRuntimeDeployment(currentTicket)
        .then((queueItem) => {
          if (queueItem.ticket) applyConfirmedTicket(queueItem.ticket);
          else applyConfirmedTicket({ ...currentTicket, status: "Queued" });
          setActionNotice(`${currentTicket.id} queued for deployment as ${queueItem.queueId}.`);
        })
        .catch((error: unknown) => setActionNotice(error instanceof Error ? error.message : "Unable to queue deployment."));
      return;
    }
    updateRuntimeTicketStatus(id, status)
      .then(applyConfirmedTicket)
      .catch((error: unknown) => setActionNotice(error instanceof Error ? error.message : "Unable to update ticket."));
  }, [applyConfirmedTicket, hydratedTicket, tickets]);

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
          onStatusChange={handleStatusChange}
        />
        {actionNotice && (
          <div className="netcomply-toast" role="status">
            <i className="pi pi-check-circle" />
            <span>{actionNotice}</span>
            <button type="button" aria-label="Dismiss ticket action notification" onClick={() => setActionNotice("")}>x</button>
          </div>
        )}
      </div>
    </DefaultLayout>
  );
}
