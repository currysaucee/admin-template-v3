import React from "react";

import DefaultLayout from "../layout/defaultLayout";
import { TemplateRequestsPage } from "./templateRequestsPage";
import { saveRuntimeTemplateRequests, saveRuntimeTemplates, usePortalPolicySettings, usePortalTemplateRequests, usePortalTemplates } from "./portalRouteState";
import { styles } from "./styles";
import type { RemediationTemplate, TemplateRequest } from "./types";

type TemplateRequestsPageProps = Partial<React.ComponentProps<typeof TemplateRequestsPage>>;

export default function TemplateRequestsPageWrapper(props: TemplateRequestsPageProps = {}) {
  const { items: loadedRequests } = usePortalTemplateRequests(props.requests);
  const { items: loadedTemplates } = usePortalTemplates(props.templates);
  const { items: policySettings } = usePortalPolicySettings(props.policySettings);
  const [requests, setRequestsState] = React.useState<TemplateRequest[]>(loadedRequests);
  const [templates, setTemplatesState] = React.useState<RemediationTemplate[]>(loadedTemplates);
  React.useEffect(() => setRequestsState(loadedRequests), [loadedRequests]);
  React.useEffect(() => setTemplatesState(loadedTemplates), [loadedTemplates]);
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
    <DefaultLayout>
      <style>{styles}</style>
      <div className="netcomply-page-wrapper netcomply-template-requests-wrapper">
        <TemplateRequestsPage
          requests={props.requests ?? requests}
          setRequests={props.setRequests ?? setRequests}
          templates={props.templates ?? templates}
          setTemplates={props.setTemplates ?? setTemplates}
          policySettings={policySettings}
        />
      </div>
    </DefaultLayout>
  );
}
