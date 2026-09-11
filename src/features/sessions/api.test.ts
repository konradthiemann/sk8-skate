import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { API_URL, TEST_API_KEY } from "@/test/msw/handlers";
import { server } from "@/test/msw/server";
import { createSession, fetchSessions, sessionKeys } from "./api";
import {
  buildSessionResponse,
  buildSessionSummary,
  createSessionHandler,
  createSessionServerErrorHandler,
  createSessionValidationErrorHandler,
  sessionsListHandler,
} from "./test/handlers";

const validRequest = {
  sessionDate: "2026-09-06",
  startedAt: null,
  durationMinutes: 60,
  location: "Skatepark Braunschweig",
  weightBeforeKg: null,
  weightAfterKg: null,
  perceivedExertion: null,
  kneePain: null,
  notes: null,
  tricks: [{ trickSlug: "ollie", attempts: 10, landed: 8 }],
};

describe("sessionKeys", () => {
  it("has a stable root key for invalidation", () => {
    expect(sessionKeys.all).toEqual(["sessions"]);
  });

  it("builds a list key that includes the filter and is stable across calls", () => {
    const filter = { limit: 50 };

    expect(sessionKeys.list(filter)).toEqual(["sessions", "list", { limit: 50 }]);
    expect(sessionKeys.list({ limit: 50 })).toEqual(sessionKeys.list({ limit: 50 }));
  });

  it("keeps the list key prefixed with the root key", () => {
    const key = sessionKeys.list({ limit: 50 });

    expect(key.slice(0, sessionKeys.all.length)).toEqual(sessionKeys.all);
  });
});

describe("fetchSessions", () => {
  it("sends from, to and limit as query parameters", async () => {
    let receivedUrl: URL | undefined;
    server.use(
      http.get(`${API_URL}/api/skate-sessions`, ({ request }) => {
        receivedUrl = new URL(request.url);
        return HttpResponse.json({ items: [], total: 0 }, { status: 200 });
      }),
    );

    await fetchSessions({ from: "2026-08-01", to: "2026-09-30", limit: 25 });

    expect(receivedUrl?.searchParams.get("from")).toBe("2026-08-01");
    expect(receivedUrl?.searchParams.get("to")).toBe("2026-09-30");
    expect(receivedUrl?.searchParams.get("limit")).toBe("25");
  });

  it("omits from/to when they are not given", async () => {
    let receivedUrl: URL | undefined;
    server.use(
      http.get(`${API_URL}/api/skate-sessions`, ({ request }) => {
        receivedUrl = new URL(request.url);
        return HttpResponse.json({ items: [], total: 0 }, { status: 200 });
      }),
    );

    await fetchSessions({ limit: 50 });

    expect(receivedUrl?.searchParams.has("from")).toBe(false);
    expect(receivedUrl?.searchParams.has("to")).toBe(false);
  });

  it("resolves with the items/total envelope", async () => {
    const items = [buildSessionSummary({ id: "s1" }), buildSessionSummary({ id: "s2" })];
    server.use(sessionsListHandler(items, 2));

    const result = await fetchSessions({ limit: 50 });

    expect(result).toEqual({ items, total: 2 });
  });

  it("rejects with the status when the backend answers 401", async () => {
    server.use(
      http.get(`${API_URL}/api/skate-sessions`, () =>
        HttpResponse.json({ error: "unauthorized" }, { status: 401 }),
      ),
    );

    await expect(fetchSessions({ limit: 50 })).rejects.toMatchObject({ status: 401 });
  });

  it("rejects with the status when the backend answers 500", async () => {
    server.use(
      http.get(`${API_URL}/api/skate-sessions`, () =>
        HttpResponse.json({ error: "internal_error" }, { status: 500 }),
      ),
    );

    await expect(fetchSessions({ limit: 50 })).rejects.toMatchObject({ status: 500 });
  });
});

describe("createSession", () => {
  it("posts the request body to /api/skate-sessions and checks the X-Api-Key header", async () => {
    let receivedBody: unknown;
    let receivedKey: string | null = null;
    server.use(
      http.post(`${API_URL}/api/skate-sessions`, async ({ request }) => {
        receivedKey = request.headers.get("x-api-key");
        receivedBody = await request.json();
        return HttpResponse.json(buildSessionResponse(), { status: 201 });
      }),
    );

    await createSession(validRequest);

    expect(receivedKey).toBe(TEST_API_KEY);
    expect(receivedBody).toEqual(validRequest);
  });

  it("resolves with the created session on 201", async () => {
    const response = buildSessionResponse({ id: "new-session" });
    server.use(createSessionHandler(response));

    const result = await createSession(validRequest);

    expect(result).toEqual(response);
  });

  it("rejects with status and violations on 422", async () => {
    const violations = [
      { field: "tricks[0].landed", message: "Es können nicht mehr Treffer als Versuche sein." },
    ];
    server.use(createSessionValidationErrorHandler(violations));

    await expect(createSession(validRequest)).rejects.toMatchObject({ status: 422, violations });
  });

  it("rejects with the status when the backend answers 500", async () => {
    server.use(createSessionServerErrorHandler(500));

    await expect(createSession(validRequest)).rejects.toMatchObject({ status: 500 });
  });

  it("rejects with the status when the backend answers 401", async () => {
    server.use(
      http.post(`${API_URL}/api/skate-sessions`, () =>
        HttpResponse.json({ error: "unauthorized" }, { status: 401 }),
      ),
    );

    await expect(createSession(validRequest)).rejects.toMatchObject({ status: 401 });
  });
});
