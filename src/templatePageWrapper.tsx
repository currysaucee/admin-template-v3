import React from "react";

import { TemplatePage } from "./templatesPage";
import { PortalPageShell } from "./portalPageShell";
import { getInitialPolicySettings, getInitialTemplateRequests, getInitialTemplates, navigateToPortalPath, portalRoutePaths } from "./portalRouteState";
import type { RemediationTemplate, TemplateRequest } from "./types";

type TemplatePageProps = Partial<React.ComponentProps<typeof TemplatePage>>;

export default function TemplatePageWrapper(props: TemplatePageProps = {}) {
  const [templates, setTemplates] = React.useState<RemediationTemplate[]>(getInitialTemplates);
  const [, setTemplateRequests] = React.useState<TemplateRequest[]>(getInitialTemplateRequests);

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
