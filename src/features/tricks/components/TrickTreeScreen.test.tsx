import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_URL } from "@/test/msw/handlers";
import { server } from "@/test/msw/server";
import { renderApp } from "@/test/renderApp";
import { formatSuccessRate } from "../format";
import {
  buildTrickRecommendationFixture,
  buildTrickTreeFixture,
  trickRecommendationErrorHandler,
  trickRecommendationHandler,
  trickSuggestion,
  trickTreeErrorHandler,
  trickTreeHandler,
  trickTreeNode,
} from "../test/handlers";

/*
 * Renders through the real router (`/tricks`), not the component directly -
 * matches every other screen test in this app (see SessionListScreen.test.tsx
 * and design.md "Screen-Tests nutzen renderApp"). Until `src/routes/tricks/`
 * exists and `routeTree.gen.ts` is regenerated, `/tricks` still resolves to
 * the old flat placeholder route, so these fail for that reason today, on top
 * of the "Cannot find module '../format'" failure the missing `format.ts`
 * already causes.
 *
 * Proves Kriterien 1-10 and 13 in the list view (Ticket-Testtabelle); the
 * graph view gets only the smoke test in TrickTreeGraph.test.tsx.
 *
 * T-0204 addition: once `TrickTreeScreen` also queries
 * `GET /api/trick-recommendation` for the focus card, every test in this
 * file makes that second request too - not just the two below that care
 * about its content. The `beforeEach` registers a default success handler so
 * the T-0203 tests above (left verbatim, per this ticket's scope) keep
 * passing instead of failing on MSW's `onUnhandledRequest: "error"`
 * (src/test/setup.ts) the moment the implementer wires the query in.
 */

