import React from "react";

import { CreateTicketPage } from "./ticketWorkflow";
import { PortalPageShell } from "./portalPageShell";

type CreateTicketPageProps = React.ComponentProps<typeof CreateTicketPage>;

export default function CreateTicketPageWrapper(props: CreateTicketPageProps) {
  return <PortalPageShell pageName="create-ticket"><CreateTicketPage {...props} /></PortalPageShell>;
}
