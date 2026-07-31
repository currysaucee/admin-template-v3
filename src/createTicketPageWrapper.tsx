import React from "react";

import DefaultLayout from "../layout/defaultLayout";
import { CreateTicketPage } from "./ticketWorkflow";
import { hasConfigSnapshot } from "./helpers";
import { addRuntimeTicket, createInitialTicketState, createPendingTicket, getInitialPolicySettings, getRuntimeTemplates, getRuntimeTickets, getRouteValue, getSelectedCommandCount, getSelectedTicketDevices, navigateToPortalPath, portalRoutePaths, setRouteValue, usePortalDevices } from "./portalRouteState";
import { styles } from "./styles";
import type { Ticket } from "./types";

type CreateTicketPageProps = Partial<React.ComponentProps<typeof CreateTicketPage>>;

export default function CreateTicketPageWrapper(props: CreateTicketPageProps = {}) {
  const { devices: sourceDevices } = usePortalDevices(props.devices);
  const devices = sourceDevices.filter((device) => device.complianceStatus === "Non-Compliant" && hasConfigSnapshot(device) && device.findings.length > 0);
  const templates = props.templates ?? getRuntimeTemplates();
  const policySettings = props.policySettings ?? getInitialPolicySettings();
  const [step, setStep] = React.useState(0);
  const [tickets, setTickets] = React.useState<Ticket[]>(getRuntimeTickets);
  const [state, setState] = React.useState(() => {
    const initial = createInitialTicketState();
    const routeDeviceIds = getRouteValue("deviceIds", "netcomply:selectedDeviceIds");
    const routeDeviceId = getRouteValue("deviceId", "netcomply:selectedDeviceId");
    const selectedDeviceIds = routeDeviceIds ? routeDeviceIds.split(",").filter(Boolean) : routeDeviceId ? [routeDeviceId] : [];
    const storedFindingKeys = getRouteValue("findingKeys", "netcomply:selectedFindingKeys").split(",").filter(Boolean);
    const selectedFindingKeys = storedFindingKeys.length
      ? storedFindingKeys
      : selectedDeviceIds.flatMap((deviceId) => {
          const device = devices.find((item) => item.id === deviceId);
          if (!device) return [];
          return device.findings.map((finding) => `${device.id}:${finding.id}`);
        });
    return { ...initial, selectedDeviceIds, selectedFindingKeys };
  });

  const selectedDevices = devices.filter((device) => state.selectedDeviceIds.includes(device.id));
  const selectedTicketDevices = getSelectedTicketDevices(devices, state.selectedDeviceIds, state.selectedFindingKeys, templates, policySettings);
  const selectedCommandCount = getSelectedCommandCount(selectedTicketDevices, templates, policySettings);

  return (
    <DefaultLayout>
      <style>{styles}</style>
      <div className="netcomply-page-wrapper netcomply-create-ticket-wrapper">
        <CreateTicketPage
          devices={devices}
          templates={templates}
          policySettings={policySettings}
          step={props.step ?? step}
          setStep={props.setStep ?? setStep}
          selectedDeviceIds={props.selectedDeviceIds ?? state.selectedDeviceIds}
          setSelectedDeviceIds={props.setSelectedDeviceIds ?? ((updater) => setState((prev) => ({ ...prev, selectedDeviceIds: typeof updater === "function" ? updater(prev.selectedDeviceIds) : updater })))}
          selectedFindingKeys={props.selectedFindingKeys ?? state.selectedFindingKeys}
          setSelectedFindingKeys={props.setSelectedFindingKeys ?? ((updater) => setState((prev) => ({ ...prev, selectedFindingKeys: typeof updater === "function" ? updater(prev.selectedFindingKeys) : updater })))}
          selectedDevices={props.selectedDevices ?? selectedDevices}
          selectedTicketDevices={props.selectedTicketDevices ?? selectedTicketDevices}
          selectedCommandCount={props.selectedCommandCount ?? selectedCommandCount}
          plannedStart={props.plannedStart ?? state.plannedStart}
          setPlannedStart={props.setPlannedStart ?? ((plannedStart) => setState((prev) => ({ ...prev, plannedStart })))}
          plannedEnd={props.plannedEnd ?? state.plannedEnd}
          setPlannedEnd={props.setPlannedEnd ?? ((plannedEnd) => setState((prev) => ({ ...prev, plannedEnd })))}
          implementationPlan={props.implementationPlan ?? state.implementationPlan}
          setImplementationPlan={props.setImplementationPlan ?? ((implementationPlan) => setState((prev) => ({ ...prev, implementationPlan })))}
          backoutPlan={props.backoutPlan ?? state.backoutPlan}
          setBackoutPlan={props.setBackoutPlan ?? ((backoutPlan) => setState((prev) => ({ ...prev, backoutPlan })))}
          onCancel={props.onCancel ?? (() => navigateToPortalPath(portalRoutePaths.dashboard))}
          onSubmit={props.onSubmit ?? (() => {
            const nextTicket = createPendingTicket("Network Engineer", tickets, selectedTicketDevices, state);
            setTickets(addRuntimeTicket(nextTicket));
            setRouteValue("netcomply:selectedTicketId", nextTicket.id);
            navigateToPortalPath(portalRoutePaths.ticketDetail, { ticketId: nextTicket.id });
          })}
        />
      </div>
    </DefaultLayout>
  );
}
