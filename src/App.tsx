import React, { useEffect, useMemo, useRef, useState } from "react";
import { PrimeReactProvider } from "primereact/api";

import "primereact/resources/themes/saga-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";

import { SideMenu, TopBar } from "./sharedUi";
import CreateTicketPageWrapper from "./createTicketPageWrapper";
import DashboardPageWrapper from "./dashboardPageWrapper";
import DeveloperConsolePageWrapper from "./developerConsolePageWrapper";
import DeviceDetailPageWrapper from "./deviceDetailPageWrapper";
import InventoryPageWrapper from "./inventoryPageWrapper";
import TemplatePageWrapper from "./templatePageWrapper";
import TemplateRequestsPageWrapper from "./templateRequestsPageWrapper";
import TicketDetailPageWrapper from "./ticketDetailPageWrapper";
import { formatDate, findFindingKey, getExecutableFindings, getTemplateCommandCount, hasExecutableFix, resolveTemplateForDevice } from "./helpers";
import { initialDevices, initialPolicySettings, initialTickets } from "./mockData";
import { getRuntimeTemplateRequests, getRuntimeTemplates, saveRuntimeTemplateRequests, saveRuntimeTemplates } from "./portalRouteState";
import { getStoredDataMode, loadRealDevices, saveStoredDataMode, type NetComplyDataMode } from "./dataMode";
import { styles } from "./styles";
import { pageValues } from "./types";
import type { Device, PolicySetting, Page, RemediationTemplate, Ticket, TicketDevice, TicketStatus, UserRole } from "./types";

export default function App() {
  return (
    <PrimeReactProvider>
      <NetComplyPrototype />
    </PrimeReactProvider>
  );
}

