import React from "react";

import { InventoryPage } from "./dashboardInventory";
import { PortalPageShell } from "./portalPageShell";

type InventoryPageProps = React.ComponentProps<typeof InventoryPage>;

export default function InventoryPageWrapper(props: InventoryPageProps) {
  return <PortalPageShell pageName="exceptions"><InventoryPage {...props} /></PortalPageShell>;
}
