import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";
import { renderApp } from "@/test/renderApp";
import { formatSessionDate } from "../format";
import {
  buildSessionResponse,
  sessionDetailErrorHandler,
  sessionDetailHandler,
  sessionDetailNotFoundHandler,
} from "../test/handlers";

/*
 * Renders through the real router (`/sessions/:id`), matching every other
 * screen test in this app. `src/routes/sessions/$sessionId/index.tsx` does
 * not exist yet, so all of these fail on that missing route today – the
 * same reasoning `SessionListScreen.test.tsx` documented for T-0104.
 *
 * Kriterien 2-8.
 */

describe("SessionDetailScreen", () => {
  it("Kriterium 2: shows each practiced trick's name, result, quote, and the second row's note", async () => {
    const session = buildSessionResponse({
      id: "session-1",
      sessionDate: "2026-09-06",
      tricks: [
        {
          id: "trick-1",
          trickSlug: "ollie",
          trickName: "Ollie",
          attempts: 30,
          landed: 21,
          successRate: 0.7,
          notes: null,
        },
        {
          id: "trick-2",
          trickSlug: "kickflip",
          trickName: "Kickflip",
          attempts: 5,
          landed: 0,
          successRate: 0,
          notes: "Zu früh aufgesetzt",
        },
      ],
      totalAttempts: 35,
      totalLanded: 21,
      successRate: 0.6,
    });
    server.use(sessionDetailHandler(session));

    renderApp({ initialPath: "/sessions/session-1" });

    expect(await screen.findByText("Ollie")).toBeInTheDocument();
    expect(screen.getByText("21 von 30")).toBeInTheDocument();
    expect(screen.getByText("Kickflip")).toBeInTheDocument();
    expect(screen.getByText("0 von 5")).toBeInTheDocument();
    expect(screen.getByText("Zu früh aufgesetzt")).toBeInTheDocument();
  });

  it("Kriterium 3: shows the no-tricks explanation and a dash for the success rate", async () => {
    const session = buildSessionResponse({
      id: "session-1",
      tricks: [],
      totalAttempts: 0,
      totalLanded: 0,
      successRate: null,
    });
    server.use(sessionDetailHandler(session));

    renderApp({ initialPath: "/sessions/session-1" });

    expect(
      await screen.findByText("In dieser Session hast du keine Tricks erfasst."),
    ).toBeInTheDocument();
    expect(screen.getByText("Erfolgsquote")).toBeInTheDocument();
    expect(screen.getAllByText("–").length).toBeGreaterThanOrEqual(1);
  });

  it("Kriterium 4: shows a dash instead of empty fields for unset weight, exertion, and knee pain", async () => {
    const session = buildSessionResponse({
      id: "session-1",
      weightBeforeKg: null,
      weightAfterKg: null,
      fluidLossKg: null,
      perceivedExertion: null,
      kneePain: null,
    });
    server.use(sessionDetailHandler(session));

    renderApp({ initialPath: "/sessions/session-1" });

    expect(await screen.findByText("Gewicht vorher")).toBeInTheDocument();
    expect(screen.getByText("Gewicht nachher")).toBeInTheDocument();
    expect(screen.getByText("Anstrengung")).toBeInTheDocument();
    expect(screen.getByText("Knieschmerz links")).toBeInTheDocument();
    expect(screen.getAllByText("–").length).toBeGreaterThanOrEqual(4);
  });

  it("Kriterium 5: knee pain 7 shows the value and the pause warning", async () => {
    const session = buildSessionResponse({ id: "session-1", kneePain: 7 });
    server.use(sessionDetailHandler(session));

    renderApp({ initialPath: "/sessions/session-1" });

    expect(await screen.findByText("7 von 10")).toBeInTheDocument();
    expect(screen.getByText("Ab 6 gilt: Pause vor Fortschritt.")).toBeInTheDocument();
  });

  it("Kriterium 6: an unknown ID shows 'not found' with the back link and no role=alert", async () => {
    server.use(sessionDetailNotFoundHandler("missing-id"));

    renderApp({ initialPath: "/sessions/missing-id" });

    const heading = await screen.findByText("Diese Session gibt es nicht mehr.");
    expect(heading).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Zurück zu den Sessions" })).toHaveAttribute(
      "href",
      "/sessions",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("ux.md Ergänzung: the 'not found' heading takes focus itself, so screen readers announce it", async () => {
    server.use(sessionDetailNotFoundHandler("missing-id"));

    renderApp({ initialPath: "/sessions/missing-id" });

    const heading = await screen.findByText("Diese Session gibt es nicht mehr.");
    expect(heading).toHaveAttribute("tabIndex", "-1");
    expect(document.activeElement).toBe(heading);
  });

  it("Kriterium 7: a 500 response shows the error with role=alert, and retry reloads successfully", async () => {
    const user = userEvent.setup();
    server.use(sessionDetailErrorHandler("session-1", 500));

    renderApp({ initialPath: "/sessions/session-1" });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Diese Session konnte nicht geladen werden.");
    const retry = screen.getByRole("button", { name: "Nochmal versuchen" });

    server.use(
      sessionDetailHandler(buildSessionResponse({ id: "session-1", sessionDate: "2026-09-06" })),
    );
    await user.click(retry);

    expect(await screen.findByText(formatSessionDate("2026-09-06"))).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("Kriterium 8: tapping 'Löschen' opens the confirmation with date and location, without any request", async () => {
    const user = userEvent.setup();
    const session = buildSessionResponse({
      id: "session-1",
      sessionDate: "2026-09-06",
      location: "Skatepark Braunschweig",
    });
    // No DELETE handler registered on purpose: MSW's onUnhandledRequest:"error"
    // (src/test/setup.ts) fails this test the instant a DELETE is attempted.
    server.use(sessionDetailHandler(session));

    renderApp({ initialPath: "/sessions/session-1" });

    await user.click(await screen.findByRole("button", { name: "Löschen" }));

    const dialog = await screen.findByRole("dialog", { name: "Session löschen?" });
    expect(dialog).toHaveTextContent(formatSessionDate("2026-09-06"));
    expect(dialog).toHaveTextContent("Skatepark Braunschweig");
    expect(dialog).toHaveTextContent("Das lässt sich nicht zurückholen.");
  });
});
