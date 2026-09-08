import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appConfig } from "@/app.config";
import { createTelemetryClient, type TelemetryClient } from "./client";
import type { TelemetryBatch, TelemetrySendOptions } from "./types";

const SESSION_ID = "6f1c2c0a-0f4e-4d2a-9b1e-2a6d3f4c5b6a";

type SendSpy = ReturnType<
  typeof vi.fn<(batch: TelemetryBatch, options: TelemetrySendOptions) => Promise<void>>
>;

function setup(overrides: Partial<Parameters<typeof createTelemetryClient>[0]> = {}) {
  const send: SendSpy = vi.fn(() => Promise.resolve());
  const client = createTelemetryClient({
    app: appConfig.id,
    sessionId: SESSION_ID,
    send,
    ...overrides,
  });
  return { client, send };
}

async function flushedEvents(client: TelemetryClient, send: SendSpy) {
  await client.flush();
  return send.mock.calls.flatMap(([batch]) => batch.events);
}

/** Deterministic clock for tests that assert on timestamps and durations. */
function useFrozenClock() {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-07T10:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });
}

describe("createTelemetryClient", () => {
  let stop: (() => void) | undefined;

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    stop?.();
    stop = undefined;
  });

  it("exposes app, session id and enabled state", () => {
    const { client } = setup();
    expect(client.app).toBe(appConfig.id);
    expect(client.sessionId).toBe(SESSION_ID);
    expect(client.enabled).toBe(true);
    expect(client.currentScreen).toBeNull();
  });

  it("generates a UUID session id when none is given", () => {
    const { client } = setup({ sessionId: undefined });
    expect(client.sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  describe("screen tracking", () => {
    useFrozenClock();

    it("emits screen_view on entering and time_on_screen with ms on leaving a screen", async () => {
      const { client, send } = setup();
      client.trackScreen("/");
      vi.advanceTimersByTime(1500);
      client.trackScreen("/tricks");

      const events = await flushedEvents(client, send);
      expect(events).toEqual([
        {
          type: "screen_view",
          screen: "/",
          meta: { from: null },
          occurredAt: "2026-09-07T10:00:00.000Z",
        },
        {
          type: "time_on_screen",
          screen: "/",
          meta: { ms: 1500 },
          occurredAt: "2026-09-07T10:00:01.500Z",
        },
        {
          type: "screen_view",
          screen: "/tricks",
          meta: { from: "/" },
          occurredAt: "2026-09-07T10:00:01.500Z",
        },
      ]);
      expect(client.currentScreen).toBe("/tricks");
    });

    it("ignores repeated calls for the same screen", async () => {
      const { client, send } = setup();
      client.trackScreen("/");
      client.trackScreen("/");

      const events = await flushedEvents(client, send);
      expect(events).toHaveLength(1);
    });
  });

  describe("navigation", () => {
    useFrozenClock();

    it("records navigation with from, to and via", async () => {
      const { client, send } = setup();
      client.trackScreen("/");
      client.trackNavigation("/sessions", "bottom-nav");

      const events = await flushedEvents(client, send);
      expect(events[1]).toEqual({
        type: "navigation",
        screen: "/",
        target: "/sessions",
        meta: { from: "/", to: "/sessions", via: "bottom-nav" },
        occurredAt: "2026-09-07T10:00:00.000Z",
      });
    });
  });

  describe("interactions", () => {
    const user = userEvent.setup();

    it("records clicks on elements marked with data-track, resolved via closest()", async () => {
      const { client, send } = setup();
      stop = client.start();
      client.trackScreen("/");
      document.body.innerHTML =
        '<button type="button" data-track="start.tricks"><span>Trick-Tree</span></button>';

      await user.click(document.querySelector("span") as HTMLElement);

      const events = await flushedEvents(client, send);
      expect(events).toContainEqual(
        expect.objectContaining({
          type: "interaction",
          screen: "/",
          target: "start.tricks",
          meta: expect.objectContaining({ via: "click", tag: "button" }),
        }),
      );
    });

    it("records form submits on forms marked with data-track", async () => {
      const { client, send } = setup();
      stop = client.start();
      client.trackScreen("/sessions");
      document.body.innerHTML =
        '<form data-track="session.create"><button type="submit">Speichern</button></form>';
      document.querySelector("form")?.addEventListener("submit", (event) => event.preventDefault());

      await user.click(document.querySelector("button") as HTMLElement);

      const events = await flushedEvents(client, send);
      expect(events).toContainEqual(
        expect.objectContaining({
          type: "interaction",
          screen: "/sessions",
          target: "session.create",
          meta: expect.objectContaining({ via: "submit", tag: "form" }),
        }),
      );
    });

    it("ignores clicks on elements without data-track", async () => {
      const { client, send } = setup();
      stop = client.start();
      document.body.innerHTML = '<button type="button">Ohne Tracking</button>';

      await user.click(document.querySelector("button") as HTMLElement);

      expect(await flushedEvents(client, send)).toHaveLength(0);
    });

    it("stops listening after the cleanup function is called", async () => {
      const { client, send } = setup();
      const cleanup = client.start();
      document.body.innerHTML = '<button type="button" data-track="x.y">X</button>';
      cleanup();

      await user.click(document.querySelector("button") as HTMLElement);

      expect(await flushedEvents(client, send)).toHaveLength(0);
    });
  });

  describe("lifecycle", () => {
    useFrozenClock();

    it("flushes with keepalive and closes the current screen on pagehide", () => {
      const { client, send } = setup();
      stop = client.start();
      client.trackScreen("/");
      vi.advanceTimersByTime(2000);

      window.dispatchEvent(new Event("pagehide"));

      expect(send).toHaveBeenCalledTimes(1);
      const [batch, options] = send.mock.calls[0] ?? [];
      expect(options).toEqual({ keepalive: true });
      expect(batch?.events.map((event) => event.type)).toEqual(["screen_view", "time_on_screen"]);
      expect(batch?.events[1]?.meta).toEqual({ ms: 2000 });
    });

    it("flushes when the document becomes hidden", () => {
      const { client, send } = setup();
      stop = client.start();
      client.trackScreen("/");

      vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
      document.dispatchEvent(new Event("visibilitychange"));

      expect(send).toHaveBeenCalledTimes(1);
      expect(send.mock.calls[0]?.[1]).toEqual({ keepalive: true });
    });

    it("does not flush when the document becomes visible again", () => {
      const { client, send } = setup();
      stop = client.start();
      client.trackScreen("/");

      vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
      document.dispatchEvent(new Event("visibilitychange"));

      expect(send).not.toHaveBeenCalled();
    });
  });

  describe("disabled", () => {
    const user = userEvent.setup();

    it("records nothing and never sends", async () => {
      const { client, send } = setup({ enabled: false });
      stop = client.start();
      client.trackScreen("/");
      client.trackNavigation("/x", "test");
      client.track({ type: "interaction", screen: "/", target: "manual" });
      document.body.innerHTML = '<button type="button" data-track="a.b">A</button>';
      await user.click(document.querySelector("button") as HTMLElement);
      window.dispatchEvent(new Event("pagehide"));

      expect(client.enabled).toBe(false);
      expect(client.currentScreen).toBeNull();
      expect(await flushedEvents(client, send)).toHaveLength(0);
    });
  });
});
