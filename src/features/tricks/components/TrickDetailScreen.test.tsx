import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";
import { renderApp } from "@/test/renderApp";
import {
  buildTrickDetailFixture,
  trickDetailErrorHandler,
  trickDetailHandler,
  trickDetailNotFoundHandler,
  trickRefView,
} from "../test/handlers";

/*
 * Renders through the real router (`/tricks/:slug`), matching every other
 * screen test in this app (see TrickTreeScreen.test.tsx and
 * SessionDetailScreen.test.tsx). `src/routes/tricks/$slug.tsx` still renders
 * T-0203's `TrickDetailPlaceholder` today, not `TrickDetailScreen` - these
 * tests fail against that placeholder's content until the implementer swaps
 * it in, on top of the "Failed to resolve import" failures that
 * `TrickDetailScreen.tsx`, `src/lib/api/errors.ts`, and the new `format.ts`
 * exports (formatRatePercent/formatDateOrDash/formatDosage/formatCategory,
 * design.md §5.7) already cause today via `fetchTrickDetail()` in `../api`.
 *
 * Expected output strings below are computed by hand from design.md §5.7's
 * documented examples (e.g. "0.35 -> '35 %'", "2026-08-03 -> '3. August
 * 2026'") rather than imported from `format.ts`, since those functions do
 * not exist yet - importing them here would just trade one missing-module
 * failure for another without adding any protection against a wrong format.
 *
 * Kriterien 1-7 (Ticket-Testtabelle).
 */

