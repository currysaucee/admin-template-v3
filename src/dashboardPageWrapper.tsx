import React from "react";

import { DashboardPage } from "./dashboardInventory";
import { PortalPageShell } from "./portalPageShell";
import { getInitialTickets, navigateToPortalPath, portalRoutePaths, setRouteValue, updateTicketStatus } from "./portalRouteState";
import type { UserRole } from "./types";

type DashboardPageProps = Partial<React.ComponentProps<typeof DashboardPage>>;

export default function DashboardPageWrapper(props: DashboardPageProps = {}) {
  const [tickets, setTickets] = React.useState(getInitialTickets);
  const currentRole = props.currentRole ?? "Network Engineer";

  return (
    <PortalPageShell pageName="dashboard">
      <DashboardPage
        tickets={props.tickets ?? tickets}
        currentRole={currentRole as UserRole}
        onView={props.onView ?? ((ticket) => {
          setRouteValue("netcomply:selectedTicketId", ticket.id);
          navigateToPortalPath(portalRoutePaths.ticketDetail, { ticketId: ticket.id });
        })}
        onEdit={props.onEdit ?? ((ticket) => {
          setRouteValue("netcomply:selectedTicketId", ticket.id);
          navigateToPortalPath(portalRoutePaths.ticketDetail, { ticketId: ticket.id });
        })}
        onStatusChange={props.onStatusChange ?? ((id, status) => setTickets((prev) => updateTicketStatus(prev, id, status)))}
      />
    </PortalPageShell>
  );
}
