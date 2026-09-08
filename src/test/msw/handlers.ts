import { HttpResponse, http } from "msw";
import type { components } from "@/lib/api/schema";
import type { TelemetryApp, TelemetryEventType } from "@/lib/telemetry/types";

type TelemetryBatchRequest = components["schemas"]["TelemetryBatchRequest"];
type ValidationErrorResponse = components["schemas"]["ValidationErrorResponse"];

/** Must match VITE_API_URL / VITE_API_KEY from vitest.config.ts. */
export const API_URL = "http://localhost:8000";
export const TEST_API_KEY = "test-key";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TEXT_LENGTH = 200;
const MIN_EVENTS = 1;
const MAX_EVENTS = 100;

/*
 * Keyed by the generated unions instead of a hand-written list: if the contract
 * gains or loses a value, these object literals stop compiling.
 */
const APPS: Record<TelemetryApp, true> = { skate: true, nutrition: true, habits: true };
const EVENT_TYPES: Record<TelemetryEventType, true> = {
  screen_view: true,
  time_on_screen: true,
  interaction: true,
  navigation: true,
};

function validateBatch(body: unknown): ValidationErrorResponse["violations"] {
  const violations: ValidationErrorResponse["violations"] = [];
  const batch = (body ?? {}) as Partial<TelemetryBatchRequest>;

  if (!Object.hasOwn(APPS, String(batch.app))) {
    violations.push({ field: "app", message: "Unbekannte App." });
  }
  if (typeof batch.sessionId !== "string" || !UUID_PATTERN.test(batch.sessionId)) {
    violations.push({ field: "sessionId", message: "Muss eine UUID sein." });
  }
  if (!Array.isArray(batch.events)) {
    violations.push({ field: "events", message: "Muss eine Liste sein." });
    return violations;
  }
  if (batch.events.length < MIN_EVENTS || batch.events.length > MAX_EVENTS) {
    violations.push({
      field: "events",
      message: `Muss zwischen ${MIN_EVENTS} und ${MAX_EVENTS} Ereignisse enthalten.`,
    });
  }
  batch.events.forEach((event, index) => {
    if (!Object.hasOwn(EVENT_TYPES, String(event?.type))) {
      violations.push({ field: `events[${index}].type`, message: "Unbekannter Event-Typ." });
    }
    if (typeof event?.screen !== "string" || event.screen.length === 0) {
      violations.push({ field: `events[${index}].screen`, message: "Darf nicht leer sein." });
    } else if (event.screen.length > MAX_TEXT_LENGTH) {
      violations.push({
        field: `events[${index}].screen`,
        message: `Darf maximal ${MAX_TEXT_LENGTH} Zeichen lang sein.`,
      });
    }
    if (typeof event?.target === "string" && event.target.length > MAX_TEXT_LENGTH) {
      violations.push({
        field: `events[${index}].target`,
        message: `Darf maximal ${MAX_TEXT_LENGTH} Zeichen lang sein.`,
      });
    }
    if (typeof event?.occurredAt !== "string" || Number.isNaN(Date.parse(event.occurredAt))) {
      violations.push({ field: `events[${index}].occurredAt`, message: "Muss ISO 8601 sein." });
    }
  });
  return violations;
}

export const handlers = [
  http.get(`${API_URL}/api/health`, () =>
    HttpResponse.json({ status: "ok", time: new Date().toISOString() }, { status: 200 }),
  ),

  http.post(`${API_URL}/api/telemetry/events`, async ({ request }) => {
    if (request.headers.get("x-api-key") !== TEST_API_KEY) {
      return HttpResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const violations = validateBatch(body);
    if (violations.length > 0) {
      return HttpResponse.json({ error: "validation_failed", violations }, { status: 422 });
    }
    const batch = body as TelemetryBatchRequest;
    return HttpResponse.json({ accepted: batch.events.length }, { status: 202 });
  }),
];
