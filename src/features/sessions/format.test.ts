import { describe, expect, it } from "vitest";
import {
  formatDuration,
  formatFluidLoss,
  formatKg,
  formatMonthGroup,
  formatSessionDate,
  formatSuccessRate,
} from "./format";

describe("formatSessionDate", () => {
  /*
   * design.md/ticket give "Sa., 6. September 2026" as the example output for
   * "2026-09-06", but 6 September 2026 is a Sunday on the real calendar
   * (verified via date-fns/de and the system `date` command) – "Sa." there is
   * a typo in the ticket text, not a requirement. Asserting the calendar-
   * correct weekday here so this test does not fail a correct implementation.
   */
  it("formats an ISO date as a short German weekday plus the full date", () => {
    expect(formatSessionDate("2026-09-06")).toBe("So., 6. September 2026");
  });

  it("formats a different weekday correctly", () => {
    expect(formatSessionDate("2026-09-08")).toBe("Di., 8. September 2026");
  });
});

describe("formatMonthGroup", () => {
  it("formats an ISO date as German month and year", () => {
    expect(formatMonthGroup("2026-09-06")).toBe("September 2026");
  });

  it("groups every day of the month under the same label", () => {
    expect(formatMonthGroup("2026-09-30")).toBe(formatMonthGroup("2026-09-01"));
  });
});

describe("formatDuration", () => {
  it("formats minutes under an hour", () => {
    expect(formatDuration(45)).toBe("45 min");
  });

  it("formats exactly one hour without minutes", () => {
    expect(formatDuration(60)).toBe("1 h");
  });

  it("formats an hour and minutes together", () => {
    expect(formatDuration(95)).toBe("1 h 35 min");
  });

  it("formats several full hours", () => {
    expect(formatDuration(120)).toBe("2 h");
  });
});

describe("formatSuccessRate", () => {
  it("formats a rate as a rounded percentage", () => {
    expect(formatSuccessRate(0.556)).toBe("56 %");
  });

  it("shows a dash with no percentage sign when there is no rate", () => {
    expect(formatSuccessRate(null)).toBe("–");
  });

  it("formats a perfect rate", () => {
    expect(formatSuccessRate(1)).toBe("100 %");
  });

  it("formats a zero rate distinctly from a missing one", () => {
    expect(formatSuccessRate(0)).toBe("0 %");
  });
});

describe("formatKg", () => {
  it("formats a weight with one decimal using a German comma", () => {
    expect(formatKg(78.4)).toBe("78,4 kg");
  });

  it("keeps two decimals when the value has them", () => {
    expect(formatKg(78.45)).toBe("78,45 kg");
  });
});

describe("formatFluidLoss", () => {
  it("formats a positive loss like a weight", () => {
    expect(formatFluidLoss(1.3)).toBe("1,3 kg");
  });

  it("formats exactly zero loss as a weight, not as 'no loss'", () => {
    expect(formatFluidLoss(0)).toBe("0 kg");
  });

  it("reports a weight gain as no loss instead of a negative weight", () => {
    expect(formatFluidLoss(-0.2)).toBe("kein Verlust");
  });

  it("shows a dash when no loss could be computed", () => {
    expect(formatFluidLoss(null)).toBe("–");
  });
});
