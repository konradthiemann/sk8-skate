import { differenceInCalendarDays, format } from "date-fns";
import { de } from "date-fns/locale";

/** Contest day: 18 September 2027 (local time, whole day). */
export const CONTEST_DATE = new Date(2027, 8, 18);
export const CONTEST_LOCATION = "Braunschweig";

/** Whole calendar days from `now` until the contest; negative once it is over. */
export function daysUntilContest(now: Date = new Date()): number {
  return differenceInCalendarDays(CONTEST_DATE, now);
}

/** "18. September 2027" */
export function formatContestDate(): string {
  return format(CONTEST_DATE, "d. MMMM yyyy", { locale: de });
}

export function formatContestCountdown(days: number): string {
  if (days > 1) {
    return `Noch ${days} Tage bis zum Contest`;
  }
  if (days === 1) {
    return "Noch 1 Tag bis zum Contest";
  }
  if (days === 0) {
    return "Heute ist Contest!";
  }
  const passed = -days;
  return passed === 1 ? "Der Contest war vor 1 Tag" : `Der Contest war vor ${passed} Tagen`;
}

/** Compact form for the header badge. */
export function formatContestCountdownShort(days: number): string {
  if (days > 1) {
    return `Noch ${days} Tage`;
  }
  if (days === 1) {
    return "Noch 1 Tag";
  }
  if (days === 0) {
    return "Heute!";
  }
  return "Vorbei";
}
