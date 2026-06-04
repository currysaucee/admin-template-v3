import React from "react";

import { CreateTicketPage } from "./ticketWorkflow";
import { PortalPageShell } from "./portalPageShell";
import { createInitialTicketState, createPendingTicket, getInitialDevices, getInitialPolicySettings, getInitialTemplates, getInitialTickets, getRouteValue, getSelectedCommandCount, getSelectedTicketDevices, navigateToPortalPath, portalRoutePaths } from "./portalRouteState";
import type { Ticket } from "./types";

type CreateTicketPageProps = Partial<React.ComponentProps<typeof CreateTicketPage>>;

export default function CreateTicketPageWrapper(props: CreateTicketPageProps) {
  const devices = props.devices ?? getInitialDevices().filter((device) => device.complianceStatus === "Non-Compliant" && device.findings.length > 0);
  const templates = props.templates ?? getInitialTemplates();
  const policySettings = props.policySettings ?? getInitialPolicySettings();
  const [step, setStep] = React.useState(0);
  const [tickets, setTickets] = React.useState<Ticket[]>(getInitialTickets);
  const [state, setState] = React.useState(() => {
    const initial = createInitialTicketState();
    const routeDeviceIds = getRouteValue("deviceIds", "netcomply:selectedDeviceIds");
    const routeDeviceId = getRouteValue("deviceId", "netcomply:selectedDeviceId");
    const selectedDeviceIds = routeDeviceIds ? routeDeviceIds.split(",").filter(Boolean) : routeDeviceId ? [routeDeviceId] : [];
    const selectedFindingKeys = getRouteValue("findingKeys", "netcomply:selectedFindingKeys").split(",").filter(Boolean);
    return { ...initial, selectedDeviceIds, selectedFindingKeys };
  });

  const selectedDevices = devices.filter((device) => state.selectedDeviceIds.includes(device.id));
  const selectedTicketDevices = getSelectedTicketDevices(devices, state.selectedDeviceIds, state.selectedFindingKeys, templates, policySettings);
  const selectedCommandCount = getSelectedCommandCount(selectedTicketDevices, templates, policySettings);

  return (
    <PortalPageShell pageName="create-ticket">
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
          setTickets((prev) => [nextTicket, ...prev]);
          navigateToPortalPath(portalRoutePaths.ticketDetail, { ticketId: nextTicket.id });
        })}
      />
    </PortalPageShell>
  );
}
