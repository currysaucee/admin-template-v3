import React from "react";

import DefaultLayout from "../layout/defaultLayout";
import { DashboardPage } from "./dashboardInventory";
import { getRuntimeTickets, navigateToPortalPath, portalRoutePaths, setRouteValue, updateRuntimeTicketStatus } from "./portalRouteState";
import { styles } from "./styles";

type DashboardPageProps = Partial<React.ComponentProps<typeof DashboardPage>>;

export default function DashboardPageWrapper(props: DashboardPageProps = {}) {
  const [tickets, setTickets] = React.useState(getRuntimeTickets);

  return (
    <DefaultLayout>
      <style>{styles}</style>
      <div className="netcomply-page-wrapper netcomply-dashboard-wrapper">
        <DashboardPage
          tickets={props.tickets ?? tickets}
          onView={props.onView ?? ((ticket) => {
            setRouteValue("netcomply:selectedTicketId", ticket.id);
            navigateToPortalPath(portalRoutePaths.ticketDetail, { ticketId: ticket.id });
          })}
          onStatusChange={props.onStatusChange ?? ((id, status) => setTickets(updateRuntimeTicketStatus(id, status)))}
        />
      </div>
    </DefaultLayout>
  );
}
