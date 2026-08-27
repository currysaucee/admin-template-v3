import React from "react";

import DefaultLayout from "../layout/defaultLayout";
import { InventoryPage } from "./dashboardInventory";
import { findFindingKey, getExecutableFindings, normalizePolicyReference } from "./helpers";
import { navigateToPortalPath, portalRoutePaths, setRouteValue, usePortalDevices, usePortalPolicySettings, usePortalTemplates } from "./portalRouteState";
import { styles } from "./styles";
import type { Device } from "./types";

type InventoryPageProps = Partial<React.ComponentProps<typeof InventoryPage>>;

export default function InventoryPageWrapper(props: InventoryPageProps = {}) {
  const [bulkInventorySelection, setBulkInventorySelection] = React.useState<Device[]>([]);
  const { devices } = usePortalDevices(props.devices);
  const { items: templates } = usePortalTemplates(props.templates);
  const { items: policySettings } = usePortalPolicySettings(props.policySettings);
  const selectedBulkDevices = props.bulkInventorySelection ?? bulkInventorySelection;

  const startCreateTicket = (device?: Device) => {
    if (device) setRouteValue("netcomply:selectedDeviceId", device.id);
    navigateToPortalPath(portalRoutePaths.createTicket, device ? { deviceId: device.id } : {});
  };

  return (
    <DefaultLayout>
      <style>{styles}</style>
      <div className="netcomply-page-wrapper netcomply-exceptions-wrapper">
        <InventoryPage
          devices={devices}
          templates={templates}
          policySettings={policySettings}
          bulkInventorySelection={selectedBulkDevices}
          setBulkInventorySelection={props.setBulkInventorySelection ?? setBulkInventorySelection}
          onBulkCreate={props.onBulkCreate ?? ((policyFilters = []) => {
            const selectedIds = selectedBulkDevices.map((device) => device.id).join(",");
            const filterSet = new Set(policyFilters.map((value) => normalizePolicyReference(value)));
            const selectedFindingKeys = selectedBulkDevices.flatMap((device) =>
              getExecutableFindings(device, templates, policySettings)
                .filter((finding) => filterSet.size === 0 || [finding.id, finding.templateKey].map((value) => normalizePolicyReference(value)).some((value) => filterSet.has(value)))
                .map((finding) => findFindingKey(device.id, finding.id))
            );
            setRouteValue("netcomply:selectedDeviceIds", selectedIds);
            setRouteValue("netcomply:selectedFindingKeys", selectedFindingKeys.join(","));
            navigateToPortalPath(portalRoutePaths.createTicket, { deviceIds: selectedIds });
          })}
          onCreateTicket={props.onCreateTicket ?? startCreateTicket}
          onViewDevice={props.onViewDevice ?? ((device) => {
            setRouteValue("netcomply:selectedDeviceId", device.id);
            setRouteValue("netcomply:selectedFindingKeys", getExecutableFindings(device, templates, policySettings).map((finding) => `${device.id}:${finding.id}`).join(","));
            navigateToPortalPath(portalRoutePaths.deviceDetail, { deviceId: device.id });
          })}
        />
      </div>
    </DefaultLayout>
  );
}
