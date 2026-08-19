import React from "react";

import DefaultLayout from "../layout/defaultLayout";
import { DashboardPage } from "./dashboardInventory";
import { reconcileTicketWithLatestScan } from "./helpers";
import { enqueueRuntimeDeployment, navigateToPortalPath, portalRoutePaths, saveRuntimeTickets, setRouteValue, updateTicketStatus, usePortalDevices, usePortalTickets } from "./portalRouteState";
import { styles } from "./styles";
import type { TicketStatus } from "./types";

type DashboardPageProps = Partial<React.ComponentProps<typeof DashboardPage>>;

export default function DashboardPageWrapper(props: DashboardPageProps = {}) {
  const { items: loadedTickets } = usePortalTickets(props.tickets);
  const [tickets, setTicketsState] = React.useState(loadedTickets);
  const [queueNotice, setQueueNotice] = React.useState("");
  React.useEffect(() => setTicketsState(loadedTickets), [loadedTickets]);
  const setTickets: React.Dispatch<React.SetStateAction<typeof tickets>> = (updater) => {
    setTicketsState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveRuntimeTickets(next);
      return next;
    });
  };
  const { devices, loading: devicesLoading } = usePortalDevices();
  const reconciledTickets = React.useMemo(() => {
    const sourceTickets = props.tickets ?? tickets;
    return devicesLoading ? sourceTickets : sourceTickets.map((ticket) => reconcileTicketWithLatestScan(ticket, devices));
  }, [devices, devicesLoading, props.tickets, tickets]);
  const handleStatusChange = React.useCallback((id: string, status: TicketStatus) => {
    setTickets((prev) => {
      const next = updateTicketStatus(prev, id, status);
      if (status === "Released") {
        const ticket = next.find((item) => item.id === id);
        if (ticket) {
          enqueueRuntimeDeployment(ticket)
            .then((queueItem) => setQueueNotice(`${ticket.id} queued for deployment as ${queueItem.queueId}.`))
            .catch((error: unknown) => setQueueNotice(error instanceof Error ? error.message : "Unable to queue deployment."));
        }
      }
      return next;
    });
  }, []);

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
          onStatusChange={props.onStatusChange ?? handleStatusChange}
        />
        {queueNotice && (
          <div className="netcomply-toast" role="status">
            <i className="pi pi-check-circle" />
            <span>{queueNotice}</span>
            <button type="button" aria-label="Dismiss queue notification" onClick={() => setQueueNotice("")}>x</button>
          </div>
        )}
      </div>
    </DefaultLayout>
  );
}
