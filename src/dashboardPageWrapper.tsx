import React from "react";

import { DashboardPage } from "./dashboardInventory";
import { PortalPageShell } from "./portalPageShell";
import { getRuntimeTickets, navigateToPortalPath, portalRoutePaths, setRouteValue, updateRuntimeTicketStatus } from "./portalRouteState";

type DashboardPageProps = Partial<React.ComponentProps<typeof DashboardPage>>;

export default function DashboardPageWrapper(props: DashboardPageProps = {}) {
  const [tickets, setTickets] = React.useState(getRuntimeTickets);

  return (
    <PortalPageShell pageName="dashboard">
      <DashboardPage
        tickets={props.tickets ?? tickets}
        onView={props.onView ?? ((ticket) => {
          setRouteValue("netcomply:selectedTicketId", ticket.id);
          navigateToPortalPath(portalRoutePaths.ticketDetail, { ticketId: ticket.id });
        })}
        onStatusChange={props.onStatusChange ?? ((id, status) => setTickets(updateRuntimeTicketStatus(id, status)))}
      />
    </PortalPageShell>
  );
}
