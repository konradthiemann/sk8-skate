import { addDays, format } from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sessionFormSchema } from "./schema";

/*
 * Raw shape a `SessionForm` (react-hook-form) instance holds before submit.
 * Not yet defined anywhere in production code – this is the contract this
 * test pins down for `schema.ts`/`SessionForm.tsx` to implement against.
 * `sessionFormSchema.parse(...)` transforms this into the exact
 * `SkateSessionRequest` body T-0102 expects (camelCase, `null` instead of
 * empty strings for unset optional fields).
 */
function validInput() {
  return {
    sessionDate: "2026-09-06",
    durationMinutes: 60,
    location: "Skatepark Braunschweig",
    tricks: [{ trickSlug: "ollie", attempts: 10, landed: 8 }],
    startedAt: "",
    weightBeforeKg: "",
    weightAfterKg: "",
    perceivedExertion: null as number | null,
    kneePain: null as number | null,
    notes: "",
  };
}

describe("sessionFormSchema – happy path", () => {
  it("transforms form values into the request body shape, unchanged where set", () => {
    expect(sessionFormSchema.parse(validInput())).toEqual({
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
    });
  });
});

describe("sessionFormSchema – Kriterium 26: leere optionale Felder werden zu null", () => {
  it("converts every unset optional field to null, not an empty string", () => {
    const result = sessionFormSchema.parse({ ...validInput(), tricks: [] });

    expect(result.startedAt).toBeNull();
    expect(result.weightBeforeKg).toBeNull();
    expect(result.weightAfterKg).toBeNull();
    expect(result.perceivedExertion).toBeNull();
    expect(result.kneePain).toBeNull();
    expect(result.notes).toBeNull();
    expect(result.tricks).toEqual([]);
  });

  it("combines a start time with the session date into one ISO datetime (Kriterium 25)", () => {
    const result = sessionFormSchema.parse({
      ...validInput(),
      sessionDate: "2026-09-06",
      startedAt: "16:30",
    });

    expect(result.startedAt).toMatch(/^2026-09-06T16:30/);
  });
});

describe("sessionFormSchema – Kriterium 16: Treffer über Versuche per Direkteingabe", () => {
  it("rejects a trick row where landed exceeds attempts", () => {
    const result = sessionFormSchema.safeParse({
      ...validInput(),
      tricks: [{ trickSlug: "ollie", attempts: 5, landed: 6 }],
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    const issue = result.error.issues.find((i) => i.path.join(".") === "tricks.0.landed");
    expect(issue?.message).toBe("Es können nicht mehr Treffer als Versuche sein.");
  });

  it("allows landed to equal attempts", () => {
    const result = sessionFormSchema.safeParse({
      ...validInput(),
      tricks: [{ trickSlug: "ollie", attempts: 5, landed: 5 }],
    });

    expect(result.success).toBe(true);
  });
});

describe("sessionFormSchema – Kriterium 17: Dauer 1 bis 600", () => {
  it("rejects a duration of 0", () => {
    const result = sessionFormSchema.safeParse({ ...validInput(), durationMinutes: 0 });

    expect(result.success).toBe(false);
    if (result.success) return;
    const issue = result.error.issues.find((i) => i.path.join(".") === "durationMinutes");
    expect(issue?.message).toBe("Die Dauer muss zwischen 1 und 600 Minuten liegen.");
  });

  it("rejects a duration above 600", () => {
    const result = sessionFormSchema.safeParse({ ...validInput(), durationMinutes: 601 });

    expect(result.success).toBe(false);
    if (result.success) return;
    const issue = result.error.issues.find((i) => i.path.join(".") === "durationMinutes");
    expect(issue?.message).toBe("Die Dauer muss zwischen 1 und 600 Minuten liegen.");
  });

  it("accepts the boundary values 1 and 600", () => {
    expect(sessionFormSchema.safeParse({ ...validInput(), durationMinutes: 1 }).success).toBe(true);
    expect(sessionFormSchema.safeParse({ ...validInput(), durationMinutes: 600 }).success).toBe(
      true,
    );
  });
});

describe("sessionFormSchema – Kriterium 18: Datum nicht in der Zukunft", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date(2026, 8, 8, 12, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects a date of tomorrow", () => {
    const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
    const result = sessionFormSchema.safeParse({ ...validInput(), sessionDate: tomorrow });

    expect(result.success).toBe(false);
    if (result.success) return;
    const issue = result.error.issues.find((i) => i.path.join(".") === "sessionDate");
    expect(issue?.message).toBe("Das Datum darf nicht in der Zukunft liegen.");
  });

  it("accepts today's date", () => {
    const today = format(new Date(), "yyyy-MM-dd");

    expect(sessionFormSchema.safeParse({ ...validInput(), sessionDate: today }).success).toBe(true);
  });
});

describe("sessionFormSchema – Kriterium 19: Ort ist Pflicht", () => {
  it("rejects an empty location", () => {
    const result = sessionFormSchema.safeParse({ ...validInput(), location: "" });

    expect(result.success).toBe(false);
    if (result.success) return;
    const issue = result.error.issues.find((i) => i.path.join(".") === "location");
    expect(issue?.message).toBe("Bitte gib den Ort an.");
  });

  it("rejects a location that is only whitespace", () => {
    const result = sessionFormSchema.safeParse({ ...validInput(), location: "   " });

    expect(result.success).toBe(false);
  });
});

describe("sessionFormSchema – Kriterium 20: Gewicht nachher ohne vorher", () => {
  it("rejects weightAfterKg set without weightBeforeKg", () => {
    const result = sessionFormSchema.safeParse({
      ...validInput(),
      weightBeforeKg: "",
      weightAfterKg: "77.1",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    const issue = result.error.issues.find((i) => i.path.join(".") === "weightAfterKg");
    expect(issue?.message).toBe("Ohne Gewicht vorher ergibt das Gewicht nachher keinen Wert.");
  });

  it("accepts both weights set together", () => {
    const result = sessionFormSchema.safeParse({
      ...validInput(),
      weightBeforeKg: "78.4",
      weightAfterKg: "77.1",
    });

    expect(result.success).toBe(true);
  });
});

describe("sessionFormSchema – Trick-Obergrenze", () => {
  function tricksOfLength(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      trickSlug: `trick-${i}`,
      attempts: 10,
      landed: 5,
    }));
  }

  it("accepts exactly 50 tricks", () => {
    const result = sessionFormSchema.safeParse({ ...validInput(), tricks: tricksOfLength(50) });

    expect(result.success).toBe(true);
  });

  it("rejects 51 tricks with the documented message", () => {
    const result = sessionFormSchema.safeParse({ ...validInput(), tricks: tricksOfLength(51) });

    expect(result.success).toBe(false);
    if (result.success) return;
    const issue = result.error.issues.find((i) => i.path.join(".") === "tricks");
    expect(issue?.message).toBe("Höchstens 50 Tricks pro Session.");
  });
});
