import React from "react";

import { TemplatePage } from "./templatesPage";
import { PortalPageShell } from "./portalPageShell";

type TemplatePageProps = React.ComponentProps<typeof TemplatePage>;

export default function TemplatePageWrapper(props: TemplatePageProps) {
  return <PortalPageShell pageName="templates"><TemplatePage {...props} /></PortalPageShell>;
}
