import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildSessionSummary } from "../test/handlers";
import { SessionListItem } from "./SessionListItem";

/*
 * `SessionListItem` becomes a `Link` in T-0105 (it was a plain, non-clickable
 * `Card` in T-0104). Rendered under a minimal local router, same reasoning
 * as `StartSessionSummary.test.tsx`: the component needs a router context
 * for its internal `Link`, without pulling in the full app routeTree.
 *
 * Kriterium 1.
 */

function renderItem(session: ReturnType<typeof buildSessionSummary>) {
  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <SessionListItem session={session} />,
  });
  const sessionDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/sessions/$sessionId",
    component: () => null,
  });
  const routeTree = rootRoute.addChildren([indexRoute, sessionDetailRoute]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return render(<RouterProvider router={router} />);
}

describe("SessionListItem", () => {
  it("Kriterium 1: is a link to its detail view and carries the open-tracking marker", async () => {
    const session = buildSessionSummary({
      id: "session-42",
      sessionDate: "2026-09-06",
      location: "Skatepark Braunschweig",
    });

    renderItem(session);

    const link = await screen.findByRole("link");
    expect(link).toHaveAttribute("href", "/sessions/session-42");
    expect(link).toHaveAttribute("data-track", "session.open");
    expect(link).toHaveTextContent("Skatepark Braunschweig");
  });
});
