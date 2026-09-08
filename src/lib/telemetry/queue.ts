import type {
  TelemetryApp,
  TelemetryBatch,
  TelemetryEvent,
  TelemetryEventDraft,
  TelemetrySend,
} from "./types";

export const DEFAULT_MAX_EVENTS = 20;
export const DEFAULT_FLUSH_INTERVAL_MS = 10_000;

export interface TelemetryQueueOptions {
  app: TelemetryApp;
  sessionId: string;
  send: TelemetrySend;
  /** Flush as soon as this many events are buffered. */
  maxEvents?: number;
  /** Flush this long after the first buffered event at the latest. */
  flushIntervalMs?: number;
  now?: () => Date;
}

interface FlushOptions {
  keepalive?: boolean;
}

/**
 * Buffers telemetry events and sends them in batches: either when the buffer
 * holds `maxEvents` entries or `flushIntervalMs` after the first entry.
 * Transport errors are swallowed – telemetry must never disturb the app.
 */
export class TelemetryQueue {
  private readonly app: TelemetryApp;
  private readonly sessionId: string;
  private readonly send: TelemetrySend;
  private readonly maxEvents: number;
  private readonly flushIntervalMs: number;
  private readonly now: () => Date;
  private events: TelemetryEvent[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: TelemetryQueueOptions) {
    this.app = options.app;
    this.sessionId = options.sessionId;
    this.send = options.send;
    this.maxEvents = options.maxEvents ?? DEFAULT_MAX_EVENTS;
    this.flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
    this.now = options.now ?? (() => new Date());
  }

  get size(): number {
    return this.events.length;
  }

  push(event: TelemetryEventDraft): void {
    this.events.push({ ...event, occurredAt: event.occurredAt ?? this.now().toISOString() });

    if (this.events.length >= this.maxEvents) {
      void this.flush();
      return;
    }
    if (this.timer === null) {
      this.timer = setTimeout(() => void this.flush(), this.flushIntervalMs);
    }
  }

  /** Sends everything buffered so far. Resolves even when the transport fails. */
  flush(options: FlushOptions = {}): Promise<void> {
    this.clearTimer();
    if (this.events.length === 0) {
      return Promise.resolve();
    }

    const batch: TelemetryBatch = { app: this.app, sessionId: this.sessionId, events: this.events };
    this.events = [];

    try {
      return Promise.resolve(this.send(batch, { keepalive: options.keepalive ?? false })).then(
        () => undefined,
        () => undefined,
      );
    } catch {
      return Promise.resolve();
    }
  }

  /** Stops the pending timer without sending. */
  dispose(): void {
    this.clearTimer();
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
