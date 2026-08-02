import React from "react";
import { Card } from "primereact/card";

import DefaultLayout from "../layout/defaultLayout";
import { DeviceDetailPage } from "./dashboardInventory";
import { getPreselectedFindingKeys, getRouteValue, navigateToPortalPath, portalRoutePaths, setRouteValue, usePortalDevices, usePortalPolicySettings, usePortalTemplates } from "./portalRouteState";
import { PageHeader } from "./sharedUi";
import { styles } from "./styles";

type DeviceDetailPageProps = Partial<React.ComponentProps<typeof DeviceDetailPage>>;

export default function DeviceDetailPageWrapper(props: DeviceDetailPageProps = {}) {
  const { devices } = usePortalDevices();
  const { items: templates } = usePortalTemplates(props.templates);
  const { items: policySettings } = usePortalPolicySettings(props.policySettings);
  const deviceId = getRouteValue("deviceId", "netcomply:selectedDeviceId");
  const device = props.device ?? devices.find((item) => item.id === deviceId);

  if (!device) {
    return (
      <DefaultLayout>
        <style>{styles}</style>
        <div className="netcomply-page-wrapper netcomply-device-detail-wrapper">
          <section className="page-content"><PageHeader title="Device Findings" subtitle="No device is selected for this route." /><Card className="device-detail-card"><div className="empty-row">Open this page with a device ID or select a device from Exceptions.</div></Card></section>
        </div>
      </DefaultLayout>
    );
  }

  return (
    <DefaultLayout>
      <style>{styles}</style>
      <div className="netcomply-page-wrapper netcomply-device-detail-wrapper">
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
      </div>
    </DefaultLayout>
  );
}
