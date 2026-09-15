import { describe, expect, it } from "vitest";
import { formatPracticedOn, formatSuccessRate } from "./format";

/*
 * `formatSuccessRate(landedTotal, attemptsTotal)` and
 * `formatPracticedOn(lastPracticedOn)` (design.md §5.2). Both own their full
 * display string, including the empty-case fallback text - mirrors how
 * `src/features/sessions/format.ts` owns "–" for a null rate, so callers
 * never branch on the empty case themselves.
 */

describe("formatSuccessRate", () => {
  it("Kriterium 4: shows the no-attempts text and no percentage when attemptsTotal is 0", () => {
    expect(formatSuccessRate(0, 0)).toBe("Noch keine Versuche erfasst");
  });

  it("Kriterium 5: 21 of 96 attempts is shown as '21 von 96 Versuchen · 22 %'", () => {
    expect(formatSuccessRate(21, 96)).toBe("21 von 96 Versuchen · 22 %");
  });

  it("commercially rounds the percentage (1 of 3 rounds up to 33 %, not down to 32 %)", () => {
    expect(formatSuccessRate(1, 3)).toBe("1 von 3 Versuchen · 33 %");
  });

  it("shows 0 % rather than the empty-attempts text when attempts happened but none landed", () => {
    expect(formatSuccessRate(0, 5)).toBe("0 von 5 Versuchen · 0 %");
  });
});

describe("formatPracticedOn", () => {
  it("formats a practiced date in German, day before month, no weekday", () => {
    expect(formatPracticedOn("2026-09-06")).toBe("Zuletzt geübt: 6. September 2026");
  });

  it("falls back to the never-practiced text when null", () => {
    expect(formatPracticedOn(null)).toBe("Noch nie geübt");
  });
});
