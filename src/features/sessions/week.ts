import { addDays, endOfWeek, format, parseISO, startOfWeek } from "date-fns";
import type { SkateSessionSummary } from "./api";

export interface WeekDaySummary {
  /** "yyyy-MM-dd", Monday first. */
  date: string;
  /** Sum of that day's session durations, 0 without a session. */
  durationMinutes: number;
  hasSession: boolean;
}

export interface WeekSummary {
  sessionCount: number;
  totalDurationMinutes: number;
  /** null when no session of the week has any trick attempts. */
  successRate: number | null;
  /** Exactly seven entries, Monday..Sunday. */
  days: WeekDaySummary[];
}

/**
 * Pure function, no React, no network. Week boundaries are Monday..Sunday of
 * `now`'s calendar week (design.md Abschnitt 5).
 */
export function summarizeWeek(sessions: SkateSessionSummary[], now: Date): WeekSummary {
  const start = startOfWeek(now, { weekStartsOn: 1 });
  const end = endOfWeek(now, { weekStartsOn: 1 });
  const inWeek = sessions.filter((session) => {
    const date = parseISO(session.sessionDate);
    return date >= start && date <= end;
  });

  const days: WeekDaySummary[] = Array.from({ length: 7 }, (_, index) => {
    const date = format(addDays(start, index), "yyyy-MM-dd");
    const daySessions = inWeek.filter((session) => session.sessionDate === date);
    const durationMinutes = daySessions.reduce((sum, session) => sum + session.durationMinutes, 0);
    return { date, durationMinutes, hasSession: daySessions.length > 0 };
  });

  const totalAttempts = inWeek.reduce((sum, session) => sum + session.totalAttempts, 0);
  const totalLanded = inWeek.reduce((sum, session) => sum + session.totalLanded, 0);

  return {
    sessionCount: inWeek.length,
    totalDurationMinutes: inWeek.reduce((sum, session) => sum + session.durationMinutes, 0),
    // Weighted by raw attempts/landed, not by averaging each session's own
    // rate – otherwise unequal-length sessions would be misweighted.
    successRate:
      totalAttempts === 0 ? null : Math.round((totalLanded / totalAttempts) * 1000) / 1000,
    days,
  };
}
