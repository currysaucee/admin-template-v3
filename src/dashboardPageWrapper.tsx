import React from "react";

import { DashboardPage } from "./dashboardInventory";
import { PortalPageShell } from "./portalPageShell";

type DashboardPageProps = React.ComponentProps<typeof DashboardPage>;

export default function DashboardPageWrapper(props: DashboardPageProps) {
  return <PortalPageShell pageName="dashboard"><DashboardPage {...props} /></PortalPageShell>;
}
