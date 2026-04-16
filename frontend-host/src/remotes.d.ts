declare module "reduxApp/RemoteDashboard" {
  import type { ComponentType } from "react";
  import type { MicrofrontendProps } from "@shared";

  const RemoteDashboard: ComponentType<MicrofrontendProps>;
  export default RemoteDashboard;
}

declare module "mobxApp/RemoteDashboard" {
  import type { ComponentType } from "react";
  import type { MicrofrontendProps } from "@shared";

  const RemoteDashboard: ComponentType<MicrofrontendProps>;
  export default RemoteDashboard;
}
