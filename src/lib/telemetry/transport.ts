import type { ApiClient } from "@/lib/api/client";
import type {
  TelemetryBatch,
  TelemetryBatchRequest,
  TelemetryEventRequest,
  TelemetrySend,
} from "./types";

/**
 * Turns recorded events into the exact request body of the contract: `target`
 * and `meta` are optional there with `default: null`, and the app omits them
 * when they do not apply, so the documented default is written explicitly.
 */
export function toRequestBody(batch: TelemetryBatch): TelemetryBatchRequest {
  return {
    app: batch.app,
    sessionId: batch.sessionId,
    events: batch.events.map(
      (event): TelemetryEventRequest => ({
        type: event.type,
        screen: event.screen,
        occurredAt: event.occurredAt,
        target: event.target ?? null,
        meta: event.meta ?? null,
      }),
    ),
  };
}

/**
 * Sends batches through the typed API client (header X-Api-Key included).
 * `keepalive` lets the request finish after the page has been hidden or closed;
 * navigator.sendBeacon is not used because it cannot carry the API key header.
 */
export function createApiTransport(client: ApiClient): TelemetrySend {
  return (batch, { keepalive }) =>
    client.POST("/api/telemetry/events", { body: toRequestBody(batch), keepalive });
}
