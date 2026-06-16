import React from "react";

import { TemplateRequestsPage } from "./templateRequestsPage";
import { PortalPageShell } from "./portalPageShell";
import { getInitialPolicySettings, getRuntimeTemplateRequests, getRuntimeTemplates, saveRuntimeTemplateRequests, saveRuntimeTemplates } from "./portalRouteState";
import type { RemediationTemplate, TemplateRequest } from "./types";

type TemplateRequestsPageProps = Partial<React.ComponentProps<typeof TemplateRequestsPage>>;

export default function TemplateRequestsPageWrapper(props: TemplateRequestsPageProps = {}) {
  const [requests, setRequestsState] = React.useState<TemplateRequest[]>(getRuntimeTemplateRequests);
  const [templates, setTemplatesState] = React.useState<RemediationTemplate[]>(getRuntimeTemplates);
  const setRequests: React.Dispatch<React.SetStateAction<TemplateRequest[]>> = (updater) => {
    setRequestsState((prev) => {
      const next = typeof updater === "function" ? (updater as (value: TemplateRequest[]) => TemplateRequest[])(prev) : updater;
      saveRuntimeTemplateRequests(next);
      return next;
    });
  };
  const setTemplates: React.Dispatch<React.SetStateAction<RemediationTemplate[]>> = (updater) => {
    setTemplatesState((prev) => {
      const next = typeof updater === "function" ? (updater as (value: RemediationTemplate[]) => RemediationTemplate[])(prev) : updater;
      saveRuntimeTemplates(next);
      return next;
    });
  };

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
