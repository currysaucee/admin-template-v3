import React from "react";
import { Card } from "primereact/card";

import { DeviceDetailPage } from "./dashboardInventory";
import { PortalPageShell } from "./portalPageShell";
import { getInitialDevices, getInitialPolicySettings, getInitialTemplates, getPreselectedFindingKeys, getRouteValue, navigateToPortalPath, portalRoutePaths, setRouteValue } from "./portalRouteState";
import { PageHeader } from "./sharedUi";

type DeviceDetailPageProps = Partial<React.ComponentProps<typeof DeviceDetailPage>>;

export default function DeviceDetailPageWrapper(props: DeviceDetailPageProps) {
  const devices = getInitialDevices();
  const templates = props.templates ?? getInitialTemplates();
  const policySettings = props.policySettings ?? getInitialPolicySettings();
  const deviceId = getRouteValue("deviceId", "netcomply:selectedDeviceId");
  const device = props.device ?? devices.find((item) => item.id === deviceId);

  if (!device) {
    return <PortalPageShell pageName="device-detail"><section className="page-content"><PageHeader title="Device Findings" subtitle="No device is selected for this route." /><Card className="device-detail-card"><div className="empty-row">Open this page with a device ID or select a device from Exceptions.</div></Card></section></PortalPageShell>;
  }

  return (
    <PortalPageShell pageName="device-detail">
      <DeviceDetailPage
        device={device}
        templates={templates}
        policySettings={policySettings}
        onBack={props.onBack ?? (() => navigateToPortalPath(portalRoutePaths.inventory))}
        onCreateTicket={props.onCreateTicket ?? ((selectedDevice) => {
          setRouteValue("netcomply:selectedDeviceId", selectedDevice.id);
          setRouteValue("netcomply:selectedFindingKeys", getPreselectedFindingKeys(selectedDevice, templates, policySettings).join(","));
          navigateToPortalPath(portalRoutePaths.createTicket, { deviceId: selectedDevice.id });
        })}
      />
    </PortalPageShell>
  );
}
