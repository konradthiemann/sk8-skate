import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { buildSmallTrickCatalog, tricksHandler } from "@/features/tricks/test/handlers";
import { API_URL } from "@/test/msw/handlers";
import { server } from "@/test/msw/server";
import { renderApp } from "@/test/renderApp";
import {
  buildSessionResponse,
  buildSessionSummary,
  sessionDetailHandler,
  sessionsListErrorHandler,
  sessionsListHandler,
} from "../test/handlers";

/**
 * Kriterium 33: every element in the "Telemetrie" table of the ticket carries
 * exactly its documented `data-track` value, and the delegated click/submit
 * listener (see `src/lib/telemetry/client.ts`) actually turns a tap into an
 * `interaction` event for at least the primary actions of each screen.
 */
describe("telemetry markers", () => {
  it("session.new: the list's capture button is marked and produces an interaction event", async () => {
    server.use(sessionsListHandler([], 0));
    const { flushedEvents } = renderApp({ initialPath: "/sessions" });
    const user = userEvent.setup();

    const button = await screen.findByRole("link", { name: "Session erfassen" });
    expect(button).toHaveAttribute("data-track", "session.new");

    await user.click(button);

    const events = await flushedEvents();
    expect(events).toContainEqual(
      expect.objectContaining({ type: "interaction", target: "session.new" }),
    );
  });

  it("sessions.retry: the list's retry button is marked", async () => {
    server.use(sessionsListErrorHandler(500));
    renderApp({ initialPath: "/sessions" });

    const retry = await screen.findByRole("button", { name: "Nochmal versuchen" });
    expect(retry).toHaveAttribute("data-track", "sessions.retry");
  });

  it("sessions.load-more: the list's load-more button is marked and produces an interaction event", async () => {
    server.use(
      http.get(`${API_URL}/api/skate-sessions`, ({ request }) => {
        const limit = Number(new URL(request.url).searchParams.get("limit") ?? "50");
        const items = Array.from({ length: Math.min(limit, 60) }, (_, i) =>
          buildSessionSummary({ id: `s-${i}`, sessionDate: "2026-09-01" }),
        );
        return HttpResponse.json({ items, total: 60 }, { status: 200 });
      }),
    );
    const { flushedEvents } = renderApp({ initialPath: "/sessions" });
    const user = userEvent.setup();

    const loadMore = await screen.findByRole("button", { name: "Mehr laden" });
    expect(loadMore).toHaveAttribute("data-track", "sessions.load-more");

    await user.click(loadMore);

    const events = await flushedEvents();
    expect(events).toContainEqual(
      expect.objectContaining({ type: "interaction", target: "sessions.load-more" }),
    );
  });

  it("session.create: the create form is marked and produces an interaction event on submit", async () => {
    server.use(
      tricksHandler(buildSmallTrickCatalog()),
      sessionsListHandler([], 0),
      http.post(`${API_URL}/api/skate-sessions`, () =>
        HttpResponse.json(buildSessionResponse(), { status: 201 }),
      ),
    );
    const { flushedEvents } = renderApp({ initialPath: "/sessions/new" });
    const user = userEvent.setup();

    await screen.findByLabelText("Datum");
    const form = document.querySelector('form[data-track="session.create"]');
    expect(form).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Session speichern" }));

    const events = await flushedEvents();
    expect(events).toContainEqual(
      expect.objectContaining({ type: "interaction", target: "session.create" }),
    );
  });

  it("session.cancel: the cancel action is marked", async () => {
    server.use(tricksHandler(buildSmallTrickCatalog()), sessionsListHandler([], 0));
    renderApp({ initialPath: "/sessions/new" });

    const cancel = await screen.findByRole("button", { name: "Abbrechen" });
    expect(cancel).toHaveAttribute("data-track", "session.cancel");
  });

  it("session.duration-preset: all five quick-select buttons are marked", async () => {
    server.use(tricksHandler(buildSmallTrickCatalog()), sessionsListHandler([], 0));
    renderApp({ initialPath: "/sessions/new" });

    await screen.findByLabelText("Datum");
    for (const value of ["30", "45", "60", "90", "120"]) {
      expect(screen.getByRole("button", { name: value })).toHaveAttribute(
        "data-track",
        "session.duration-preset",
      );
    }
  });

  it("session.details-toggle: the 'Weitere Angaben' summary is marked", async () => {
    server.use(tricksHandler(buildSmallTrickCatalog()), sessionsListHandler([], 0));
    renderApp({ initialPath: "/sessions/new" });

    const summary = await screen.findByText("Weitere Angaben");
    expect(summary.closest("summary")).toHaveAttribute("data-track", "session.details-toggle");
  });

  it("session.trick-add / session.trick-remove: tile tap in both directions is marked and fires events", async () => {
    server.use(tricksHandler(buildSmallTrickCatalog()), sessionsListHandler([], 0));
    const { flushedEvents } = renderApp({ initialPath: "/sessions/new" });
    const user = userEvent.setup();

    const tile = await screen.findByRole("button", { name: "Ollie", pressed: false });
    expect(tile).toHaveAttribute("data-track", "session.trick-add");

    await user.click(tile);

    const pressedTile = screen.getByRole("button", { name: "Ollie", pressed: true });
    expect(pressedTile).toHaveAttribute("data-track", "session.trick-remove");

    const removeButton = screen.getByRole("button", { name: "Ollie entfernen" });
    expect(removeButton).toHaveAttribute("data-track", "session.trick-remove");

    await user.click(pressedTile);

    const events = await flushedEvents();
    expect(events).toContainEqual(
      expect.objectContaining({ type: "interaction", target: "session.trick-add" }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({ type: "interaction", target: "session.trick-remove" }),
    );
  });

  it("counter buttons carry their four distinct data-track values", async () => {
    server.use(tricksHandler(buildSmallTrickCatalog()), sessionsListHandler([], 0));
    renderApp({ initialPath: "/sessions/new" });
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Ollie", pressed: false }));

    expect(screen.getByRole("button", { name: "Versuche für Ollie: Eins mehr" })).toHaveAttribute(
      "data-track",
      "session.attempts-plus",
    );
    expect(
      screen.getByRole("button", { name: "Versuche für Ollie: Eins weniger" }),
    ).toHaveAttribute("data-track", "session.attempts-minus");
    expect(screen.getByRole("button", { name: "Treffer für Ollie: Eins mehr" })).toHaveAttribute(
      "data-track",
      "session.landed-plus",
    );
    expect(screen.getByRole("button", { name: "Treffer für Ollie: Eins weniger" })).toHaveAttribute(
      "data-track",
      "session.landed-minus",
    );
  });

  /*
   * T-0105 additions: the ten new `data-track` values from the ticket's
   * "Telemetrie" table (Kriterium 27).
   */

  it("session.open: a list row is marked and produces an interaction event", async () => {
    server.use(sessionsListHandler([buildSessionSummary({ id: "session-1" })], 1));
    const { flushedEvents } = renderApp({ initialPath: "/sessions" });
    const user = userEvent.setup();

    const link = await screen.findByRole("link", { name: /Skatepark Braunschweig/ });
    expect(link).toHaveAttribute("data-track", "session.open");

    await user.click(link);

    const events = await flushedEvents();
    expect(events).toContainEqual(
      expect.objectContaining({ type: "interaction", target: "session.open" }),
    );
  });

  it("session.back: the detail view's back link is marked", async () => {
    server.use(sessionDetailHandler(buildSessionResponse({ id: "session-1" })));
    renderApp({ initialPath: "/sessions/session-1" });

    const back = await screen.findByRole("link", { name: "Zurück zu den Sessions" });
    expect(back).toHaveAttribute("data-track", "session.back");
  });

  it("session.edit: the detail view's 'Bearbeiten' action is marked", async () => {
    server.use(sessionDetailHandler(buildSessionResponse({ id: "session-1" })));
    renderApp({ initialPath: "/sessions/session-1" });

    const edit = await screen.findByRole("link", { name: "Bearbeiten" });
    expect(edit).toHaveAttribute("data-track", "session.edit");
  });

  it("session.delete-open: the detail view's 'Löschen' action is marked and produces an interaction event", async () => {
    server.use(sessionDetailHandler(buildSessionResponse({ id: "session-1" })));
    const { flushedEvents } = renderApp({ initialPath: "/sessions/session-1" });
    const user = userEvent.setup();

    const deleteButton = await screen.findByRole("button", { name: "Löschen" });
    expect(deleteButton).toHaveAttribute("data-track", "session.delete-open");

    await user.click(deleteButton);

    const events = await flushedEvents();
    expect(events).toContainEqual(
      expect.objectContaining({ type: "interaction", target: "session.delete-open" }),
    );
  });

  it("session.delete / session.delete-cancel: both confirmation dialog actions are marked", async () => {
    server.use(sessionDetailHandler(buildSessionResponse({ id: "session-1" })));
    renderApp({ initialPath: "/sessions/session-1" });
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Löschen" }));

    expect(screen.getByRole("button", { name: "Endgültig löschen" })).toHaveAttribute(
      "data-track",
      "session.delete",
    );
    expect(screen.getByRole("button", { name: "Abbrechen" })).toHaveAttribute(
      "data-track",
      "session.delete-cancel",
    );
  });

  it("session.update: the edit form is marked", async () => {
    server.use(
      sessionDetailHandler(buildSessionResponse({ id: "session-1" })),
      tricksHandler(buildSmallTrickCatalog()),
    );
    renderApp({ initialPath: "/sessions/session-1/edit" });

    await screen.findByLabelText("Datum");
    const form = document.querySelector('form[data-track="session.update"]');
    expect(form).not.toBeNull();
  });

  it("session.update-cancel: the edit form's 'Abbrechen' action is marked", async () => {
    server.use(
      sessionDetailHandler(buildSessionResponse({ id: "session-1" })),
      tricksHandler(buildSmallTrickCatalog()),
    );
    renderApp({ initialPath: "/sessions/session-1/edit" });

    const cancel = await screen.findByRole("button", { name: "Abbrechen" });
    expect(cancel).toHaveAttribute("data-track", "session.update-cancel");
  });

  it("start.last-session: the start page's last-session card link is marked", async () => {
    server.use(sessionsListHandler([buildSessionSummary({ id: "session-1" })], 1));
    renderApp({ initialPath: "/" });

    const link = await screen.findByRole("link", { name: /Skatepark Braunschweig/ });
    expect(link).toHaveAttribute("data-track", "start.last-session");
  });

  it("start.session-new: the start page's empty-state capture button is marked", async () => {
    server.use(sessionsListHandler([], 0));
    renderApp({ initialPath: "/" });

    const button = await screen.findByRole("link", { name: "Session erfassen" });
    expect(button).toHaveAttribute("data-track", "start.session-new");
  });
});
