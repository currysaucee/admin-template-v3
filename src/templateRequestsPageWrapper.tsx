import React from "react";

import DefaultLayout from "../layout/defaultLayout";
import { TemplateRequestsPage } from "./templateRequestsPage";
import { getInitialPolicySettings, getRuntimeTemplateRequests, getRuntimeTemplates, saveRuntimeTemplateRequests, saveRuntimeTemplates } from "./portalRouteState";
import { styles } from "./styles";
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
    <DefaultLayout>
      <style>{styles}</style>
      <div className="netcomply-page-wrapper netcomply-template-requests-wrapper">
        <TemplateRequestsPage
          requests={props.requests ?? requests}
          setRequests={props.setRequests ?? setRequests}
          templates={props.templates ?? templates}
          setTemplates={props.setTemplates ?? setTemplates}
          policySettings={props.policySettings ?? getInitialPolicySettings()}
        />
      </div>
    </DefaultLayout>
  );
}
