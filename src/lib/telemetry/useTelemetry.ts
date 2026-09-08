import { useContext } from "react";
import { appConfig } from "@/app.config";
import { createTelemetryClient, type TelemetryClient } from "./client";
import { TelemetryContext } from "./context";

let disabledClient: TelemetryClient | undefined;

function getDisabledClient(): TelemetryClient {
  disabledClient ??= createTelemetryClient({
    app: appConfig.id,
    enabled: false,
    send: () => undefined,
  });
  return disabledClient;
}

/** Access the telemetry client. Outside a provider a disabled no-op client is returned. */
export function useTelemetry(): TelemetryClient {
  return useContext(TelemetryContext) ?? getDisabledClient();
}
