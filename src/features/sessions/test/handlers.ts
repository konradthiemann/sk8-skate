import { HttpResponse, http } from "msw";
import { API_URL, TEST_API_KEY } from "@/test/msw/handlers";

/**
 * Test-only mirrors of the `/api/skate-sessions` contract (T-0102). Not the
 * wire contract itself – that lives in `schema.d.ts` after `pnpm gen:api` –
 * just enough shape for fixtures and MSW handlers in this ticket's tests.
 */
export interface SessionSummaryFixture {
  id: string;
  sessionDate: string;
  durationMinutes: number;
  location: string;
  trickCount: number;
  totalAttempts: number;
  totalLanded: number;
  successRate: number | null;
  fluidLossKg: number | null;
  perceivedExertion: number | null;
  kneePain: number | null;
}

export interface SessionTrickFixture {
  trickSlug: string;
  attempts: number;
  landed: number;
  /**
   * Only needed by T-0105's detail/edit screens (`SessionTrickResponse` is
   * richer than the plain `CreateSessionTrickInput` rows T-0104's fixtures
   * were built for) – optional so `buildSessionResponse`'s existing T-0104
   * callers, which never set `tricks`, keep compiling unchanged.
   */
  id?: string;
  trickName?: string;
  successRate?: number | null;
  notes?: string | null;
}

export interface SessionResponseFixture {
  id: string;
  sessionDate: string;
  startedAt: string | null;
  durationMinutes: number;
  location: string;
  weightBeforeKg: number | null;
  weightAfterKg: number | null;
  fluidLossKg: number | null;
  perceivedExertion: number | null;
  kneePain: number | null;
  notes: string | null;
  createdAt: string;
  tricks: SessionTrickFixture[];
  totalAttempts: number;
  totalLanded: number;
  successRate: number | null;
}

export interface ViolationFixture {
  field: string;
  message: string;
}

export function buildSessionSummary(
  overrides: Partial<SessionSummaryFixture> = {},
): SessionSummaryFixture {
  return {
    id: "session-1",
    sessionDate: "2026-09-06",
    durationMinutes: 60,
    location: "Skatepark Braunschweig",
    trickCount: 2,
    totalAttempts: 20,
    totalLanded: 12,
    successRate: 0.6,
    fluidLossKg: null,
    perceivedExertion: null,
    kneePain: null,
    ...overrides,
  };
}

export function buildSessionResponse(
  overrides: Partial<SessionResponseFixture> = {},
): SessionResponseFixture {
  return {
    id: "session-1",
    sessionDate: "2026-09-06",
    startedAt: null,
    durationMinutes: 60,
    location: "Skatepark Braunschweig",
    weightBeforeKg: null,
    weightAfterKg: null,
    fluidLossKg: null,
    perceivedExertion: null,
    kneePain: null,
    notes: null,
    createdAt: "2026-09-06T18:00:00+00:00",
    tricks: [],
    totalAttempts: 0,
    totalLanded: 0,
    successRate: null,
    ...overrides,
  };
}

export function sessionsListHandler(items: SessionSummaryFixture[], total = items.length) {
  return http.get(`${API_URL}/api/skate-sessions`, ({ request }) => {
    if (request.headers.get("x-api-key") !== TEST_API_KEY) {
      return HttpResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return HttpResponse.json({ items, total }, { status: 200 });
  });
}

export function sessionsListErrorHandler(status = 500) {
  return http.get(`${API_URL}/api/skate-sessions`, () =>
    HttpResponse.json({ error: "internal_error" }, { status }),
  );
}

export function createSessionHandler(response: SessionResponseFixture = buildSessionResponse()) {
  return http.post(`${API_URL}/api/skate-sessions`, async ({ request }) => {
    if (request.headers.get("x-api-key") !== TEST_API_KEY) {
      return HttpResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    await request.json();
    return HttpResponse.json(response, { status: 201 });
  });
}

export function createSessionValidationErrorHandler(violations: ViolationFixture[]) {
  return http.post(`${API_URL}/api/skate-sessions`, () =>
    HttpResponse.json({ error: "validation_failed", violations }, { status: 422 }),
  );
}

export function createSessionServerErrorHandler(status = 500) {
  return http.post(`${API_URL}/api/skate-sessions`, () =>
    HttpResponse.json({ error: "internal_error" }, { status }),
  );
}

/*
 * T-0105 additions: GET/PUT/DELETE on a single `/api/skate-sessions/:id`.
 * `src/test/msw/handlers.ts` itself stays untouched (Ticket-Vorgabe) – these
 * live next to the T-0104 handlers above because they mock the same domain
 * endpoint family.
 */

export function sessionDetailHandler(response: SessionResponseFixture) {
  return http.get(`${API_URL}/api/skate-sessions/${response.id}`, ({ request }) => {
    if (request.headers.get("x-api-key") !== TEST_API_KEY) {
      return HttpResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return HttpResponse.json(response, { status: 200 });
  });
}

export function sessionDetailNotFoundHandler(id: string) {
  return http.get(`${API_URL}/api/skate-sessions/${id}`, () =>
    HttpResponse.json({ error: "not_found" }, { status: 404 }),
  );
}

export function sessionDetailErrorHandler(id: string, status = 500) {
  return http.get(`${API_URL}/api/skate-sessions/${id}`, () =>
    HttpResponse.json({ error: "internal_error" }, { status }),
  );
}

/** One-shot success: every `PUT` for this `id` returns the same fixed response, body unread beyond parsing. */
export function updateSessionHandler(id: string, response: SessionResponseFixture) {
  return http.put(`${API_URL}/api/skate-sessions/${id}`, async ({ request }) => {
    if (request.headers.get("x-api-key") !== TEST_API_KEY) {
      return HttpResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    await request.json();
    return HttpResponse.json(response, { status: 200 });
  });
}

export function updateSessionValidationErrorHandler(id: string, violations: ViolationFixture[]) {
  return http.put(`${API_URL}/api/skate-sessions/${id}`, () =>
    HttpResponse.json({ error: "validation_failed", violations }, { status: 422 }),
  );
}

export function updateSessionServerErrorHandler(id: string, status = 500) {
  return http.put(`${API_URL}/api/skate-sessions/${id}`, () =>
    HttpResponse.json({ error: "internal_error" }, { status }),
  );
}

export function deleteSessionHandler(id: string) {
  return http.delete(`${API_URL}/api/skate-sessions/${id}`, ({ request }) => {
    if (request.headers.get("x-api-key") !== TEST_API_KEY) {
      return HttpResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return new HttpResponse(null, { status: 204 });
  });
}

export function deleteSessionServerErrorHandler(id: string, status = 500) {
  return http.delete(`${API_URL}/api/skate-sessions/${id}`, () =>
    HttpResponse.json({ error: "internal_error" }, { status }),
  );
}
