import { render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { appConfig } from "@/app.config";
import { createTelemetryClient } from "./client";
import { TelemetryProvider } from "./TelemetryProvider";
import type { TelemetryBatch } from "./types";
import { useTelemetry } from "./useTelemetry";

const SESSION_ID = "6f1c2c0a-0f4e-4d2a-9b1e-2a6d3f4c5b6a";

function createFakeClient() {
  const send = vi.fn<(batch: TelemetryBatch) => Promise<void>>(() => Promise.resolve());
  const client = createTelemetryClient({ app: appConfig.id, sessionId: SESSION_ID, send });
  return { client, send };
}

function SessionLabel() {
  const telemetry = useTelemetry();
  return (
    <p>
      Session {telemetry.sessionId} ({telemetry.enabled ? "aktiv" : "aus"})
    </p>
  );
}

function TrackedButton() {
  const telemetry = useTelemetry();
  return (
    <button type="button" onClick={() => telemetry.trackInteraction("test.click")}>
      Klick
    </button>
  );
}

describe("TelemetryProvider", () => {
  it("hands the client to descendants via useTelemetry", () => {
    const { client } = createFakeClient();
    render(
      <TelemetryProvider client={client}>
        <SessionLabel />
      </TelemetryProvider>,
    );

    expect(screen.getByText(`Session ${SESSION_ID} (aktiv)`)).toBeInTheDocument();
  });

  it("starts the client on mount and stops it on unmount", () => {
    const { client } = createFakeClient();
    const stop = vi.fn();
    const start = vi.spyOn(client, "start").mockReturnValue(stop);

    const { unmount } = render(
      <TelemetryProvider client={client}>
        <span>Inhalt</span>
      </TelemetryProvider>,
    );
    expect(start).toHaveBeenCalledTimes(1);
    expect(stop).not.toHaveBeenCalled();

    unmount();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("lets components record interactions programmatically", async () => {
    const { client, send } = createFakeClient();
    const user = userEvent.setup();
    render(
      <TelemetryProvider client={client}>
        <TrackedButton />
      </TelemetryProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Klick" }));
    await client.flush();

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0].events).toEqual([
      expect.objectContaining({ type: "interaction", target: "test.click" }),
    ]);
  });

  it("creates a working default client from the environment when none is injected", () => {
    render(
      <TelemetryProvider>
        <SessionLabel />
      </TelemetryProvider>,
    );

    expect(screen.getByText(/^Session [0-9a-f-]{36} \(aktiv\)$/i)).toBeInTheDocument();
  });
});

describe("useTelemetry", () => {
  it("falls back to a disabled no-op client outside a provider", () => {
    const { result } = renderHook(() => useTelemetry());

    expect(result.current.enabled).toBe(false);
    expect(() => result.current.trackInteraction("x.y")).not.toThrow();
    expect(() => result.current.trackScreen("/")).not.toThrow();
  });
});
