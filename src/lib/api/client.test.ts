import { describe, expect, it } from "vitest";
import { appConfig } from "@/app.config";
import { API_URL, TEST_API_KEY } from "@/test/msw/handlers";
import { api, createApiClient } from "./client";
import type { components } from "./schema";

/** Request body exactly as the contract defines it (target and meta explicit). */
const batch: components["schemas"]["TelemetryBatchRequest"] = {
  app: appConfig.id,
  sessionId: "6f1c2c0a-0f4e-4d2a-9b1e-2a6d3f4c5b6a",
  events: [
    {
      type: "screen_view",
      screen: "/",
      target: null,
      meta: { from: null },
      occurredAt: "2026-09-07T10:00:00.000Z",
    },
    {
      type: "interaction",
      screen: "/",
      target: "start.tricks",
      meta: null,
      occurredAt: "2026-09-07T10:00:01.000Z",
    },
  ],
};

describe("api client", () => {
  it("reads the health endpoint without authentication", async () => {
    const client = createApiClient({ baseUrl: API_URL, apiKey: "" });
    const { data, response } = await client.GET("/api/health");

    expect(response.status).toBe(200);
    expect(data?.status).toBe("ok");
    expect(Number.isNaN(Date.parse(data?.time ?? ""))).toBe(false);
  });

  it("sends the X-Api-Key header and receives 202 with the accepted count", async () => {
    const client = createApiClient({ baseUrl: API_URL, apiKey: TEST_API_KEY });
    const { data, response } = await client.POST("/api/telemetry/events", { body: batch });

    expect(response.status).toBe(202);
    expect(data).toEqual({ accepted: 2 });
  });

  it("gets a typed 401 error without a key", async () => {
    const client = createApiClient({ baseUrl: API_URL, apiKey: "" });
    const { data, error, response } = await client.POST("/api/telemetry/events", { body: batch });

    expect(response.status).toBe(401);
    expect(data).toBeUndefined();
    expect(error).toEqual({ error: "unauthorized" });
  });

  it("gets a typed 422 error with violations for an invalid payload", async () => {
    const client = createApiClient({ baseUrl: API_URL, apiKey: TEST_API_KEY });
    const { error, response } = await client.POST("/api/telemetry/events", {
      body: { ...batch, sessionId: "not-a-uuid" },
    });

    expect(response.status).toBe(422);
    expect(error?.error).toBe("validation_failed");
    expect(error?.error === "validation_failed" && error.violations).toEqual([
      { field: "sessionId", message: expect.any(String) },
    ]);
  });

  it("tolerates a trailing slash in the base URL", async () => {
    const client = createApiClient({ baseUrl: `${API_URL}/`, apiKey: TEST_API_KEY });
    const { response } = await client.GET("/api/health");

    expect(response.status).toBe(200);
  });

  it("configures the default instance from VITE_API_URL and VITE_API_KEY", async () => {
    const { response } = await api.POST("/api/telemetry/events", { body: batch });

    expect(response.status).toBe(202);
  });
});
