import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { trickHistoryEntry } from "../test/handlers";
import { TrickHistoryTable } from "./TrickHistoryTable";

/*
 * Props-only test, no MSW, no router - a pure display component (Ticket,
 * Abschnitt "Verlauf": "die darunterliegende Tabelle ist die zugängliche
 * Datenquelle"). Renders whatever order it receives; `TrickDetailScreen`
 * sorts `history` ascending before passing it down (design.md §3) - this
 * component does not sort a second time.
 *
 *   interface TrickHistoryTableProps { history: TrickHistoryEntry[] }
 *
 * Ticket-Testtabelle: Spaltenreihenfolge, Datumsformat, Notiz leer.
 */

describe("TrickHistoryTable", () => {
  it("shows the columns in the documented order: Datum, Versuche, Treffer, Quote, Notiz", () => {
    render(
      <TrickHistoryTable
        history={[
          trickHistoryEntry({
            sessionId: "s1",
            sessionDate: "2026-09-06",
            attempts: 8,
            landed: 4,
            successRate: 0.5,
            notes: null,
          }),
        ]}
      />,
    );

    const headers = screen.getAllByRole("columnheader").map((header) => header.textContent);
    expect(headers).toEqual(["Datum", "Versuche", "Treffer", "Quote", "Notiz"]);
  });

  it("formats the session date with the full German month name and shows attempts/landed/rate", () => {
    render(
      <TrickHistoryTable
        history={[
          trickHistoryEntry({
            sessionId: "s1",
            sessionDate: "2026-09-06",
            attempts: 8,
            landed: 4,
            successRate: 0.5,
            notes: null,
          }),
        ]}
      />,
    );

    const rows = screen.getAllByRole("row");
    const dataRow = rows[1] as HTMLElement;
    expect(within(dataRow).getByText("6. September 2026")).toBeInTheDocument();
    expect(within(dataRow).getByText("8")).toBeInTheDocument();
    expect(within(dataRow).getByText("4")).toBeInTheDocument();
    expect(within(dataRow).getByText("50 %")).toBeInTheDocument();
  });

  it("shows a dash instead of an empty cell when a session has no note", () => {
    render(
      <TrickHistoryTable
        history={[
          trickHistoryEntry({
            sessionId: "s1",
            sessionDate: "2026-09-06",
            notes: null,
          }),
        ]}
      />,
    );

    const dataRow = screen.getAllByRole("row")[1] as HTMLElement;
    expect(within(dataRow).getByText("–")).toBeInTheDocument();
  });

  it("shows the note text when present", () => {
    render(
      <TrickHistoryTable
        history={[
          trickHistoryEntry({
            sessionId: "s1",
            sessionDate: "2026-08-30",
            notes: "Regen",
          }),
        ]}
      />,
    );

    const dataRow = screen.getAllByRole("row")[1] as HTMLElement;
    expect(within(dataRow).getByText("Regen")).toBeInTheDocument();
  });

  it("renders one row per history entry, in the order it received them", () => {
    render(
      <TrickHistoryTable
        history={[
          trickHistoryEntry({ sessionId: "s1", sessionDate: "2026-08-30" }),
          trickHistoryEntry({ sessionId: "s2", sessionDate: "2026-09-06" }),
        ]}
      />,
    );

    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(3); // Kopfzeile + 2 Einheiten
    expect(rows[1]).toHaveTextContent("30. August 2026");
    expect(rows[2]).toHaveTextContent("6. September 2026");
  });
});
