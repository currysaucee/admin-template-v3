import React from "react";

import DefaultLayout from "../layout/defaultLayout";
import { DashboardPage } from "./dashboardInventory";
import { navigateToPortalPath, portalRoutePaths, saveRuntimeTickets, setRouteValue, updateTicketStatus, usePortalTickets } from "./portalRouteState";
import { styles } from "./styles";

type DashboardPageProps = Partial<React.ComponentProps<typeof DashboardPage>>;

export default function DashboardPageWrapper(props: DashboardPageProps = {}) {
  const { items: loadedTickets } = usePortalTickets(props.tickets);
  const [tickets, setTicketsState] = React.useState(loadedTickets);
  React.useEffect(() => setTicketsState(loadedTickets), [loadedTickets]);
  const setTickets: React.Dispatch<React.SetStateAction<typeof tickets>> = (updater) => {
    setTicketsState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveRuntimeTickets(next);
      return next;
    });
  };

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
          onStatusChange={props.onStatusChange ?? ((id, status) => setTickets((prev) => updateTicketStatus(prev, id, status)))}
        />
      </div>
    </DefaultLayout>
  );
}