function NetComplyPrototype() {
  const [page, setPage] = useState<Page>("dashboard");
  const pageHistoryReadyRef = useRef(false);
  const applyingPopStateRef = useRef(false);
  const [currentRole, setCurrentRole] = useState<UserRole>("Network Engineer");
  const [dataMode, setDataModeState] = useState<NetComplyDataMode>(getStoredDataMode);
  const [devices, setDevices] = useState<Device[]>(initialDevices);
  const [policySettings, setPolicySettings] = useState<PolicySetting[]>(initialPolicySettings);
  const [templateRequests, setTemplateRequests] = useState(getRuntimeTemplateRequests);
  const [templates, setTemplates] = useState<RemediationTemplate[]>(getRuntimeTemplates);
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [bulkInventorySelection, setBulkInventorySelection] = useState<Device[]>([]);
  const [selectedFindingKeys, setSelectedFindingKeys] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [plannedStart, setPlannedStart] = useState<Date | null>(null);
  const [plannedEnd, setPlannedEnd] = useState<Date | null>(null);
  const [implementationPlan, setImplementationPlan] = useState("");
  const [backoutPlan, setBackoutPlan] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [selectedTicketDetail, setSelectedTicketDetail] = useState<Ticket | null>(null);
  const [selectedDeviceDetail, setSelectedDeviceDetail] = useState<Device | null>(null);

  useEffect(() => {
    if (dataMode === "mock") {
      setDevices(initialDevices);
      return;
    }

    loadRealDevices()
      .then(setDevices)
      .catch(() => setDevices([]));
  }, [dataMode]);

  const setDataMode = (mode: NetComplyDataMode) => {
    saveStoredDataMode(mode);
    setDataModeState(mode);
  };

  const selectedDevices = useMemo(() => devices.filter((device) => selectedDeviceIds.includes(device.id)), [devices, selectedDeviceIds]);
  const selectableTicketDevices = useMemo(() => devices.filter((device) => device.complianceStatus === "Non-Compliant" && device.findings.length > 0), [devices]);

  useEffect(() => {
    saveRuntimeTemplateRequests(templateRequests);
  }, [templateRequests]);

  useEffect(() => {
    saveRuntimeTemplates(templates);
  }, [templates]);

  const selectedTicketDevices = useMemo<TicketDevice[]>(() => {
    return selectedDevices
      .map((device) => ({
        deviceId: device.id,
        hostname: device.hostname,
        role: device.role,
        hardwareType: device.hardwareType,
        managementIp: device.managementIp,
        configSnapshotPath: device.configSnapshotPath,
        configSnapshotFilename: device.configSnapshotFilename,
        findings: device.findings.filter((finding) => selectedFindingKeys.includes(findFindingKey(device.id, finding.id)) && hasExecutableFix(device, finding, templates, policySettings)),
      }))
      .filter((device) => device.findings.length > 0);
  }, [selectedDevices, selectedFindingKeys, templates, policySettings]);

  const selectedCommandCount = selectedTicketDevices.reduce((total, device) => {
    return total + device.findings.reduce((count, finding) => count + getTemplateCommandCount(resolveTemplateForDevice(device, finding, templates, policySettings)), 0);
  }, 0);

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const nextPage = event.state?.page;
      if (pageValues.includes(nextPage)) {
        applyingPopStateRef.current = true;
        setPage(nextPage);
        return;
      }
      applyingPopStateRef.current = true;
      setPage("dashboard");
      window.history.replaceState({ page: "dashboard" }, "", window.location.pathname + window.location.search);
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const currentUrl = window.location.pathname + window.location.search;
    if (!pageHistoryReadyRef.current) {
      window.history.replaceState({ page }, "", currentUrl);
      pageHistoryReadyRef.current = true;
      return;
    }
    if (applyingPopStateRef.current) {
      applyingPopStateRef.current = false;
      return;
    }
    window.history.pushState({ page }, "", currentUrl);
  }, [page]);

  const startCreateTicket = (device?: Device, preselectAllFindings = false) => {
    setPage("createTicket");
    setStep(0);
    setSelectedDeviceIds(device ? [device.id] : []);
    setSelectedFindingKeys(device && preselectAllFindings ? getExecutableFindings(device, templates, policySettings).map((finding) => findFindingKey(device.id, finding.id)) : []);
    setPlannedStart(null);
    setPlannedEnd(null);
    setImplementationPlan("");
    setBackoutPlan("");
  };

  const submitTicket = () => {
    const ticketNo = 2846 + tickets.length;
    const crNo = 126 + tickets.length;
    const nextTicket: Ticket = {
      id: `TKT-${ticketNo}`,
      crNumber: `CR-2025-${String(crNo).padStart(6, "0")}`,
      requestor: "Current User",
      requestorRole: currentRole,
      devices: selectedTicketDevices,
      plannedStart: formatDate(plannedStart),
      plannedEnd: "",
      status: "Pending Approval",
      implementationPlan: "",
      backoutPlan: "",
      createdAt: formatDate(new Date()),
    };
    setTickets((prev) => [nextTicket, ...prev]);
    setSelectedTicketDetail(nextTicket);
    setPage("ticketDetail");
    setStep(0);
  };

  const updateTicketStatus = (id: string, status: TicketStatus) => {
    setTickets((prev) => prev.map((ticket) => (ticket.id === id ? { ...ticket, status } : ticket)));
    setSelectedTicketDetail((prev) => prev?.id === id ? { ...prev, status } : prev);
  };

  return (
    <div className="app-shell">
      <style>{styles}</style>
      <SideMenu activePage={page} onNavigate={setPage} onCreate={() => startCreateTicket()} />
      <main className="main-panel">
        <TopBar currentRole={currentRole} setCurrentRole={setCurrentRole} dataMode={dataMode} onDataModeChange={setDataMode} />
        {page === "dashboard" && <DashboardPageWrapper tickets={tickets} onView={(ticket) => { setSelectedTicketDetail(ticket); setPage("ticketDetail"); }} onStatusChange={updateTicketStatus} />}
        {page === "inventory" && (
          <InventoryPageWrapper
            devices={devices}
            templates={templates}
            policySettings={policySettings}
            bulkInventorySelection={bulkInventorySelection}
            setBulkInventorySelection={setBulkInventorySelection}
            onBulkCreate={() => {
              const ids = bulkInventorySelection.map((device) => device.id);
              const findingKeys = bulkInventorySelection.flatMap((device) => getExecutableFindings(device, templates, policySettings).map((finding) => findFindingKey(device.id, finding.id)));
              setSelectedDeviceIds(ids);
              setSelectedFindingKeys(findingKeys);
              setPage("createTicket");
              setStep(0);
            }}
            onCreateTicket={startCreateTicket}
            onViewDevice={(device) => {
              setSelectedDeviceDetail(device);
              setPage("deviceDetail");
            }}
          />
        )}
        {page === "deviceDetail" && selectedDeviceDetail && <DeviceDetailPageWrapper device={selectedDeviceDetail} templates={templates} policySettings={policySettings} onBack={() => setPage("inventory")} onCreateTicket={(device) => startCreateTicket(device, true)} />}
        {page === "ticketDetail" && selectedTicketDetail && <TicketDetailPageWrapper ticket={selectedTicketDetail} templates={templates} policySettings={policySettings} onBack={() => setPage("dashboard")} onStatusChange={updateTicketStatus} />}
        {page === "createTicket" && (
          <CreateTicketPageWrapper
            devices={selectableTicketDevices}
            templates={templates}
            policySettings={policySettings}
            step={step}
            setStep={setStep}
            selectedDeviceIds={selectedDeviceIds}
            setSelectedDeviceIds={setSelectedDeviceIds}
            selectedFindingKeys={selectedFindingKeys}
            setSelectedFindingKeys={setSelectedFindingKeys}
            selectedDevices={selectedDevices}
            selectedTicketDevices={selectedTicketDevices}
            selectedCommandCount={selectedCommandCount}
            plannedStart={plannedStart}
            setPlannedStart={setPlannedStart}
            plannedEnd={plannedEnd}
            setPlannedEnd={setPlannedEnd}
            implementationPlan={implementationPlan}
            setImplementationPlan={setImplementationPlan}
            backoutPlan={backoutPlan}
            setBackoutPlan={setBackoutPlan}
            onCancel={() => setPage("dashboard")}
            onSubmit={submitTicket}
          />
        )}
        {page === "templateRequests" && <TemplateRequestsPageWrapper requests={templateRequests} setRequests={setTemplateRequests} templates={templates} setTemplates={setTemplates} policySettings={policySettings} />}
        {page === "templates" && <TemplatePageWrapper templates={templates} setTemplates={setTemplates} setTemplateRequests={setTemplateRequests} policySettings={policySettings} onRequestSubmitted={() => setPage("templateRequests")} />}
        {page === "developerConsole" && <DeveloperConsolePageWrapper policySettings={policySettings} setPolicySettings={setPolicySettings} />}
      </main>
    </div>
  );
}





