import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

export type SkateSessionSummary = components["schemas"]["SkateSessionSummary"];
export type SkateSessionResponse = components["schemas"]["SkateSessionResponse"];
export type Violation = components["schemas"]["Violation"];

export interface SessionListFilter {
  from?: string;
  to?: string;
  limit: number;
}

export interface SessionListResult {
  items: SkateSessionSummary[];
  total: number;
}

/** A single practiced-trick row as actually sent to the backend. */
export interface CreateSessionTrickInput {
  trickSlug: string;
  attempts: number;
  landed: number;
}

/**
 * The request body `createSession` accepts. Deliberately not
 * `components["schemas"]["SkateSessionRequest"]` verbatim: the OpenAPI spec's
 * `required` array for `SessionTrickInput` lists only `trickSlug`/`attempts`/
 * `landed` (verified via `GET /api/doc.json`), but openapi-typescript treats
 * every property carrying a JSON Schema `default` (here `notes: null`) as
 * always-present, so the generated type demands `notes` on every trick row
 * even though the wire contract does not. `SessionTrickRow` never collects a
 * note, so this app never has one to send.
 */
export interface CreateSessionRequest {
  sessionDate: string;
  startedAt: string | null;
  durationMinutes: number;
  location: string;
  weightBeforeKg: number | null;
  weightAfterKg: number | null;
  perceivedExertion: number | null;
  kneePain: number | null;
  notes: string | null;
  tricks: CreateSessionTrickInput[];
}

export const sessionKeys = {
  all: ["sessions"] as const,
  list: (filter: SessionListFilter) => ["sessions", "list", filter] as const,
  detail: (id: string) => ["sessions", "detail", id] as const,
};

/** Thrown by `fetchSessions`/`createSession` on any non-2xx response. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly violations?: Violation[];

  constructor(status: number, body: unknown) {
    super(extractErrorCode(body));
    this.name = "ApiRequestError";
    this.status = status;
    const violations = extractViolations(body);
    if (violations !== undefined) {
      this.violations = violations;
    }
  }
}

function extractErrorCode(body: unknown): string {
  if (typeof body === "object" && body !== null && "error" in body) {
    const value = (body as { error?: unknown }).error;
    if (typeof value === "string") {
      return value;
    }
  }
  return "request_failed";
}

function extractViolations(body: unknown): Violation[] | undefined {
  if (typeof body === "object" && body !== null && "violations" in body) {
    const value = (body as { violations?: unknown }).violations;
    if (Array.isArray(value)) {
      return value as Violation[];
    }
  }
  return undefined;
}

export async function fetchSessions(filter: SessionListFilter): Promise<SessionListResult> {
  const { data, error, response } = await api.GET("/api/skate-sessions", {
    params: { query: { from: filter.from, to: filter.to, limit: filter.limit } },
  });
  if (error) {
    throw new ApiRequestError(response.status, error);
  }
  return data;
}

export async function createSession(body: CreateSessionRequest): Promise<SkateSessionResponse> {
  const { data, error, response } = await api.POST("/api/skate-sessions", {
    // See `CreateSessionRequest` above for why the cast is needed: this
    // object is spec-correct but narrower than the generated type.
    body: body as unknown as components["schemas"]["SkateSessionRequest"],
  });
  if (error) {
    throw new ApiRequestError(response.status, error);
  }
  return data;
}

export async function fetchSession(id: string): Promise<SkateSessionResponse> {
  const { data, error, response } = await api.GET("/api/skate-sessions/{id}", {
    params: { path: { id } },
  });
  if (error) {
    throw new ApiRequestError(response.status, error);
  }
  return data;
}

/** Same wire shape as `createSession` (see `CreateSessionRequest` above); `PUT` accepts the same request body as `POST`. */
export async function updateSession(
  id: string,
  body: CreateSessionRequest,
): Promise<SkateSessionResponse> {
  const { data, error, response } = await api.PUT("/api/skate-sessions/{id}", {
    params: { path: { id } },
    body: body as unknown as components["schemas"]["SkateSessionRequest"],
  });
  if (error) {
    throw new ApiRequestError(response.status, error);
  }
  return data;
}

export async function deleteSession(id: string): Promise<void> {
  const { error, response } = await api.DELETE("/api/skate-sessions/{id}", {
    params: { path: { id } },
  });
  if (error) {
    throw new ApiRequestError(response.status, error);
  }
}