describe("TrickDetailScreen", () => {
  it("Kriterium 1: shows name, status, numbers, prerequisites, unlocks, and the history table ascending by date", async () => {
    server.use(trickDetailHandler(buildTrickDetailFixture()));

    renderApp({ initialPath: "/tricks/pop-shove-it" });

    expect(await screen.findByRole("heading", { name: "Pop Shove-it" })).toBeInTheDocument();
    expect(screen.getByText("Übe ich")).toBeInTheDocument();
    expect(screen.getByText("Rotation · Schwierigkeit 3 von 10")).toBeInTheDocument();
    expect(screen.getByText("Ziel 2 von 7")).toBeInTheDocument();

    // Zahlenblock. "50 %" und "6. September 2026" kommen realistischerweise
    // auch in der Verlaufstabelle vor (die jüngste Einheit *ist* die zuletzt
    // geübte, mit derselben Erfolgsquote) - auf die jeweilige Kachel
    // eingegrenzt, statt `getByText` über die ganze Seite laufen zu lassen.
    expect(screen.getByText("34")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("35 %")).toBeInTheDocument();
    const recentRateTile = screen.getByText("Quote der letzten Einheiten")
      .parentElement as HTMLElement;
    expect(within(recentRateTile).getByText("50 %")).toBeInTheDocument();
    expect(screen.getByText("3. August 2026")).toBeInTheDocument();
    const lastPracticedTile = screen.getByText("Zuletzt geübt").parentElement as HTMLElement;
    expect(within(lastPracticedTile).getByText("6. September 2026")).toBeInTheDocument();

    // Voraussetzungen / Freischaltungen, je ein Link auf die eigene Detailseite
    const prerequisite = screen.getByRole("link", { name: /Ollie/ });
    expect(prerequisite).toHaveAttribute("href", "/tricks/ollie");
    const unlock = screen.getByRole("link", { name: /Boardslide/ });
    expect(unlock).toHaveAttribute("href", "/tricks/boardslide");

    // Verlaufstabelle: eine Zeile je Einheit, aufsteigend nach Datum (design.md §3) -
    // die Fixture liefert "neuestes zuerst" (Wire-Reihenfolge), die Tabelle muss
    // also umgekehrt erscheinen: 30. August vor 6. September.
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(3); // Kopfzeile + 2 Einheiten
    expect(rows[1]).toHaveTextContent("30. August 2026");
    expect(rows[1]).toHaveTextContent("Regen");
    expect(rows[2]).toHaveTextContent("6. September 2026");
  });

  it("Kriterium 2: hides the description paragraph and stays fully readable when it is null", async () => {
    server.use(trickDetailHandler(buildTrickDetailFixture({ description: null })));

    renderApp({ initialPath: "/tricks/pop-shove-it" });

    await screen.findByRole("heading", { name: "Pop Shove-it" });
    expect(
      screen.queryByText("Board dreht 180 Grad unter dir, Füße bleiben über dem Board."),
    ).not.toBeInTheDocument();
    // Rest of the page still renders - no crash, no missing sections.
    expect(screen.getByText("Setzt voraus")).toBeInTheDocument();
  });

  it("Kriterium 3: shows the empty-history hint and no table when history has no entries", async () => {
    server.use(trickDetailHandler(buildTrickDetailFixture({ history: [] })));

    renderApp({ initialPath: "/tricks/pop-shove-it" });

    expect(
      await screen.findByText("Noch keine Einheit mit diesem Trick erfasst."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("Kriterium 4: shows a one-row table and no chart with exactly one history entry", async () => {
    server.use(
      trickDetailHandler(
        buildTrickDetailFixture({
          history: [
            {
              sessionId: "session-1",
              sessionDate: "2026-09-06",
              attempts: 8,
              landed: 4,
              successRate: 0.5,
              notes: null,
            },
          ],
        }),
      ),
    );

    renderApp({ initialPath: "/tricks/pop-shove-it" });

    const table = await screen.findByRole("table");
    expect(screen.getAllByRole("row")).toHaveLength(2); // Kopfzeile + 1 Einheit
    expect(table).toHaveTextContent("6. September 2026");
    // Kein Diagramm unter zwei Punkten (design.md §5.5: TrickDetailScreen prüft
    // die Länge selbst, bevor SuccessRateChart überhaupt aufgerufen wird).
    expect(document.querySelector(".recharts-responsive-container")).toBeNull();
  });

  it("Kriterium 5: an unknown slug shows its own not-found text, never the general error", async () => {
    server.use(trickDetailNotFoundHandler("unknown-trick"));

    renderApp({ initialPath: "/tricks/unknown-trick" });

    expect(await screen.findByText("Diesen Trick gibt es nicht")).toBeInTheDocument();
    expect(
      screen.getByText("Vielleicht hat sich der Link geändert. Geh zurück zum Trick-Tree."),
    ).toBeInTheDocument();
    // Nur der Pfad ist Vertrag (Ticket nennt keine Suchparameter für diesen
    // Link) - der Rückweg nutzt vermutlich dieselben Standard-Suchparameter
    // wie T-0203s Platzhalter (`view=graph&showLocked=true`), das ist hier
    // kein Prüfgegenstand.
    expect(screen.getByRole("link", { name: "Zum Trick-Tree" }).getAttribute("href")).toMatch(
      /^\/tricks(\?.*)?$/,
    );
    expect(screen.queryByText("Der Trick lädt gerade nicht")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("Kriterium 6: a network/server error shows the general error, and retry reloads successfully", async () => {
    const user = userEvent.setup();
    server.use(trickDetailErrorHandler("pop-shove-it", 500));

    renderApp({ initialPath: "/tricks/pop-shove-it" });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Der Trick lädt gerade nicht");
    const retry = screen.getByRole("button", { name: "Erneut versuchen" });
    expect(retry).toHaveAttribute("data-track", "tricks.detail-retry");

    server.use(trickDetailHandler(buildTrickDetailFixture()));
    await user.click(retry);

    expect(await screen.findByRole("heading", { name: "Pop Shove-it" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("Kriterium 7: a 'sitzt' prerequisite is a link to its own detail address", async () => {
    server.use(
      trickDetailHandler(
        buildTrickDetailFixture({
          requires: [trickRefView({ slug: "ollie", name: "Ollie", status: "sitzt" })],
        }),
      ),
    );

    renderApp({ initialPath: "/tricks/pop-shove-it" });

    const prerequisite = await screen.findByRole("link", { name: /Ollie/ });
    expect(prerequisite).toHaveAttribute("href", "/tricks/ollie");
    expect(prerequisite).toHaveAttribute("data-track", "tricks.detail-prerequisite");
    // Der Statustext steht als Badge daneben, nicht nur farblich (wie überall in der App).
    expect(prerequisite).toHaveTextContent("Sitzt");
  });

  it("Ticket §Voraussetzungen/Schaltet frei: shows the dedicated empty texts instead of empty lists", async () => {
    server.use(trickDetailHandler(buildTrickDetailFixture({ requires: [], unlocks: [] })));

    renderApp({ initialPath: "/tricks/pop-shove-it" });

    await screen.findByRole("heading", { name: "Pop Shove-it" });
    expect(screen.getByText("Dieser Trick hat keine Voraussetzung.")).toBeInTheDocument();
    expect(screen.getByText("Dieser Trick schaltet nichts frei.")).toBeInTheDocument();
  });

  it("Ticket §data-track: the unlock link and back link carry their documented values", async () => {
    server.use(trickDetailHandler(buildTrickDetailFixture()));

    renderApp({ initialPath: "/tricks/pop-shove-it" });

    expect(await screen.findByRole("link", { name: /Boardslide/ })).toHaveAttribute(
      "data-track",
      "tricks.detail-unlock",
    );
    expect(screen.getByRole("link", { name: "Zum Trick-Tree" })).toHaveAttribute(
      "data-track",
      "tricks.detail-back",
    );
  });
});
