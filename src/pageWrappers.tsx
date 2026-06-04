import React from "react";

import { DashboardPage, DeviceDetailPage, InventoryPage } from "./dashboardInventory";
import { TemplateRequestsPage } from "./templateRequestsPage";
import { TemplatePage } from "./templatesPage";
import { TicketDetailPage } from "./ticketDetail";
import { CreateTicketPage } from "./ticketWorkflow";

type DashboardPageProps = React.ComponentProps<typeof DashboardPage>;
type InventoryPageProps = React.ComponentProps<typeof InventoryPage>;
type DeviceDetailPageProps = React.ComponentProps<typeof DeviceDetailPage>;
type TicketDetailPageProps = React.ComponentProps<typeof TicketDetailPage>;
type CreateTicketPageProps = React.ComponentProps<typeof CreateTicketPage>;
type TemplateRequestsPageProps = React.ComponentProps<typeof TemplateRequestsPage>;
type TemplatePageProps = React.ComponentProps<typeof TemplatePage>;

function PortalPageWrapper({ pageName, children }: { pageName: string; children: React.ReactNode }) {
  return <div className={`netcomply-page-wrapper netcomply-${pageName}-wrapper`}>{children}</div>;
}

export function DashboardPageWrapper(props: DashboardPageProps) {
  return <PortalPageWrapper pageName="dashboard"><DashboardPage {...props} /></PortalPageWrapper>;
}

export function InventoryPageWrapper(props: InventoryPageProps) {
  return <PortalPageWrapper pageName="exceptions"><InventoryPage {...props} /></PortalPageWrapper>;
}

export function DeviceDetailPageWrapper(props: DeviceDetailPageProps) {
  return <PortalPageWrapper pageName="device-detail"><DeviceDetailPage {...props} /></PortalPageWrapper>;
}

export function TicketDetailPageWrapper(props: TicketDetailPageProps) {
  return <PortalPageWrapper pageName="ticket-detail"><TicketDetailPage {...props} /></PortalPageWrapper>;
}

export function CreateTicketPageWrapper(props: CreateTicketPageProps) {
  return <PortalPageWrapper pageName="create-ticket"><CreateTicketPage {...props} /></PortalPageWrapper>;
}

export function TemplateRequestsPageWrapper(props: TemplateRequestsPageProps) {
  return <PortalPageWrapper pageName="template-requests"><TemplateRequestsPage {...props} /></PortalPageWrapper>;
}

export function TemplatePageWrapper(props: TemplatePageProps) {
  return <PortalPageWrapper pageName="templates"><TemplatePage {...props} /></PortalPageWrapper>;
}
