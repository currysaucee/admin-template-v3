import React from "react";

import { TemplateRequestsPage } from "./templateRequestsPage";
import { PortalPageShell } from "./portalPageShell";

type TemplateRequestsPageProps = React.ComponentProps<typeof TemplateRequestsPage>;

export default function TemplateRequestsPageWrapper(props: TemplateRequestsPageProps) {
  return <PortalPageShell pageName="template-requests"><TemplateRequestsPage {...props} /></PortalPageShell>;
}
