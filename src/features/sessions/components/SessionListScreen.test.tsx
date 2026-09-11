import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { API_URL } from "@/test/msw/handlers";
import { server } from "@/test/msw/server";
import { renderApp } from "@/test/renderApp";
import { formatDuration, formatSessionDate, formatSuccessRate } from "../format";
import {
  buildSessionSummary,
  sessionsListErrorHandler,
  sessionsListHandler,
} from "../test/handlers";

/*
 * Renders through the real router (`/sessions`), not the component directly –
 * matches every other screen test in this app (see StartScreen.test.tsx and
 * design.md "Screen-Tests nutzen renderApp"). Until `src/routes/sessions/`
 * exists and `routeTree.gen.ts` is regenerated, `/sessions` still resolves to
 * the old placeholder route, so these fail for that reason today.
 */

describe("SessionListScreen", () => {
  it("Kriterium 1: shows the empty state and the capture button when there are no sessions", async () => {
    server.use(sessionsListHandler([], 0));
    renderApp({ initialPath: "/sessions" });

    expect(await screen.findByText("Noch keine Session erfasst")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Log deine erste Einheit. Danach siehst du hier deinen Verlauf mit Dauer, Tricks und Erfolgsquote.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Session erfassen" })).toHaveAttribute(
      "href",
      "/sessions/new",
    );
  });

  it("Kriterium 2: shows the loading status while the request is running", async () => {
    server.use(
      http.get(`${API_URL}/api/skate-sessions`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return HttpResponse.json({ items: [], total: 0 }, { status: 200 });
      }),
    );

    renderApp({ initialPath: "/sessions" });

    // Like every other screen test in this repo: the router renders nothing
    // synchronously right after renderApp(), so the initial status has to be
    // awaited rather than asserted immediately.
    expect(await screen.findByRole("status")).toHaveTextContent("Sessions werden geladen …");
  });

  it("Kriterium 3: shows the error with a retry that reloads the list", async () => {
    const user = userEvent.setup();
    server.use(sessionsListErrorHandler(500));
    renderApp({ initialPath: "/sessions" });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Deine Sessions konnten nicht geladen werden.");
    const retry = screen.getByRole("button", { name: "Nochmal versuchen" });

    server.use(sessionsListHandler([buildSessionSummary({ id: "s1" })], 1));
    await user.click(retry);

    expect(await screen.findByText(formatSessionDate("2026-09-06"))).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("Kriterien 4 und 5: groups by month, sorts newest first, and shows a dash without tricks", async () => {
    const sessions = [
      buildSessionSummary({
        id: "s1",
        sessionDate: "2026-09-06",
        location: "Skatepark Braunschweig",
        durationMinutes: 60,
        trickCount: 3,
        successRate: 0.6,
      }),
      buildSessionSummary({
        id: "s2",
        sessionDate: "2026-09-02",
        location: "Skatepark Braunschweig",
        durationMinutes: 45,
        trickCount: 0,
        totalAttempts: 0,
        totalLanded: 0,
        successRate: null,
      }),
      buildSessionSummary({
        id: "s3",
        sessionDate: "2026-08-28",
        location: "Halle X",
        durationMinutes: 90,
        trickCount: 5,
        successRate: 0.43,
        kneePain: 7,
      }),
    ];
    server.use(sessionsListHandler(sessions, sessions.length));

    renderApp({ initialPath: "/sessions" });

    await screen.findByText("3 Sessions");
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "September 2026",
      "August 2026",
    ]);

    const bodyText = document.body.textContent ?? "";
    const sepHeadingIndex = bodyText.indexOf("September 2026");
    const augHeadingIndex = bodyText.indexOf("August 2026");
    const s1Index = bodyText.indexOf(formatSessionDate("2026-09-06"));
    const s2Index = bodyText.indexOf(formatSessionDate("2026-09-02"));
    const s3Index = bodyText.indexOf(formatSessionDate("2026-08-28"));
    expect(sepHeadingIndex).toBeGreaterThanOrEqual(0);
    expect(sepHeadingIndex).toBeLessThan(s1Index);
    expect(s1Index).toBeLessThan(s2Index);
    expect(s2Index).toBeLessThan(augHeadingIndex);
    expect(augHeadingIndex).toBeLessThan(s3Index);

    expect(screen.getByText(formatDuration(60))).toBeInTheDocument();
    expect(screen.getByText(formatDuration(45))).toBeInTheDocument();
    expect(screen.getByText(formatDuration(90))).toBeInTheDocument();
    expect(screen.getByText("3 Tricks")).toBeInTheDocument();
    expect(screen.getByText("5 Tricks")).toBeInTheDocument();
    expect(screen.getByText(formatSuccessRate(0.6))).toBeInTheDocument();
    expect(screen.getByText(formatSuccessRate(0.43))).toBeInTheDocument();

    const dash = screen.getByText("–");
    expect(dash).toHaveAttribute("aria-label", "keine Tricks erfasst");

    const kneeBadge = screen.getByText("Knie");
    expect(kneeBadge).toHaveAttribute("aria-label", "Knieschmerz 7 von 10");
  });

  it("Kriterium 6: shows 'Mehr laden' while more sessions exist and loads the rest on tap", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${API_URL}/api/skate-sessions`, ({ request }) => {
        const limit = Number(new URL(request.url).searchParams.get("limit") ?? "50");
        const count = Math.min(limit, 60);
        const items = Array.from({ length: count }, (_, i) =>
          buildSessionSummary({ id: `s-${i}`, sessionDate: "2026-09-01", location: `Spot ${i}` }),
        );
        return HttpResponse.json({ items, total: 60 }, { status: 200 });
      }),
    );

    renderApp({ initialPath: "/sessions" });

    await screen.findByText("Spot 0");
    expect(screen.getAllByText(/^Spot \d+$/)).toHaveLength(50);
    const loadMore = screen.getByRole("button", { name: "Mehr laden" });

    await user.click(loadMore);

    await screen.findByText("Spot 59");
    expect(screen.getAllByText(/^Spot \d+$/)).toHaveLength(60);
    expect(screen.queryByRole("button", { name: "Mehr laden" })).not.toBeInTheDocument();
  });
});
