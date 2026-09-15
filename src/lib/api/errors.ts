import type { components } from "./schema";

type Violation = components["schemas"]["Violation"];

/**
 * Thrown by any `fetch*`/`create*`/`update*` function on a non-2xx response.
 * App-wide (design.md §5.2 of `trick-detail-focus-card`): the error format
 * `{"error": "<code>", "violations"?: [...]}` is a global API contract, not a
 * sessions-specific detail - `sessions/api.ts` and `tricks/api.ts` both throw
 * this same class.
 */
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

export function extractErrorCode(body: unknown): string {
  if (typeof body === "object" && body !== null && "error" in body) {
    const value = (body as { error?: unknown }).error;
    if (typeof value === "string") {
      return value;
    }
  }
  return "request_failed";
}

export function extractViolations(body: unknown): Violation[] | undefined {
  if (typeof body === "object" && body !== null && "violations" in body) {
    const value = (body as { violations?: unknown }).violations;
    if (Array.isArray(value)) {
      return value as Violation[];
    }
  }
  return undefined;
}
