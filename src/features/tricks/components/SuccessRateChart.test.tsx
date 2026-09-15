import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { trickHistoryEntry } from "../test/handlers";
import { installMeasuredEnv } from "../test/measuredEnv";
import { SuccessRateChart } from "./SuccessRateChart";

/*
 * Smoke test only, same reasoning as `TrickTreeGraph.test.tsx`: Recharts'
 * `ResponsiveContainer` needs jsdom's `offsetWidth`/`offsetHeight` and a
 * `ResizeObserver` to measure its container before it draws anything
 * (Ticket, Abschnitt "Verlauf" + T-0203's "Testumgebung xyflow" section,
 * reused here per the Ticket's own note). All content-level assertions about
 * the history run through `TrickHistoryTable.test.tsx` and
 * `TrickDetailScreen.test.tsx`, not this file (Ticket: "Alle inhaltlichen
 * Prüfungen laufen über die Tabelle, nicht über das Diagramm").
 *
 * Contract pinned here (design.md leaves the exact prop names to the
 * implementer, describing only what the chart renders in §5.5):
 *
 *   interface SuccessRateChartProps {
 *     history: TrickHistoryEntry[]; // already sorted ascending by the caller
 *     masteryRate: number;
 *   }
 *
 * Kriterien 4 und 13 (Ticket-Testtabelle) - siehe die Anmerkung unten zu
 * Kriterium 4, warum es hier nicht direkt geprüft wird.
 */

const TWO_POINT_HISTORY = [
  trickHistoryEntry({ sessionId: "s1", sessionDate: "2026-08-30", successRate: 0.3 }),
  trickHistoryEntry({ sessionId: "s2", sessionDate: "2026-09-06", successRate: 0.5 }),
];

describe("SuccessRateChart", () => {
  let restoreMeasuredEnv: () => void;

  beforeEach(() => {
    restoreMeasuredEnv = installMeasuredEnv();
  });

  afterEach(() => {
    restoreMeasuredEnv();
  });

  /*
   * Kriterium 4 ("kein Diagramm unter zwei Punkten") wird bewusst NICHT hier
   * geprüft: design.md §5.5 entscheidet ausdrücklich, dass `SuccessRateChart`
   * selbst diese Prüfung nicht übernimmt - `TrickDetailScreen` ruft die
   * Komponente bei `history.length < 2` gar nicht erst auf. Der Beweis dafür
   * liegt entsprechend in `TrickDetailScreen.test.tsx` (Kriterien 3 und 4),
   * nicht in diesem File. Siehe tests.md "Bekannte Lücken".
   */

  it("draws a line and a labeled reference line for two or more points, hidden from assistive technology", () => {
    const { container } = render(
      <SuccessRateChart history={TWO_POINT_HISTORY} masteryRate={0.7} />,
    );

    const responsiveContainer = container.querySelector(".recharts-responsive-container");
    expect(responsiveContainer).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".recharts-line")).not.toBeNull();
    expect(screen.getByText("sitzt ab hier")).toBeInTheDocument();
  });

  it("Kriterium 13: the reference line's position follows masteryRate, not a fixed number", () => {
    const { container: lowThreshold } = render(
      <SuccessRateChart history={TWO_POINT_HISTORY} masteryRate={0.3} />,
    );
    const lowLine = lowThreshold.querySelector(".recharts-reference-line line");

    const { container: highThreshold } = render(
      <SuccessRateChart history={TWO_POINT_HISTORY} masteryRate={0.9} />,
    );
    const highLine = highThreshold.querySelector(".recharts-reference-line line");

    expect(lowLine).not.toBeNull();
    expect(highLine).not.toBeNull();
    expect(lowLine?.getAttribute("y1")).not.toBe(highLine?.getAttribute("y1"));
  });

  it("renders no chart nodes for an empty history instead of crashing", () => {
    const { container } = render(<SuccessRateChart history={[]} masteryRate={0.7} />);

    expect(container.querySelector(".recharts-line")).toBeNull();
  });
});
