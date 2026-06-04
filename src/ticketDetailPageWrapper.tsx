import React from "react";
import { Card } from "primereact/card";

import { TicketDetailPage } from "./ticketDetail";
import { PortalPageShell } from "./portalPageShell";
import { getInitialPolicySettings, getInitialTemplates, getLatestRuntimeTicketId, getRouteValue, getRuntimeTickets, navigateToPortalPath, portalRoutePaths } from "./portalRouteState";
import { PageHeader } from "./sharedUi";

type TicketDetailPageProps = Partial<React.ComponentProps<typeof TicketDetailPage>>;

export default function TicketDetailPageWrapper(props: TicketDetailPageProps = {}) {
  const tickets = getRuntimeTickets();
  const ticketId = getRouteValue("ticketId", "netcomply:selectedTicketId") || getLatestRuntimeTicketId();
  const ticket = props.ticket ?? tickets.find((item) => item.id === ticketId) ?? tickets[0];

  if (!ticket) {
    return <PortalPageShell pageName="ticket-detail"><section className="page-content"><PageHeader title="Ticket Details" subtitle="No ticket is selected for this route." /><Card className="device-detail-card"><div className="empty-row">Open this page with a ticket ID or select a ticket from Dashboard.</div></Card></section></PortalPageShell>;
  }

  return (
    <PortalPageShell pageName="ticket-detail">
      <TicketDetailPage
        ticket={ticket}
        templates={props.templates ?? getInitialTemplates()}
        policySettings={props.policySettings ?? getInitialPolicySettings()}
        onBack={props.onBack ?? (() => navigateToPortalPath(portalRoutePaths.dashboard))}
        onEdit={props.onEdit ?? (() => undefined)}
      />
    </PortalPageShell>
  );
}
