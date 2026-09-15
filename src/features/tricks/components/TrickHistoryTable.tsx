import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TrickHistoryEntry } from "../api";
import { formatDateOrDash, formatRatePercent } from "../format";

interface TrickHistoryTableProps {
  /** Bereits aufsteigend nach Datum sortiert vom Aufrufer (design.md §3) – diese Komponente sortiert nicht selbst. */
  history: TrickHistoryEntry[];
}

/** Zugängliche Tabelle des Verlaufs (Ticket, Abschnitt "Verlauf") – einzige AT-Datenquelle neben dem Diagramm. */
export function TrickHistoryTable({ history }: TrickHistoryTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Datum</TableHead>
          <TableHead>Versuche</TableHead>
          <TableHead>Treffer</TableHead>
          <TableHead>Quote</TableHead>
          <TableHead>Notiz</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {history.map((entry) => (
          <TableRow key={entry.sessionId}>
            <TableCell>{formatDateOrDash(entry.sessionDate)}</TableCell>
            <TableCell>{entry.attempts}</TableCell>
            <TableCell>{entry.landed}</TableCell>
            <TableCell>{formatRatePercent(entry.successRate ?? null)}</TableCell>
            <TableCell>{entry.notes ?? "–"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
