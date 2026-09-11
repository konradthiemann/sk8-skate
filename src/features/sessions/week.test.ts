import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildSessionSummary } from "./test/handlers";
import { summarizeWeek } from "./week";

/*
 * `summarizeWeek(sessions, now)` (design.md Abschnitt 5): a pure function,
 * no React, no network. Week boundaries are Monday..Sunday of `now`'s
 * calendar week. Kriterien 22-25.
 */

describe("summarizeWeek", () => {
  beforeEach(() => {
    // Tuesday, 2026-09-08 (design.md/Ticket example date for Kriterien 22/23).
    vi.setSystemTime(new Date(2026, 8, 8, 12, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("Kriterium 22: counts only sessions inside the Monday-Sunday week, excluding the previous week's Sunday", () => {
    const monday = buildSessionSummary({
      id: "mon",
      sessionDate: "2026-09-07",
      durationMinutes: 95,
    });
    const tuesday = buildSessionSummary({
      id: "tue",
      sessionDate: "2026-09-08",
      durationMinutes: 60,
    });
    const prevSunday = buildSessionSummary({
      id: "prev-sun",
      sessionDate: "2026-09-06",
      durationMinutes: 120,
    });

    const summary = summarizeWeek([monday, tuesday, prevSunday], new Date(2026, 8, 8, 12, 0));

    expect(summary.sessionCount).toBe(2);
    expect(summary.totalDurationMinutes).toBe(155); // 95 + 60, not +120
  });

  it("Kriterium 23: builds exactly seven Monday..Sunday day entries with per-day duration and hasSession", () => {
    const monday = buildSessionSummary({
      id: "mon",
      sessionDate: "2026-09-07",
      durationMinutes: 95,
    });
    const tuesday = buildSessionSummary({
      id: "tue",
      sessionDate: "2026-09-08",
      durationMinutes: 60,
    });

    const summary = summarizeWeek([monday, tuesday], new Date(2026, 8, 8, 12, 0));

    expect(summary.days).toHaveLength(7);
    expect(summary.days.map((day) => day.date)).toEqual([
      "2026-09-07",
      "2026-09-08",
      "2026-09-09",
      "2026-09-10",
      "2026-09-11",
      "2026-09-12",
      "2026-09-13",
    ]);
    expect(summary.days[0]).toEqual({ date: "2026-09-07", durationMinutes: 95, hasSession: true });
    expect(summary.days[1]).toEqual({ date: "2026-09-08", durationMinutes: 60, hasSession: true });
    for (const day of summary.days.slice(2)) {
      expect(day.hasSession).toBe(false);
      expect(day.durationMinutes).toBe(0);
    }
  });

  it("Kriterium 24: successRate is null, not 0, when no session of the week has any trick attempts", () => {
    const noTricks = buildSessionSummary({
      id: "no-tricks",
      sessionDate: "2026-09-07",
      trickCount: 0,
      totalAttempts: 0,
      totalLanded: 0,
      successRate: null,
    });

    const summary = summarizeWeek([noTricks], new Date(2026, 8, 8, 12, 0));

    expect(summary.successRate).toBeNull();
  });

  it("Kriterium 25: an empty week reports zero sessions, zero duration, null rate, and seven empty days", () => {
    const summary = summarizeWeek([], new Date(2026, 8, 8, 12, 0));

    expect(summary.sessionCount).toBe(0);
    expect(summary.totalDurationMinutes).toBe(0);
    expect(summary.successRate).toBeNull();
    expect(summary.days).toHaveLength(7);
    expect(summary.days.every((day) => !day.hasSession && day.durationMinutes === 0)).toBe(true);
  });

  it("weights the week's success rate by raw attempts/landed, not by averaging each session's own rate", () => {
    // Session A: 10 attempts, 9 landed (90%). Session B: 90 attempts, 9 landed (10%).
    // Naive averaging of the two rates gives 50%; weighted by raw counts gives (9+9)/(10+90) = 18%.
    const sessionA = buildSessionSummary({
      id: "a",
      sessionDate: "2026-09-07",
      totalAttempts: 10,
      totalLanded: 9,
      successRate: 0.9,
    });
    const sessionB = buildSessionSummary({
      id: "b",
      sessionDate: "2026-09-08",
      totalAttempts: 90,
      totalLanded: 9,
      successRate: 0.1,
    });

    const summary = summarizeWeek([sessionA, sessionB], new Date(2026, 8, 8, 12, 0));

    expect(summary.successRate).toBeCloseTo(0.18, 5);
  });
});
