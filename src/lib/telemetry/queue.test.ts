import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appConfig } from "@/app.config";
import { DEFAULT_FLUSH_INTERVAL_MS, DEFAULT_MAX_EVENTS, TelemetryQueue } from "./queue";
import type { TelemetryBatch, TelemetrySendOptions } from "./types";

const SESSION_ID = "6f1c2c0a-0f4e-4d2a-9b1e-2a6d3f4c5b6a";

function createQueue(overrides: Partial<ConstructorParameters<typeof TelemetryQueue>[0]> = {}) {
  const send = vi.fn<(batch: TelemetryBatch, options: TelemetrySendOptions) => Promise<void>>(() =>
    Promise.resolve(),
  );
  const queue = new TelemetryQueue({
    app: appConfig.id,
    sessionId: SESSION_ID,
    send,
    ...overrides,
  });
  return { queue, send };
}

describe("TelemetryQueue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-07T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the limits from the telemetry ADR by default", () => {
    expect(DEFAULT_MAX_EVENTS).toBe(20);
    expect(DEFAULT_FLUSH_INTERVAL_MS).toBe(10_000);
  });

  it("sends nothing while fewer than 20 events are queued and the interval has not elapsed", () => {
    const { queue, send } = createQueue();
    for (let i = 0; i < 19; i++) {
      queue.push({ type: "interaction", screen: "/", target: `button-${i}` });
    }
    vi.advanceTimersByTime(DEFAULT_FLUSH_INTERVAL_MS - 1);

    expect(send).not.toHaveBeenCalled();
    expect(queue.size).toBe(19);
  });

  it("flushes immediately once 20 events are queued", () => {
    const { queue, send } = createQueue();
    for (let i = 0; i < 20; i++) {
      queue.push({ type: "interaction", screen: "/", target: `button-${i}` });
    }

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0].events).toHaveLength(20);
    expect(queue.size).toBe(0);
  });

  it("flushes a single event after 10 seconds", () => {
    const { queue, send } = createQueue();
    queue.push({ type: "screen_view", screen: "/" });

    vi.advanceTimersByTime(DEFAULT_FLUSH_INTERVAL_MS - 1);
    expect(send).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0].events).toHaveLength(1);
  });

  it("restarts the interval after a flush", () => {
    const { queue, send } = createQueue();
    queue.push({ type: "screen_view", screen: "/" });
    vi.advanceTimersByTime(DEFAULT_FLUSH_INTERVAL_MS);
    expect(send).toHaveBeenCalledTimes(1);

    queue.push({ type: "screen_view", screen: "/sessions" });
    vi.advanceTimersByTime(DEFAULT_FLUSH_INTERVAL_MS - 1);
    expect(send).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("never sends an empty batch", async () => {
    const { queue, send } = createQueue();
    vi.advanceTimersByTime(DEFAULT_FLUSH_INTERVAL_MS * 3);
    await queue.flush();

    expect(send).not.toHaveBeenCalled();
  });

  it("builds a batch with app, sessionId and ISO 8601 timestamps", async () => {
    const { queue, send } = createQueue();
    queue.push({ type: "screen_view", screen: "/", meta: { from: null } });
    vi.setSystemTime(new Date("2026-09-07T10:00:05.000Z"));
    queue.push({ type: "interaction", screen: "/", target: "start.tricks" });
    await queue.flush();

    expect(send).toHaveBeenCalledWith(
      {
        app: appConfig.id,
        sessionId: SESSION_ID,
        events: [
          {
            type: "screen_view",
            screen: "/",
            meta: { from: null },
            occurredAt: "2026-09-07T10:00:00.000Z",
          },
          {
            type: "interaction",
            screen: "/",
            target: "start.tricks",
            occurredAt: "2026-09-07T10:00:05.000Z",
          },
        ],
      },
      { keepalive: false },
    );
  });

  it("keeps an explicitly provided occurredAt", async () => {
    const { queue, send } = createQueue();
    queue.push({ type: "navigation", screen: "/", occurredAt: "2026-01-01T00:00:00.000Z" });
    await queue.flush();

    expect(send.mock.calls[0]?.[0].events[0]?.occurredAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("passes keepalive through for page-hide flushes", async () => {
    const { queue, send } = createQueue();
    queue.push({ type: "screen_view", screen: "/" });
    await queue.flush({ keepalive: true });

    expect(send.mock.calls[0]?.[1]).toEqual({ keepalive: true });
  });

  it("honours custom limits", () => {
    const { queue, send } = createQueue({ maxEvents: 2, flushIntervalMs: 500 });
    queue.push({ type: "screen_view", screen: "/" });
    vi.advanceTimersByTime(500);
    expect(send).toHaveBeenCalledTimes(1);

    queue.push({ type: "screen_view", screen: "/a" });
    queue.push({ type: "screen_view", screen: "/b" });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("swallows rejected sends and drops the events", async () => {
    const { queue, send } = createQueue();
    send.mockRejectedValueOnce(new Error("network down"));
    queue.push({ type: "screen_view", screen: "/" });

    await expect(queue.flush()).resolves.toBeUndefined();
    expect(queue.size).toBe(0);
  });

  it("swallows synchronous transport errors", async () => {
    const { queue, send } = createQueue();
    send.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    queue.push({ type: "screen_view", screen: "/" });

    await expect(queue.flush()).resolves.toBeUndefined();
  });

  it("stops the timer when disposed", () => {
    const { queue, send } = createQueue();
    queue.push({ type: "screen_view", screen: "/" });
    queue.dispose();
    vi.advanceTimersByTime(DEFAULT_FLUSH_INTERVAL_MS * 2);

    expect(send).not.toHaveBeenCalled();
  });
});
