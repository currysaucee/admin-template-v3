import React from "react";

import DefaultLayout from "../../layout/DefaultLayout";
import { DashboardPage } from "../dashboardInventory";
import { reconcileTicketWithLatestScan } from "../helpers";
import { enqueueRuntimeDeployment, navigateToPortalPath, portalRoutePaths, setRouteValue, updateRuntimeTicketStatus, usePortalDevices, usePortalTickets } from "../portalRouteState";
import { styles } from "../styles";
import type { Ticket, TicketStatus } from "../types";

type DashboardPageProps = Partial<React.ComponentProps<typeof DashboardPage>>;

export default function DashboardPageWrapper(props: DashboardPageProps = {}) {
  const { items: loadedTickets } = usePortalTickets(props.tickets);
  const [tickets, setTicketsState] = React.useState(loadedTickets);
  React.useEffect(() => setTicketsState(loadedTickets), [loadedTickets]);
  const { devices, loading: devicesLoading } = usePortalDevices();
  const reconciledTickets = React.useMemo(() => {
    return devicesLoading ? tickets : tickets.map((ticket) => reconcileTicketWithLatestScan(ticket, devices));
  }, [devices, devicesLoading, tickets]);
  const applyConfirmedTicket = React.useCallback((confirmedTicket: Ticket) => {
    setTicketsState((prev) => prev.map((ticket) => (ticket.id === confirmedTicket.id ? confirmedTicket : ticket)));
  }, []);
  const handleStatusChange = React.useCallback((id: string, status: TicketStatus, crTicket?: string) => {
    const ticket = reconciledTickets.find((item) => item.id === id);
    if (!ticket) return;
    if (status === "Queued") {
      if (!crTicket) {
        return;
      }
      enqueueRuntimeDeployment(ticket, crTicket)
        .then((queueItem) => {
          if (queueItem.ticket) applyConfirmedTicket(queueItem.ticket);
          else applyConfirmedTicket({ ...ticket, status: "Queued" });
        })
        .catch((error: unknown) => console.error("Unable to queue deployment.", error));
      return;
    }
    updateRuntimeTicketStatus(id, status)
      .then(applyConfirmedTicket)
      .catch((error: unknown) => console.error("Unable to update ticket.", error));
  }, [applyConfirmedTicket, reconciledTickets]);

  return (
    <DefaultLayout>
      <style>{styles}</style>
      <div className="netcomply-page-wrapper netcomply-dashboard-wrapper">
        <DashboardPage
          tickets={reconciledTickets}
          onView={props.onView ?? ((ticket) => {
            setRouteValue("netcomply:selectedTicketId", ticket.id);
            navigateToPortalPath(portalRoutePaths.ticketDetail, { ticketId: ticket.id });
          })}
          onStatusChange={handleStatusChange}
        />
      </div>
    </DefaultLayout>
  );
}
