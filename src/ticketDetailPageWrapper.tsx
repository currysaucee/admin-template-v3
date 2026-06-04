import React from "react";

import { TicketDetailPage } from "./ticketDetail";
import { PortalPageShell } from "./portalPageShell";

type TicketDetailPageProps = React.ComponentProps<typeof TicketDetailPage>;

export default function TicketDetailPageWrapper(props: TicketDetailPageProps) {
  return <PortalPageShell pageName="ticket-detail"><TicketDetailPage {...props} /></PortalPageShell>;
}
