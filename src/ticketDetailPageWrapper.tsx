import React from "react";
import { Card } from "primereact/card";

import { TicketDetailPage } from "./ticketDetail";
import { PortalPageShell } from "./portalPageShell";
import { getInitialPolicySettings, getInitialTemplates, getInitialTickets, getRouteValue, navigateToPortalPath, portalRoutePaths } from "./portalRouteState";
import { PageHeader } from "./sharedUi";

type TicketDetailPageProps = Partial<React.ComponentProps<typeof TicketDetailPage>>;

export default function TicketDetailPageWrapper(props: TicketDetailPageProps = {}) {
  const tickets = getInitialTickets();
  const ticketId = getRouteValue("ticketId", "netcomply:selectedTicketId");
  const ticket = props.ticket ?? tickets.find((item) => item.id === ticketId);

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
