import React from "react";

import DefaultLayout from "../layout/defaultLayout";
import { DeploymentQueuePage } from "./deploymentQueuePage";
import { usePortalDeploymentQueueState } from "./portalRouteState";
import { styles } from "./styles";
import type { DeploymentQueueItem, DeploymentWorkerHealth } from "./types";

type DeploymentQueuePageProps = Partial<React.ComponentProps<typeof DeploymentQueuePage>> & {
  queue?: DeploymentQueueItem[];
  workerHealth?: DeploymentWorkerHealth[];
};

export default function DeploymentQueuePageWrapper(props: DeploymentQueuePageProps = {}) {
  const { queue, workerHealth } = usePortalDeploymentQueueState(props.queue);

  return (
    <DefaultLayout>
      <style>{styles}</style>
      <div className="netcomply-page-wrapper netcomply-deployment-queue-wrapper">
        <DeploymentQueuePage queue={props.queue ?? queue} workerHealth={props.workerHealth ?? workerHealth} />
      </div>
    </DefaultLayout>
  );
}
