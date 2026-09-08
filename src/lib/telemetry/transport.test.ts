import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "@/lib/api/client";
import { API_URL, TEST_API_KEY } from "@/test/msw/handlers";
import { server } from "@/test/msw/server";
import { createApiTransport, toRequestBody } from "./transport";
import type { TelemetryBatch } from "./types";

const SESSION_ID = "6f1c2c0a-0f4e-4d2a-9b1e-2a6d3f4c5b6a";

const batch: TelemetryBatch = {
  app: "skate",
  sessionId: SESSION_ID,
  events: [
    // No target, no meta: both are optional in the contract.
    { type: "screen_view", screen: "/", occurredAt: "2026-09-07T10:00:00.000Z" },
    {
      type: "interaction",
      screen: "/",
      target: "start.tricks",
      meta: { via: "click", tag: "button" },
      occurredAt: "2026-09-07T10:00:01.000Z",
    },
  ],
};

function client() {
  return createApiClient({ baseUrl: API_URL, apiKey: TEST_API_KEY });
}

describe("toRequestBody", () => {
  it("writes the documented null default for omitted target and meta", () => {
    expect(toRequestBody(batch)).toEqual({
      app: "skate",
      sessionId: SESSION_ID,
      events: [
        {
          type: "screen_view",
          screen: "/",
          target: null,
          meta: null,
          occurredAt: "2026-09-07T10:00:00.000Z",
        },
        {
          type: "interaction",
          screen: "/",
          target: "start.tricks",
          meta: { via: "click", tag: "button" },
          occurredAt: "2026-09-07T10:00:01.000Z",
        },
      ],
    });
  });

  it("keeps an explicit null apart from a missing value", () => {
    const body = toRequestBody({
      ...batch,
      events: [
        { type: "navigation", screen: "/", target: null, occurredAt: "2026-09-07T10:00:00.000Z" },
      ],
    });

    expect(body.events[0]).toEqual({
      type: "navigation",
      screen: "/",
      target: null,
      meta: null,
      occurredAt: "2026-09-07T10:00:00.000Z",
    });
  });

  it("does not add fields the contract does not define", () => {
    expect(Object.keys(toRequestBody(batch))).toEqual(["app", "sessionId", "events"]);
    expect(Object.keys(toRequestBody(batch).events[0] ?? {})).toEqual([
      "type",
      "screen",
      "occurredAt",
      "target",
      "meta",
    ]);
  });
});

describe("createApiTransport", () => {
  it("posts the batch with the API key and gets 202 back", async () => {
    let received: unknown;
    let apiKey: string | null = null;
    server.use(
      http.post(`${API_URL}/api/telemetry/events`, async ({ request }) => {
        apiKey = request.headers.get("x-api-key");
        received = await request.json();
        return HttpResponse.json({ accepted: 2 }, { status: 202 });
      }),
    );

    await createApiTransport(client())(batch, { keepalive: false });

    expect(apiKey).toBe(TEST_API_KEY);
    expect(received).toEqual(toRequestBody(batch));
  });

  it("passes keepalive to the request so it survives page hide", async () => {
    const api = client();
    const post = vi.spyOn(api, "POST");

    await createApiTransport(api)(batch, { keepalive: true });

    expect(post).toHaveBeenCalledWith("/api/telemetry/events", {
      body: toRequestBody(batch),
      keepalive: true,
    });
  });

  it("is accepted by the real contract validation of the mock backend", async () => {
    const response = await createApiTransport(client())(batch, { keepalive: false });

    expect(response).toMatchObject({ response: { status: 202 }, data: { accepted: 2 } });
  });
});
