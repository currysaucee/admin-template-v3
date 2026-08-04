import React from "react";

import DefaultLayout from "../layout/defaultLayout";
import { DeveloperConsolePage } from "./developerConsolePage";
import { deleteRuntimePolicySettings, extractRuntimePolicySettingsFromDocument, onboardRuntimePolicySettings, saveRuntimePolicySettings, usePortalPolicySettings } from "./portalRouteState";
import { styles } from "./styles";
import type { PolicySetting } from "./types";

type DeveloperConsolePageProps = Partial<React.ComponentProps<typeof DeveloperConsolePage>>;

export default function DeveloperConsolePageWrapper(props: DeveloperConsolePageProps = {}) {
  const { items: loadedPolicySettings } = usePortalPolicySettings(props.policySettings);
  const [policySettings, setPolicySettingsState] = React.useState<PolicySetting[]>(loadedPolicySettings);

  React.useEffect(() => setPolicySettingsState(loadedPolicySettings), [loadedPolicySettings]);

  const setPolicySettings: React.Dispatch<React.SetStateAction<PolicySetting[]>> = (updater) => {
    setPolicySettingsState((prev) => {
      const next = typeof updater === "function" ? (updater as (value: PolicySetting[]) => PolicySetting[])(prev) : updater;
      saveRuntimePolicySettings(next);
      return next;
    });
  };

  return (
    <DefaultLayout>
      <style>{styles}</style>
      <div className="netcomply-page-wrapper netcomply-developer-wrapper">
        <DeveloperConsolePage
          policySettings={props.policySettings ?? policySettings}
          setPolicySettings={props.setPolicySettings ?? setPolicySettings}
          onOnboardPolicySettings={props.onOnboardPolicySettings ?? onboardRuntimePolicySettings}
          onDeletePolicySetting={props.onDeletePolicySetting ?? ((id) => deleteRuntimePolicySettings([id]))}
          onExtractDocument={props.onExtractDocument ?? extractRuntimePolicySettingsFromDocument}
        />
      </div>
    </DefaultLayout>
  );
}
