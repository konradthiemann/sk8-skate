import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildFullTrickCatalog,
  buildSmallTrickCatalog,
  tricksErrorHandler,
  tricksHandler,
} from "@/features/tricks/test/handlers";
import { API_URL } from "@/test/msw/handlers";
import { server } from "@/test/msw/server";
import { renderApp } from "@/test/renderApp";
import { buildSessionResponse, buildSessionSummary, sessionsListHandler } from "../test/handlers";

/*
 * Renders through the real router (`/sessions/new`), matching every other
 * screen test (see design.md "Screen-Tests nutzen renderApp"). Until
 * `src/routes/sessions/new.tsx` exists and `routeTree.gen.ts` is
 * regenerated, this path is unmatched, so these fail for that reason today.
 */

function jsonBody(request: Request): Promise<unknown> {
  return request.json();
}

describe("SessionCreateScreen", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date(2026, 8, 8, 12, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("Kriterium 7: prefills today's date and a duration of 60", async () => {
    server.use(tricksHandler(buildSmallTrickCatalog()), sessionsListHandler([], 0));
    renderApp({ initialPath: "/sessions/new" });

    expect(await screen.findByLabelText("Datum")).toHaveValue("2026-09-08");
    expect(screen.getByLabelText("Dauer in Minuten")).toHaveValue(60);
  });

  it("Kriterium 8: prefills the location from the most recent session", async () => {
    server.use(
      tricksHandler(buildSmallTrickCatalog()),
      sessionsListHandler([buildSessionSummary({ id: "s1", location: "Skatehalle Hannover" })], 1),
    );
    renderApp({ initialPath: "/sessions/new" });

    expect(await screen.findByLabelText("Ort")).toHaveValue("Skatehalle Hannover");
  });

  it("Kriterium 9: falls back to the default location with no prior session", async () => {
    server.use(tricksHandler(buildSmallTrickCatalog()), sessionsListHandler([], 0));
    renderApp({ initialPath: "/sessions/new" });

    expect(await screen.findByLabelText("Ort")).toHaveValue("Skatepark Braunschweig");
  });

  it("Kriterium 10: groups the catalog into 'Deine Ziele' (goalOrder) and 'Weitere Tricks' (difficulty)", async () => {
    const catalog = buildFullTrickCatalog();
    server.use(tricksHandler(catalog), sessionsListHandler([], 0));
    renderApp({ initialPath: "/sessions/new" });

    const goalsGroup = await screen.findByRole("group", { name: "Deine Ziele" });
    const othersGroup = screen.getByRole("group", { name: "Weitere Tricks" });

    const expectedGoals = catalog
      .filter((t) => t.isGoal)
      .sort((a, b) => (a.goalOrder ?? 0) - (b.goalOrder ?? 0))
      .map((t) => t.name);
    const expectedOthers = catalog
      .filter((t) => !t.isGoal)
      .sort((a, b) => a.difficulty - b.difficulty)
      .map((t) => t.name);

    expect(within(goalsGroup).getAllByRole("button")).toHaveLength(7);
    expect(
      within(goalsGroup)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(expectedGoals);
    expect(within(othersGroup).getAllByRole("button")).toHaveLength(9);
    expect(
      within(othersGroup)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(expectedOthers);
  });

  it("Kriterium 11: shows the catalog error and no form when tricks cannot be loaded", async () => {
    server.use(tricksErrorHandler(500), sessionsListHandler([], 0));
    renderApp({ initialPath: "/sessions/new" });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Der Trick-Katalog konnte nicht geladen werden. Ohne ihn kannst du keine Tricks erfassen.",
    );
    expect(screen.queryByLabelText("Datum")).not.toBeInTheDocument();
  });

  it("Kriterium 24: submitting a valid form with two tricks sends exactly one POST with the camelCase body", async () => {
    const user = userEvent.setup();
    let calls = 0;
    let receivedBody: Record<string, unknown> | undefined;
    server.use(
      tricksHandler(buildSmallTrickCatalog()),
      sessionsListHandler([], 0),
      http.post(`${API_URL}/api/skate-sessions`, async ({ request }) => {
        calls += 1;
        receivedBody = (await jsonBody(request)) as Record<string, unknown>;
        return HttpResponse.json(buildSessionResponse(), { status: 201 });
      }),
    );
    renderApp({ initialPath: "/sessions/new" });

    await user.click(await screen.findByRole("button", { name: "Ollie", pressed: false }));
    await user.click(screen.getByRole("button", { name: "Kickflip", pressed: false }));
    await user.click(screen.getByRole("button", { name: "Session speichern" }));

    await vi.waitFor(() => expect(calls).toBe(1));
    expect(receivedBody?.sessionDate).toBe("2026-09-08");
    expect(receivedBody?.durationMinutes).toBe(60);
    expect(receivedBody?.location).toBe("Skatepark Braunschweig");
    expect(receivedBody?.tricks).toEqual([
      { trickSlug: "ollie", attempts: 10, landed: 0 },
      { trickSlug: "kickflip", attempts: 10, landed: 0 },
    ]);
  });

  it("Kriterium 25: a start time is combined with the chosen session date", async () => {
    const user = userEvent.setup();
    let receivedBody: Record<string, unknown> | undefined;
    server.use(
      tricksHandler(buildSmallTrickCatalog()),
      sessionsListHandler([], 0),
      http.post(`${API_URL}/api/skate-sessions`, async ({ request }) => {
        receivedBody = (await jsonBody(request)) as Record<string, unknown>;
        return HttpResponse.json(buildSessionResponse(), { status: 201 });
      }),
    );
    renderApp({ initialPath: "/sessions/new" });

    // Native date input: jsdom cannot reliably simulate segment-by-segment
    // keyboard typing here, so the value is set directly (ADR-007 exception,
    // documented in tests.md).
    fireEvent.change(await screen.findByLabelText("Datum"), { target: { value: "2026-09-06" } });

    await user.click(screen.getByText("Weitere Angaben"));
    await user.type(screen.getByLabelText("Startzeit"), "16:30");
    await user.click(screen.getByRole("button", { name: "Session speichern" }));

    await vi.waitFor(() => expect(receivedBody).toBeDefined());
    expect(receivedBody?.startedAt).toMatch(/^2026-09-06T16:30/);
  });

  it("Kriterium 26: leaves startedAt, weights, exertion, kneePain and notes as null when unset", async () => {
    let receivedBody: Record<string, unknown> | undefined;
    const user = userEvent.setup();
    server.use(
      tricksHandler(buildSmallTrickCatalog()),
      sessionsListHandler([], 0),
      http.post(`${API_URL}/api/skate-sessions`, async ({ request }) => {
        receivedBody = (await jsonBody(request)) as Record<string, unknown>;
        return HttpResponse.json(buildSessionResponse(), { status: 201 });
      }),
    );
    renderApp({ initialPath: "/sessions/new" });

    await screen.findByLabelText("Datum");
    await user.click(screen.getByRole("button", { name: "Session speichern" }));

    await vi.waitFor(() => expect(receivedBody).toBeDefined());
    expect(receivedBody?.startedAt).toBeNull();
    expect(receivedBody?.weightBeforeKg).toBeNull();
    expect(receivedBody?.weightAfterKg).toBeNull();
    expect(receivedBody?.perceivedExertion).toBeNull();
    expect(receivedBody?.kneePain).toBeNull();
    expect(receivedBody?.notes).toBeNull();
  });

  it("Kriterium 28: a successful save navigates to /sessions and shows the new entry", async () => {
    const user = userEvent.setup();
    let sessions = [buildSessionSummary({ id: "existing", location: "Alter Ort" })];
    server.use(
      tricksHandler(buildSmallTrickCatalog()),
      http.get(`${API_URL}/api/skate-sessions`, () =>
        HttpResponse.json({ items: sessions, total: sessions.length }, { status: 200 }),
      ),
      http.post(`${API_URL}/api/skate-sessions`, async ({ request }) => {
        const body = (await jsonBody(request)) as Record<string, unknown>;
        sessions = [
          buildSessionSummary({ id: "new-session", location: body.location as string }),
          ...sessions,
        ];
        return HttpResponse.json(buildSessionResponse({ id: "new-session" }), { status: 201 });
      }),
    );
    const { router } = renderApp({ initialPath: "/sessions/new" });

    const location = await screen.findByLabelText("Ort");
    await user.clear(location);
    await user.type(location, "Neuer Contest-Spot");
    await user.click(screen.getByRole("button", { name: "Session speichern" }));

    await vi.waitFor(() => expect(router.state.location.pathname).toBe("/sessions"));
    expect(await screen.findByText("Neuer Contest-Spot")).toBeInTheDocument();
  });

  it("Kriterium 32: cancelling navigates to /sessions without sending a request", async () => {
    const user = userEvent.setup();
    let calls = 0;
    server.use(
      tricksHandler(buildSmallTrickCatalog()),
      sessionsListHandler([], 0),
      http.post(`${API_URL}/api/skate-sessions`, () => {
        calls += 1;
        return HttpResponse.json(buildSessionResponse(), { status: 201 });
      }),
    );
    const { router } = renderApp({ initialPath: "/sessions/new" });

    await screen.findByLabelText("Datum");
    await user.click(screen.getByRole("button", { name: "Abbrechen" }));

    await vi.waitFor(() => expect(router.state.location.pathname).toBe("/sessions"));
    expect(calls).toBe(0);
  });
});
