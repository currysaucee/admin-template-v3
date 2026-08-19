import React from "react";

import DefaultLayout from "../layout/defaultLayout";
import { DeploymentQueuePage } from "./deploymentQueuePage";
import { usePortalDeploymentQueue } from "./portalRouteState";
import { styles } from "./styles";
import type { DeploymentQueueItem } from "./types";

type DeploymentQueuePageProps = Partial<React.ComponentProps<typeof DeploymentQueuePage>> & {
  queue?: DeploymentQueueItem[];
};

export default function DeploymentQueuePageWrapper(props: DeploymentQueuePageProps = {}) {
  const { items: queue } = usePortalDeploymentQueue(props.queue);

  return (
    <DefaultLayout>
      <style>{styles}</style>
      <div className="netcomply-page-wrapper netcomply-deployment-queue-wrapper">
        <DeploymentQueuePage queue={props.queue ?? queue} />
      </div>
    </DefaultLayout>
  );
}
