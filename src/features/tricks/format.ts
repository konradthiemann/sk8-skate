import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import type { TrickDosage } from "./api";

const percentFormatter = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

const CATEGORY_LABELS: Record<string, string> = {
  flat: "Flat",
  rotation: "Rotation",
  balance: "Balance",
  slide: "Slide",
  grind: "Grind",
  air: "Air",
};

/**
 * "21 von 96 Versuchen · 22 %", or the no-attempts text when `attemptsTotal`
 * is 0 - owns its own empty-case fallback so callers never branch on it
 * (tests.md, analog zu `src/features/sessions/format.ts`).
 */
export function formatSuccessRate(landedTotal: number, attemptsTotal: number): string {
  if (attemptsTotal === 0) {
    return "Noch keine Versuche erfasst";
  }
  const rate = percentFormatter.format((landedTotal / attemptsTotal) * 100);
  return `${landedTotal} von ${attemptsTotal} Versuchen · ${rate} %`;
}

/** "2026-09-06" -> "Zuletzt geübt: 6. September 2026", null -> "Noch nie geübt". */
export function formatPracticedOn(lastPracticedOn: string | null): string {
  if (lastPracticedOn === null) {
    return "Noch nie geübt";
  }
  return `Zuletzt geübt: ${format(parseISO(lastPracticedOn), "d. MMMM yyyy", { locale: de })}`;
}

/**
 * "0.35 -> '56 %'" (kaufmännisch gerundet), null/undefined -> "–" – für
 * bereits berechnete Raten (Zahlenblock, Verlaufseinträge), anders als
 * `formatSuccessRate()` oben, das aus zwei rohen Zählern rechnet
 * (design.md §5.7).
 */
export function formatRatePercent(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) {
    return "–";
  }
  return `${percentFormatter.format(rate * 100)} %`;
}

/** "2026-08-11" -> "11. August 2026", null/undefined -> "–" – Zahlenblock (firstLandedOn, lastPracticedOn). */
export function formatDateOrDash(dateIso: string | null | undefined): string {
  if (dateIso === null || dateIso === undefined) {
    return "–";
  }
  return format(parseISO(dateIso), "d. MMMM yyyy", { locale: de });
}

/** { attemptsMin: 15, attemptsMax: 30, minutesMin: 10, minutesMax: 20 } -> "15–30 Versuche · 10–20 Minuten". */
export function formatDosage(dosage: TrickDosage): string {
  return `${dosage.attemptsMin}–${dosage.attemptsMax} Versuche · ${dosage.minutesMin}–${dosage.minutesMax} Minuten`;
}

/** "rotation" -> "Rotation", unbekannter Wert -> unverändert zurückgegeben (Ticket-Tabelle "Kategorienamen"). */
export function formatCategory(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}
