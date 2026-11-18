import React from "react";

import DefaultLayout from "../../layout/DefaultLayout";
import { InventoryPage } from "./dashboardInventory";
import { navigateToPortalPath, portalRoutePaths, setRouteValue, usePortalDevices, usePortalPolicySettings, usePortalTemplates } from "./portalRouteState";
import { styles } from "./styles";
import type { Device, ReachabilityFilter } from "./types";

type InventoryPageProps = Partial<React.ComponentProps<typeof InventoryPage>>;

export default function InventoryPageWrapper(props: InventoryPageProps = {}) {
  const [bulkInventorySelection, setBulkInventorySelection] = React.useState<Device[]>([]);
  const [reachabilityFilter, setReachabilityFilter] = React.useState<ReachabilityFilter>("reachable");
  const { devices } = usePortalDevices(props.devices, reachabilityFilter);
  const { items: templates } = usePortalTemplates(props.templates);
  const { items: policySettings } = usePortalPolicySettings(props.policySettings);
  const selectedBulkDevices = props.bulkInventorySelection ?? bulkInventorySelection;

  return (
    <DefaultLayout>
      <style>{styles}</style>
      <div className="netcomply-page-wrapper netcomply-exceptions-wrapper">
        <InventoryPage
          devices={devices}
          reachabilityFilter={reachabilityFilter}
          setReachabilityFilter={setReachabilityFilter}
          templates={templates}
          policySettings={policySettings}
          bulkInventorySelection={selectedBulkDevices}
          setBulkInventorySelection={props.setBulkInventorySelection ?? setBulkInventorySelection}
          onBulkCreate={props.onBulkCreate ?? (() => {
            const selectedIds = selectedBulkDevices.map((device) => device.id).join(",");
            setRouteValue("netcomply:selectedDeviceId", "");
            setRouteValue("netcomply:selectedDeviceIds", selectedIds);
            setRouteValue("netcomply:selectedFindingKeys", "");
            navigateToPortalPath(portalRoutePaths.createTicket, { deviceIds: selectedIds });
          })}
          onViewDevice={props.onViewDevice ?? ((device) => {
            setRouteValue("netcomply:selectedDeviceId", device.id);
            setRouteValue("netcomply:selectedFindingKeys", "");
            navigateToPortalPath(portalRoutePaths.deviceDetail, { deviceId: device.id });
          })}
        />
      </div>
    </DefaultLayout>
  );
}
