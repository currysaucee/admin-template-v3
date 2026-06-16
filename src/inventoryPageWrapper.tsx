import React from "react";

import { InventoryPage } from "./dashboardInventory";
import { getExecutableFindings } from "./helpers";
import { PortalPageShell } from "./portalPageShell";
import { getInitialDevices, getInitialPolicySettings, getRuntimeTemplates, navigateToPortalPath, portalRoutePaths, setRouteValue } from "./portalRouteState";
import type { Device } from "./types";

type InventoryPageProps = Partial<React.ComponentProps<typeof InventoryPage>>;

export default function InventoryPageWrapper(props: InventoryPageProps = {}) {
  const [bulkInventorySelection, setBulkInventorySelection] = React.useState<Device[]>([]);
  const devices = props.devices ?? getInitialDevices();
  const templates = props.templates ?? getRuntimeTemplates();
  const policySettings = props.policySettings ?? getInitialPolicySettings();
  const selectedBulkDevices = props.bulkInventorySelection ?? bulkInventorySelection;

  const startCreateTicket = (device?: Device) => {
    if (device) setRouteValue("netcomply:selectedDeviceId", device.id);
    navigateToPortalPath(portalRoutePaths.createTicket, device ? { deviceId: device.id } : {});
  };

  return (
    <PortalPageShell pageName="exceptions">
      <InventoryPage
        devices={devices}
        templates={templates}
        policySettings={policySettings}
        bulkInventorySelection={selectedBulkDevices}
        setBulkInventorySelection={props.setBulkInventorySelection ?? setBulkInventorySelection}
        onBulkCreate={props.onBulkCreate ?? (() => {
          const selectedIds = selectedBulkDevices.map((device) => device.id).join(",");
          setRouteValue("netcomply:selectedDeviceIds", selectedIds);
          navigateToPortalPath(portalRoutePaths.createTicket, { deviceIds: selectedIds });
        })}
        onCreateTicket={props.onCreateTicket ?? startCreateTicket}
        onViewDevice={props.onViewDevice ?? ((device) => {
          setRouteValue("netcomply:selectedDeviceId", device.id);
          setRouteValue("netcomply:selectedFindingKeys", getExecutableFindings(device, templates, policySettings).map((finding) => `${device.id}:${finding.id}`).join(","));
          navigateToPortalPath(portalRoutePaths.deviceDetail, { deviceId: device.id });
        })}
      />
    </PortalPageShell>
  );
}
