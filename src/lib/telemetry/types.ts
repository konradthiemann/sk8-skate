import type { components } from "@/lib/api/schema";

/*
 * Wire types come from the generated OpenAPI schema (`pnpm gen:api`).
 * Everything below is derived from them – no union is written twice, so a
 * change to the backend contract breaks the build instead of drifting.
 */

/** Request body of `POST /api/telemetry/events`. */
export type TelemetryBatchRequest = components["schemas"]["TelemetryBatchRequest"];

/** One event inside that request body. */
export type TelemetryEventRequest = components["schemas"]["TelemetryEventInput"];

/** "skate" | "nutrition" | "habits" (inline enum on the batch schema). */
export type TelemetryApp = TelemetryBatchRequest["app"];

/** "screen_view" | "time_on_screen" | "interaction" | "navigation". */
export type TelemetryEventType = TelemetryEventRequest["type"];

/** Free-form event details; keys depend on the event type. */
export type TelemetryMeta = NonNullable<TelemetryEventRequest["meta"]>;

/**
 * `target` and `meta` are optional in the contract (neither is in `required`,
 * both declare `default: null`), but the generator emits them as mandatory
 * because they have a default. Restore the optionality the contract grants;
 * the transport writes the documented null default before sending.
 */
type OptionalInContract = "target" | "meta";

/** An event as the app records it. */
export type TelemetryEvent = Omit<TelemetryEventRequest, OptionalInContract> &
  Partial<Pick<TelemetryEventRequest, OptionalInContract>>;

/** A batch of recorded events, before it is turned into a request body. */
export type TelemetryBatch = Omit<TelemetryBatchRequest, "events"> & {
  events: TelemetryEvent[];
};

/** What callers hand to the queue; `occurredAt` is stamped automatically when missing. */
export type TelemetryEventDraft = Omit<TelemetryEvent, "occurredAt"> & { occurredAt?: string };

export interface TelemetrySendOptions {
  /** True when flushing during page hide, so the request may outlive the page. */
  keepalive: boolean;
}

/** Transport used by the queue. Failures are swallowed by the caller. */
export type TelemetrySend = (
  batch: TelemetryBatch,
  options: TelemetrySendOptions,
) => Promise<unknown> | unknown;
