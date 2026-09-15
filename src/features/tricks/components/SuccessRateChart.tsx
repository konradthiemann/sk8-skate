import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Line, LineChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { TrickHistoryEntry } from "../api";

interface SuccessRateChartProps {
  /** Bereits aufsteigend nach Datum sortiert vom Aufrufer (design.md §3). */
  history: TrickHistoryEntry[];
  masteryRate: number;
}

interface ChartPoint {
  sessionDate: string;
  successRatePercent: number;
}

function toChartPoint(entry: TrickHistoryEntry): ChartPoint {
  return {
    sessionDate: entry.sessionDate,
    successRatePercent: Math.round((entry.successRate ?? 0) * 100),
  };
}

function formatShortDate(dateIso: string): string {
  return format(parseISO(dateIso), "d. MMM", { locale: de });
}

function formatPercentTick(value: number): string {
  return `${value} %`;
}

/**
 * Recharts-Diagramm (Ticket, Abschnitt "Verlauf"). `aria-hidden="true"` auf
 * `<ResponsiveContainer>` statt auf `<LineChart>`, plus
 * `accessibilityLayer={false}`: der Ticket-Wortlaut ("Diagramm ist
 * aria-hidden") kompiliert nicht gegen Recharts 3.10.1s Typen und wäre allein
 * unvollständig, weil `accessibilityLayer` das SVG standardmäßig
 * tastaturfokussierbar macht (design.md §5.5). Die darunterliegende
 * `TrickHistoryTable` bleibt die einzige Datenquelle für assistive Technologie.
 */
export function SuccessRateChart({ history, masteryRate }: SuccessRateChartProps) {
  const data = history.map(toChartPoint);

  return (
    <ResponsiveContainer aria-hidden="true" width="100%" height={200}>
      <LineChart
        data={data}
        accessibilityLayer={false}
        margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
      >
        <XAxis dataKey="sessionDate" tickFormatter={formatShortDate} />
        <YAxis domain={[0, 100]} tickFormatter={formatPercentTick} />
        {data.length > 0 && <Line dataKey="successRatePercent" dot />}
        <ReferenceLine y={masteryRate * 100} label="sitzt ab hier" />
      </LineChart>
    </ResponsiveContainer>
  );
}
