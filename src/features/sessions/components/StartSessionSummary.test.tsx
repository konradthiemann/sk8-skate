import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API_URL, TEST_API_KEY } from "@/test/msw/handlers";
import { server } from "@/test/msw/server";
import { buildSessionSummary, type SessionSummaryFixture } from "../test/handlers";
import { StartSessionSummary } from "./StartSessionSummary";

/*
 * `StartSessionSummary` cannot be reached through `renderApp()` yet: T-0105
 * deliberately keeps `src/routes/index.tsx`'s production change (wiring this
 * component into `StartScreen`'s new `children` slot) out of this test-only
 * pass. Instead this file gives the component its own minimal router –
 * enough for its internal `Link`s to resolve `href`s – without touching
 * `src/test/renderApp.tsx` or the generated `routeTree.gen.ts`.
 *
 * Kriterien 20, 21, 24, 25, 26.
 */

function renderSummary() {
  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: StartSessionSummary,
  });
  const sessionDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/sessions/$sessionId",
    component: () => null,
  });
  const sessionNewRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/sessions/new",
    component: () => null,
  });
  const routeTree = rootRoute.addChildren([indexRoute, sessionDetailRoute, sessionNewRoute]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

/**
 * Both queries `StartSessionSummary` fires (`sessionKeys.list({limit:1})` for
 * "Letzte Session", `sessionKeys.list({from,to,limit:20})` for "Diese
 * Woche") hit the same `/api/skate-sessions` endpoint, distinguished only by
 * the `limit` query parameter (design.md Abschnitt 2).
 */
function sessionEndpointsHandler(last: SessionSummaryFixture[], week: SessionSummaryFixture[]) {
  return http.get(`${API_URL}/api/skate-sessions`, ({ request }) => {
    if (request.headers.get("x-api-key") !== TEST_API_KEY) {
      return HttpResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const limit = new URL(request.url).searchParams.get("limit");
    if (limit === "1") {
      return HttpResponse.json({ items: last, total: last.length }, { status: 200 });
    }
    return HttpResponse.json({ items: week, total: week.length }, { status: 200 });
  });
}

function sessionEndpointsErrorHandler(status = 500) {
  return http.get(`${API_URL}/api/skate-sessions`, () =>
    HttpResponse.json({ error: "internal_error" }, { status }),
  );
}

describe("StartSessionSummary", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date(2026, 8, 8, 12, 0)); // Tuesday, 2026-09-08
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("Kriterium 20: shows the last session's date, location, duration, and success rate as a link to its detail view", async () => {
    const last = [
      buildSessionSummary({
        id: "session-1",
        sessionDate: "2026-09-06",
        location: "Skatepark Braunschweig",
        durationMinutes: 90,
        successRate: 0.7,
      }),
    ];
    server.use(sessionEndpointsHandler(last, last));

    renderSummary();

    const link = await screen.findByRole("link", { name: /Skatepark Braunschweig/ });
    expect(link).toHaveAttribute("href", "/sessions/session-1");
    expect(link).toHaveTextContent("70 %");
  });

  it("Kriterium 21: shows the empty state with a capture button linking to /sessions/new when there are no sessions at all", async () => {
    server.use(sessionEndpointsHandler([], []));

    renderSummary();

    expect(
      await screen.findByText("Noch keine Session erfasst. Log deine erste Einheit."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Session erfassen" })).toHaveAttribute(
      "href",
      "/sessions/new",
    );
  });

  it("Kriterium 24: omits the rate part of the week summary when no session of the week has any trick", async () => {
    const week = [
      buildSessionSummary({
        id: "mon",
        sessionDate: "2026-09-07",
        durationMinutes: 60,
        trickCount: 0,
        totalAttempts: 0,
        totalLanded: 0,
        successRate: null,
      }),
    ];
    server.use(sessionEndpointsHandler([], week));

    renderSummary();

    await screen.findByText("Diese Woche");
    expect(screen.queryByText(/getroffen/)).not.toBeInTheDocument();
    expect(screen.queryByText(/0 %/)).not.toBeInTheDocument();
  });

  it("Kriterium 25: shows the week-empty text and no bars when there is no session this week", async () => {
    server.use(sessionEndpointsHandler([], []));

    renderSummary();

    expect(
      await screen.findByText("Diese Woche noch keine Session. Zeit für die erste."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("Kriterium 26: shows the error state with role=alert when the session queries fail", async () => {
    server.use(sessionEndpointsErrorHandler(500));

    renderSummary();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Deine Sessions konnten nicht geladen werden.");
  });

  it("ux.md Ergänzung: the seven week bars form one accessible list, Monday through Sunday", async () => {
    const week = [
      buildSessionSummary({ id: "mon", sessionDate: "2026-09-07", durationMinutes: 95 }),
      buildSessionSummary({ id: "tue", sessionDate: "2026-09-08", durationMinutes: 60 }),
    ];
    server.use(sessionEndpointsHandler([], week));

    renderSummary();

    const list = await screen.findByRole("list", { name: "Diese Woche, Montag bis Sonntag" });
    expect(list).toHaveAccessibleName("Diese Woche, Montag bis Sonntag");
    expect(screen.getByRole("listitem", { name: "Montag: 1 h 35 min" })).toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: "Dienstag: 1 h" })).toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: "Mittwoch: keine Session" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(7);
  });
});
