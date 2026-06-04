import React from "react";

import { DeviceDetailPage } from "./dashboardInventory";
import { PortalPageShell } from "./portalPageShell";

type DeviceDetailPageProps = React.ComponentProps<typeof DeviceDetailPage>;

export default function DeviceDetailPageWrapper(props: DeviceDetailPageProps) {
  return <PortalPageShell pageName="device-detail"><DeviceDetailPage {...props} /></PortalPageShell>;
}
