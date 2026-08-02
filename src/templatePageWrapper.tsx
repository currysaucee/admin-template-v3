import React from "react";

import DefaultLayout from "../layout/defaultLayout";
import { TemplatePage } from "./templatesPage";
import { navigateToPortalPath, portalRoutePaths, saveRuntimeTemplateRequests, saveRuntimeTemplates, usePortalPolicySettings, usePortalTemplateRequests, usePortalTemplates } from "./portalRouteState";
import { styles } from "./styles";
import type { RemediationTemplate, TemplateRequest } from "./types";

type TemplatePageProps = Partial<React.ComponentProps<typeof TemplatePage>>;

export default function TemplatePageWrapper(props: TemplatePageProps = {}) {
  const { items: loadedTemplates } = usePortalTemplates(props.templates);
  const { items: loadedTemplateRequests } = usePortalTemplateRequests();
  const { items: policySettings } = usePortalPolicySettings(props.policySettings);
  const [templates, setTemplatesState] = React.useState<RemediationTemplate[]>(loadedTemplates);
  const [, setTemplateRequestsState] = React.useState<TemplateRequest[]>(loadedTemplateRequests);
  React.useEffect(() => setTemplatesState(loadedTemplates), [loadedTemplates]);
  React.useEffect(() => setTemplateRequestsState(loadedTemplateRequests), [loadedTemplateRequests]);
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
    <DefaultLayout>
      <style>{styles}</style>
      <div className="netcomply-page-wrapper netcomply-templates-wrapper">
        <TemplatePage
          templates={props.templates ?? templates}
          setTemplates={props.setTemplates ?? setTemplates}
          setTemplateRequests={props.setTemplateRequests ?? setTemplateRequests}
          policySettings={policySettings}
          onRequestSubmitted={props.onRequestSubmitted ?? (() => navigateToPortalPath(portalRoutePaths.templateRequests))}
        />
      </div>
    </DefaultLayout>
  );
}
