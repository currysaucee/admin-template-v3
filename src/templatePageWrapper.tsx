import React from "react";

import { TemplatePage } from "./templatesPage";
import { PortalPageShell } from "./portalPageShell";
import { getInitialPolicySettings, getRuntimeTemplateRequests, getRuntimeTemplates, navigateToPortalPath, portalRoutePaths, saveRuntimeTemplateRequests, saveRuntimeTemplates } from "./portalRouteState";
import type { RemediationTemplate, TemplateRequest } from "./types";

type TemplatePageProps = Partial<React.ComponentProps<typeof TemplatePage>>;

export default function TemplatePageWrapper(props: TemplatePageProps = {}) {
  const [templates, setTemplatesState] = React.useState<RemediationTemplate[]>(getRuntimeTemplates);
  const [, setTemplateRequestsState] = React.useState<TemplateRequest[]>(getRuntimeTemplateRequests);
  const setTemplates: React.Dispatch<React.SetStateAction<RemediationTemplate[]>> = (updater) => {
    setTemplatesState((prev) => {
      const next = typeof updater === "function" ? (updater as (value: RemediationTemplate[]) => RemediationTemplate[])(prev) : updater;
      saveRuntimeTemplates(next);
      return next;
    });
  };
  const setTemplateRequests: React.Dispatch<React.SetStateAction<TemplateRequest[]>> = (updater) => {
    setTemplateRequestsState((prev) => {
      const next = typeof updater === "function" ? (updater as (value: TemplateRequest[]) => TemplateRequest[])(prev) : updater;
      saveRuntimeTemplateRequests(next);
      return next;
    });
  };

  return (
    <PortalPageShell pageName="templates">
      <TemplatePage
        templates={props.templates ?? templates}
        setTemplates={props.setTemplates ?? setTemplates}
        setTemplateRequests={props.setTemplateRequests ?? setTemplateRequests}
        policySettings={props.policySettings ?? getInitialPolicySettings()}
        onRequestSubmitted={props.onRequestSubmitted ?? (() => navigateToPortalPath(portalRoutePaths.templateRequests))}
      />
    </PortalPageShell>
  );
}
