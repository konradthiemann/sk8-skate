import { type ReactNode, useEffect, useMemo } from "react";
import { appConfig } from "@/app.config";
import { api } from "@/lib/api/client";
import { env } from "@/lib/env";
import { createTelemetryClient, type TelemetryClient } from "./client";
import { TelemetryContext } from "./context";
import { sessionId } from "./session";
import { createApiTransport } from "./transport";

interface TelemetryProviderProps {
  /** Inject a client (tests, storybook); defaults to one built from the environment. */
  client?: TelemetryClient;
  children: ReactNode;
}

function createDefaultClient(): TelemetryClient {
  return createTelemetryClient({
    app: appConfig.id,
    sessionId,
    enabled: env.telemetryEnabled && env.apiUrl.length > 0,
    send: createApiTransport(api),
  });
}

export function TelemetryProvider({ client, children }: TelemetryProviderProps) {
  const value = useMemo(() => client ?? createDefaultClient(), [client]);

  useEffect(() => value.start(), [value]);

  return <TelemetryContext value={value}>{children}</TelemetryContext>;
}
