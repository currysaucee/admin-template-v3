import React from "react";

import { TemplateRequestsPage } from "./templateRequestsPage";
import { PortalPageShell } from "./portalPageShell";
import { getInitialPolicySettings, getInitialTemplateRequests, getInitialTemplates } from "./portalRouteState";
import type { RemediationTemplate, TemplateRequest } from "./types";

type TemplateRequestsPageProps = Partial<React.ComponentProps<typeof TemplateRequestsPage>>;

export default function TemplateRequestsPageWrapper(props: TemplateRequestsPageProps) {
  const [requests, setRequests] = React.useState<TemplateRequest[]>(getInitialTemplateRequests);
  const [templates, setTemplates] = React.useState<RemediationTemplate[]>(getInitialTemplates);

  return (
    <PortalPageShell pageName="template-requests">
      <TemplateRequestsPage
        requests={props.requests ?? requests}
        setRequests={props.setRequests ?? setRequests}
        templates={props.templates ?? templates}
        setTemplates={props.setTemplates ?? setTemplates}
        policySettings={props.policySettings ?? getInitialPolicySettings()}
      />
    </PortalPageShell>
  );
}
