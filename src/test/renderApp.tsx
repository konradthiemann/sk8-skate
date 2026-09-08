import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import { appConfig } from "@/app.config";
import { createTelemetryClient } from "@/lib/telemetry/client";
import { TelemetryProvider } from "@/lib/telemetry/TelemetryProvider";
import type { TelemetryBatch, TelemetrySendOptions } from "@/lib/telemetry/types";
import { routeTree } from "@/routeTree.gen";

interface RenderAppOptions {
  initialPath?: string;
}

/**
 * Renders the full application (routes, providers) against an in-memory
 * history and a telemetry client whose transport is a spy.
 */
export function renderApp({ initialPath = "/" }: RenderAppOptions = {}) {
  const send = vi.fn<(batch: TelemetryBatch, options: TelemetrySendOptions) => Promise<void>>(() =>
    Promise.resolve(),
  );
  const telemetry = createTelemetryClient({ app: appConfig.id, send });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <TelemetryProvider client={telemetry}>
        <RouterProvider router={router} />
      </TelemetryProvider>
    </QueryClientProvider>,
  );

  async function flushedEvents() {
    await telemetry.flush();
    return send.mock.calls.flatMap(([batch]) => batch.events);
  }

  return { ...view, router, telemetry, send, flushedEvents };
}