describe("TrickTreeScreen", () => {
  beforeEach(() => {
    server.use(trickRecommendationHandler());
  });

  it("Kriterium 1: shows every trick with its name and status badge", async () => {
    server.use(
      trickTreeHandler(
        buildTrickTreeFixture({
          nodes: [
            trickTreeNode({
              slug: "ollie",
              name: "Ollie",
              status: "sitzt",
              attemptsTotal: 96,
              landedTotal: 21,
            }),
            trickTreeNode({ slug: "50-50", name: "50-50", status: "uebe" }),
            trickTreeNode({ slug: "boardslide", name: "Boardslide", status: "gesperrt" }),
          ],
          edges: [{ from: "ollie", to: "boardslide" }],
        }),
      ),
    );
    renderApp({ initialPath: "/tricks?view=list" });

    await screen.findByText("Ollie");
    expect(screen.getByText("50-50")).toBeInTheDocument();
    expect(screen.getByText("Boardslide")).toBeInTheDocument();
    expect(screen.getByText(formatSuccessRate(21, 96))).toBeInTheDocument();
    expect(screen.getAllByText("Sitzt").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Übe ich").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Gesperrt").length).toBeGreaterThan(0);
  });

  it("Kriterium 2: a locked trick and its edges disappear when showLocked=false", async () => {
    server.use(
      trickTreeHandler(
        buildTrickTreeFixture({
          nodes: [
            trickTreeNode({ slug: "ollie", name: "Ollie", status: "sitzt" }),
            trickTreeNode({ slug: "boardslide", name: "Boardslide", status: "gesperrt" }),
          ],
          edges: [{ from: "ollie", to: "boardslide" }],
        }),
      ),
    );
    renderApp({ initialPath: "/tricks?view=list&showLocked=false" });

    await screen.findByText("Ollie");
    expect(screen.queryByText("Boardslide")).not.toBeInTheDocument();
  });

  it("Kriterium 3: switching to 'Karte' updates the address, which alone decides the view when reopened", async () => {
    const user = userEvent.setup();
    server.use(trickTreeHandler());
    const { router } = renderApp({ initialPath: "/tricks?view=list" });

    await screen.findByRole("list", { name: "Trick-Tree als Liste" });
    await user.click(screen.getByRole("radio", { name: "Karte", checked: false }));

    await vi.waitFor(() => expect(router.state.location.search.view).toBe("graph"));

    // Simulates arriving at this exact address via back/forward navigation:
    // design.md §5.1 ties Kriterium 3 to `view` living entirely in the URL,
    // never in component-local memory of the last click.
    renderApp({ initialPath: "/tricks?view=graph" });
    expect(await screen.findByRole("region", { name: "Trick-Tree als Karte" })).toBeInTheDocument();
  });

  it("Kriterium 6: a locked list entry names its missing prerequisites", async () => {
    server.use(
      trickTreeHandler(
        buildTrickTreeFixture({
          nodes: [
            trickTreeNode({ slug: "ollie", name: "Ollie", status: "sitzt" }),
            trickTreeNode({ slug: "50-50", name: "50-50", status: "uebe" }),
            trickTreeNode({ slug: "boardslide", name: "Boardslide", status: "gesperrt" }),
          ],
          edges: [
            { from: "ollie", to: "boardslide" },
            { from: "50-50", to: "boardslide" },
          ],
        }),
      ),
    );
    renderApp({ initialPath: "/tricks?view=list" });

    // Ollie already "sitzt" and is not missing; 50-50 is still "uebe".
    expect(await screen.findByText("Braucht noch: 50-50")).toBeInTheDocument();
  });

  it("Kriterium 7: shows the error state, and a successful retry replaces it", async () => {
    const user = userEvent.setup();
    server.use(trickTreeErrorHandler(500));
    renderApp({ initialPath: "/tricks" });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Der Trick-Tree lädt gerade nicht");
    expect(alert).toHaveTextContent("Prüf deine Verbindung und versuch es noch einmal.");
    const retry = screen.getByRole("button", { name: "Erneut versuchen" });

    server.use(trickTreeHandler());
    await user.click(retry);

    await screen.findByRole("region", { name: "Trick-Tree als Karte" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("Kriterium 8: shows the empty-catalog card and no graph/list container when there are no tricks", async () => {
    server.use(trickTreeHandler(buildTrickTreeFixture({ nodes: [], edges: [] })));
    renderApp({ initialPath: "/tricks" });

    expect(await screen.findByText("Noch kein Trick-Katalog")).toBeInTheDocument();
    expect(
      screen.getByText("Sobald Tricks angelegt sind, siehst du sie hier als Karte."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Trick-Tree als Karte" })).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Trick-Tree als Liste" })).not.toBeInTheDocument();
  });

  it("ux.md Zustandsdiagramm: shows the filtered-empty hint, not the catalog-empty text, when the filter hides everything", async () => {
    server.use(
      trickTreeHandler(
        buildTrickTreeFixture({
          nodes: [trickTreeNode({ slug: "boardslide", name: "Boardslide", status: "gesperrt" })],
          edges: [],
        }),
      ),
    );
    renderApp({ initialPath: "/tricks?showLocked=false" });

    expect(
      await screen.findByText("Alle Tricks sind ausgeblendet. Blende die gesperrten wieder ein."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Noch kein Trick-Katalog")).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Gesperrte zeigen" })).toBeEnabled();
  });

  it("Kriterium 9: shows an aria-busy loading state without an error while the request is running", async () => {
    server.use(
      http.get(`${API_URL}/api/trick-tree`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return HttpResponse.json(buildTrickTreeFixture(), { status: 200 });
      }),
    );
    renderApp({ initialPath: "/tricks" });

    const loading = await screen.findByLabelText("Trick-Tree wird geladen");
    expect(loading).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("Kriterium 10: tapping a list entry navigates to its detail address", async () => {
    const user = userEvent.setup();
    server.use(
      trickTreeHandler(
        buildTrickTreeFixture({
          nodes: [trickTreeNode({ slug: "ollie", name: "Ollie", status: "sitzt" })],
          edges: [],
        }),
      ),
    );
    const { router } = renderApp({ initialPath: "/tricks?view=list" });

    const entry = await screen.findByRole("link", { name: /Ollie/ });
    await user.click(entry);

    await vi.waitFor(() => expect(router.state.location.pathname).toBe("/tricks/ollie"));
  });

  it("Kriterium 13: the threshold hint uses the policy values from the response, not hardcoded numbers", async () => {
    server.use(
      trickTreeHandler(buildTrickTreeFixture({ policy: { masteryRate: 0.8, masterySessions: 5 } })),
    );
    renderApp({ initialPath: "/tricks" });

    expect(
      await screen.findByText("Ein Trick gilt als „sitzt“ ab 80 % Erfolgsquote über 5 Einheiten."),
    ).toBeInTheDocument();
  });

  it("ux.md §7.2: switching to 'Liste' announces it and moves focus into the list", async () => {
    const user = userEvent.setup();
    server.use(trickTreeHandler());
    renderApp({ initialPath: "/tricks?view=graph" });

    await screen.findByRole("region", { name: "Trick-Tree als Karte" });
    await user.click(screen.getByRole("radio", { name: "Liste", checked: false }));

    const list = await screen.findByRole("list", { name: "Trick-Tree als Liste" });
    expect(document.activeElement).toBe(list);
    expect(screen.getByRole("status")).toHaveTextContent("Ansicht: Liste.");
  });

  it("ux.md §7.2: switching to 'Karte' announces it but leaves focus on the toggle button, not the graph", async () => {
    const user = userEvent.setup();
    server.use(trickTreeHandler());
    renderApp({ initialPath: "/tricks?view=list" });

    await screen.findByRole("list", { name: "Trick-Tree als Liste" });
    const cardToggle = screen.getByRole("radio", { name: "Karte", checked: false });
    await user.click(cardToggle);

    await screen.findByRole("region", { name: "Trick-Tree als Karte" });
    expect(document.activeElement).toBe(cardToggle);
    expect(screen.getByRole("status")).toHaveTextContent("Ansicht: Karte.");
  });

  it("ux.md §7.2: makes no announcement and steals no focus on the initial load", async () => {
    server.use(trickTreeHandler());
    renderApp({ initialPath: "/tricks" });

    await screen.findByRole("region", { name: "Trick-Tree als Karte" });
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("ux.md Ergänzung: the 'Gesperrte zeigen' switch hides and re-shows locked tricks live", async () => {
    const user = userEvent.setup();
    server.use(
      trickTreeHandler(
        buildTrickTreeFixture({
          nodes: [
            trickTreeNode({ slug: "ollie", name: "Ollie", status: "sitzt" }),
            trickTreeNode({ slug: "boardslide", name: "Boardslide", status: "gesperrt" }),
          ],
          edges: [{ from: "ollie", to: "boardslide" }],
        }),
      ),
    );
    renderApp({ initialPath: "/tricks?view=list" });

    await screen.findByText("Boardslide");
    const toggle = screen.getByRole("switch", { name: "Gesperrte zeigen" });
    expect(toggle).toHaveAttribute("data-track", "tricks.toggle-locked");

    await user.click(toggle);
    expect(screen.queryByText("Boardslide")).not.toBeInTheDocument();

    await user.click(toggle);
    expect(await screen.findByText("Boardslide")).toBeInTheDocument();
  });

  it("Ticket §data-track: the view toggle, retry, and list entry carry their documented values", async () => {
    server.use(
      trickTreeHandler(
        buildTrickTreeFixture({
          nodes: [trickTreeNode({ slug: "ollie", name: "Ollie", status: "sitzt" })],
          edges: [],
        }),
      ),
    );
    renderApp({ initialPath: "/tricks?view=list" });

    expect(await screen.findByRole("radio", { name: "Karte" })).toHaveAttribute(
      "data-track",
      "tricks.view-graph",
    );
    expect(screen.getByRole("radio", { name: "Liste" })).toHaveAttribute(
      "data-track",
      "tricks.view-list",
    );
    expect(screen.getByRole("link", { name: /Ollie/ })).toHaveAttribute(
      "data-track",
      "tricks.open-detail",
    );
  });

  it("Ticket §data-track: the retry button is marked in the error state", async () => {
    server.use(trickTreeErrorHandler(500));
    renderApp({ initialPath: "/tricks" });

    expect(await screen.findByRole("button", { name: "Erneut versuchen" })).toHaveAttribute(
      "data-track",
      "tricks.retry",
    );
  });

  it("Kriterium 10: a recommendation-only failure still shows the tree normally, with the focus card showing its own error", async () => {
    server.use(trickTreeHandler(), trickRecommendationErrorHandler(500));

    renderApp({ initialPath: "/tricks?view=list" });

    await screen.findByText("Ollie");
    expect(screen.getByText("Die Empfehlung lädt gerade nicht.")).toBeInTheDocument();
    // Der Baum bleibt normal bedienbar - kein Alert/Fehlertext des Baums selbst.
    expect(screen.queryByText("Der Trick-Tree lädt gerade nicht")).not.toBeInTheDocument();
  });

  it("Kriterium 12: focus marks exactly two entries, only the primary one with the 'Als Nächstes' badge", async () => {
    server.use(
      trickTreeHandler(
        buildTrickTreeFixture({
          nodes: [
            trickTreeNode({ slug: "ollie", name: "Ollie", status: "sitzt" }),
            trickTreeNode({ slug: "50-50", name: "50-50", status: "uebe" }),
            trickTreeNode({ slug: "boardslide", name: "Boardslide", status: "gesperrt" }),
          ],
          edges: [],
        }),
      ),
      trickRecommendationHandler(
        buildTrickRecommendationFixture({
          primary: trickSuggestion({ slug: "50-50", name: "50-50" }),
          secondary: [trickSuggestion({ slug: "boardslide", name: "Boardslide" })],
        }),
      ),
    );

    renderApp({ initialPath: "/tricks?view=list" });

    await screen.findByText("Ollie");

    // Nur der primary-Trick trägt den Textbadge - genau einmal auf der Seite.
    expect(screen.getAllByText("Als Nächstes")).toHaveLength(1);

    // Auf `list` eingegrenzt: "50-50" und "Boardslide" sind hier absichtlich
    // sowohl der Fokus-Karten-Vorschlag als auch ein echter Listeneintrag
    // (das ist der Punkt dieses Tests) - ohne Eingrenzung liefert
    // `screen.getByRole("link", ...)` zwei Treffer (Fokus-Karte + Liste).
    const list = screen.getByRole("list", { name: "Trick-Tree als Liste" });
    const primaryEntry = within(list)
      .getByRole("link", { name: /50-50/ })
      .closest("li") as HTMLElement;
    const secondaryEntry = within(list)
      .getByRole("link", { name: /Boardslide/ })
      .closest("li") as HTMLElement;
    const nonFocusEntry = within(list)
      .getByRole("link", { name: /Ollie/ })
      .closest("li") as HTMLElement;

    // Beide Fokus-Tricks (primary + secondary) tragen das Fokus-Symbol,
    // ux.md §7.4: ArrowUpRight statt Target (Symbol-Konflikt mit Status "uebe").
    expect(within(primaryEntry).getByText("Als Nächstes")).toBeInTheDocument();
    expect(primaryEntry.querySelector("svg.lucide-arrow-up-right")).not.toBeNull();
    expect(secondaryEntry.querySelector("svg.lucide-arrow-up-right")).not.toBeNull();
    expect(within(secondaryEntry).queryByText("Als Nächstes")).not.toBeInTheDocument();
    expect(nonFocusEntry.querySelector("svg.lucide-arrow-up-right")).toBeNull();
  });
});
