import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";

const kgFormatter = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 });
const percentFormatter = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

/** "2026-09-08" -> "Di., 8. September 2026". */
export function formatSessionDate(sessionDate: string): string {
  return format(parseISO(sessionDate), "EEE, d. MMMM yyyy", { locale: de });
}

/** "2026-09-08" -> "September 2026" – every day of a month shares this label. */
export function formatMonthGroup(sessionDate: string): string {
  return format(parseISO(sessionDate), "MMMM yyyy", { locale: de });
}

/** 45 -> "45 min", 60 -> "1 h", 95 -> "1 h 35 min". */
export function formatDuration(durationMinutes: number): string {
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }
  if (minutes === 0) {
    return `${hours} h`;
  }
  return `${hours} h ${minutes} min`;
}

/** 0.556 -> "56 %", null -> "–" (no rate computed, e.g. no tricks). */
export function formatSuccessRate(successRate: number | null): string {
  if (successRate === null) {
    return "–";
  }
  return `${percentFormatter.format(successRate * 100)} %`;
}

/** 78.4 -> "78,4 kg" – German decimal comma, no trailing zero padding. */
export function formatKg(valueKg: number): string {
  return `${kgFormatter.format(valueKg)} kg`;
}

/** 1.3 -> "1,3 kg", -0.2 -> "kein Verlust" (a weight gain, not a loss), null -> "–". */
export function formatFluidLoss(fluidLossKg: number | null): string {
  if (fluidLossKg === null) {
    return "–";
  }
  if (fluidLossKg < 0) {
    return "kein Verlust";
  }
  return formatKg(fluidLossKg);
}
