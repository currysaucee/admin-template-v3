import React from "react";

export function PortalPageShell({ pageName, children }: { pageName: string; children: React.ReactNode }) {
  return <div className={`netcomply-page-wrapper netcomply-${pageName}-wrapper`}>{children}</div>;
}
