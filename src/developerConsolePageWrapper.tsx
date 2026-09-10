import React from "react";

import DefaultLayout from "../layout/defaultLayout";
import { runRealScanImport } from "./dataMode";
import { DeveloperConsolePage } from "./developerConsolePage";
import { formatDateTime } from "./helpers";
import { deleteRuntimePolicySettings, extractRuntimePolicySettingsFromDocument, lookupRuntimePolicySetting, onboardRuntimePolicySettings, usePortalDeploymentQueue, usePortalDevices, usePortalPolicySettings } from "./portalRouteState";
import { styles } from "./styles";
import type { PolicySetting } from "./types";

type DeveloperConsolePageProps = Partial<React.ComponentProps<typeof DeveloperConsolePage>>;

export default function DeveloperConsolePageWrapper(props: DeveloperConsolePageProps = {}) {
  const { items: loadedPolicySettings } = usePortalPolicySettings(props.policySettings);
  const { devices } = usePortalDevices();
  const { items: deploymentQueue } = usePortalDeploymentQueue();
  const [policySettings, setPolicySettingsState] = React.useState<PolicySetting[]>(loadedPolicySettings);
  const [scanImportRunning, setScanImportRunning] = React.useState(false);
  const [scanImportMessage, setScanImportMessage] = React.useState("");

  React.useEffect(() => setPolicySettingsState(loadedPolicySettings), [loadedPolicySettings]);

  const setPolicySettings: React.Dispatch<React.SetStateAction<PolicySetting[]>> = (updater) => {
    setPolicySettingsState((prev) => {
      return typeof updater === "function" ? (updater as (value: PolicySetting[]) => PolicySetting[])(prev) : updater;
    });
  };

  const lastScanAt = devices.find((device) => device.lastScanned)?.lastScanned ?? "";

  const runScanImport = async () => {
    setScanImportRunning(true);
    setScanImportMessage("Scan import is running. Please wait...");
    try {
      const result = await runRealScanImport();
      const scan = result.scan && typeof result.scan === "object" ? result.scan as { consumedAt?: string; deviceCount?: number; nonCompliantDeviceCount?: number } : {};
      const importedAt = scan.consumedAt ? formatDateTime(scan.consumedAt) : "just now";
      setScanImportMessage(`Scan imported at ${importedAt}. ${scan.nonCompliantDeviceCount ?? 0} non-compliant device(s) found from ${scan.deviceCount ?? 0} scanned device(s). Refreshing data...`);
      window.location.reload();
    } catch (error) {
      setScanImportMessage(error instanceof Error ? error.message : "Unable to run scan import.");
    } finally {
      setScanImportRunning(false);
    }
  };

  return (
    <DefaultLayout>
      <style>{styles}</style>
      <div className="netcomply-page-wrapper netcomply-developer-wrapper">
        <DeveloperConsolePage
          policySettings={props.policySettings ?? policySettings}
          deploymentQueue={props.deploymentQueue ?? deploymentQueue}
          setPolicySettings={props.setPolicySettings ?? setPolicySettings}
          onOnboardPolicySettings={props.onOnboardPolicySettings ?? onboardRuntimePolicySettings}
          onLookupPolicySetting={props.onLookupPolicySetting ?? lookupRuntimePolicySetting}
          onDeletePolicySetting={props.onDeletePolicySetting ?? ((id) => deleteRuntimePolicySettings([id]))}
          onExtractDocument={props.onExtractDocument ?? extractRuntimePolicySettingsFromDocument}
          onRunScanImport={props.onRunScanImport ?? runScanImport}
          scanImportRunning={props.scanImportRunning ?? scanImportRunning}
          scanImportMessage={props.scanImportMessage ?? scanImportMessage}
          lastScanAt={props.lastScanAt ?? lastScanAt}
        />
      </div>
    </DefaultLayout>
  );
}
