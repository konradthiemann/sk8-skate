import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import type * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/test/renderApp";
import { StartScreen } from "./StartScreen";

/**
 * T-0105 gives `StartScreen` a `children` slot (design.md Abschnitt 8) so
 * this app can insert `StartSessionSummary` without breaking the byte
 * identity the other two PWAs rely on (`react-frontend.md`). `renderApp()`
 * can't exercise the slot yet – `src/routes/index.tsx` still renders bare
 * `<StartScreen />` – so this one test builds a minimal local router instead
 * (same reasoning as `StartSessionSummary.test.tsx`), passing a stand-in
 * child rather than the real, not-yet-existing `StartSessionSummary`.
 */
function renderWithChild(child: React.ReactNode) {
  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <StartScreen>{child}</StartScreen>,
  });
  const tricksRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/tricks",
    component: () => null,
  });
  const sessionsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/sessions",
    component: () => null,
  });
  const trainingRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/training",
    component: () => null,
  });
  const routeTree = rootRoute.addChildren([indexRoute, tricksRoute, sessionsRoute, trainingRoute]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return render(<RouterProvider router={router} />);
}

describe("StartScreen", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date(2026, 8, 7, 12, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the countdown with date and location", async () => {
    renderApp();

    expect(await screen.findByText("Noch 376 Tage bis zum Contest")).toBeInTheDocument();
    expect(screen.getByText("18. September 2027 · Braunschweig")).toBeInTheDocument();
  });

  it("shows one card per section, linking to its screen", async () => {
    renderApp();

    const cards = within(await screen.findByRole("region", { name: "Bereiche" }));
    expect(cards.getByRole("heading", { name: "Trick-Tree" })).toBeInTheDocument();
    expect(cards.getByRole("heading", { name: "Sessions" })).toBeInTheDocument();
    expect(cards.getByRole("heading", { name: "Training" })).toBeInTheDocument();

    expect(cards.getByRole("link", { name: /Trick-Tree/ })).toHaveAttribute("href", "/tricks");
    expect(cards.getByRole("link", { name: /Sessions/ })).toHaveAttribute("href", "/sessions");
    expect(cards.getByRole("link", { name: /Training/ })).toHaveAttribute("href", "/training");
  });

  it("marks the section cards for interaction telemetry", async () => {
    renderApp();

    const cards = within(await screen.findByRole("region", { name: "Bereiche" }));
    expect(cards.getByRole("link", { name: /Trick-Tree/ })).toHaveAttribute(
      "data-track",
      "start.tricks",
    );
    expect(cards.getByRole("link", { name: /Sessions/ })).toHaveAttribute(
      "data-track",
      "start.sessions",
    );
    expect(cards.getByRole("link", { name: /Training/ })).toHaveAttribute(
      "data-track",
      "start.training",
    );
  });

  it("Kriterium 26: keeps the countdown and section cards visible and usable while the inserted block reports an error", async () => {
    renderWithChild(<div role="alert">Deine Sessions konnten nicht geladen werden.</div>);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Deine Sessions konnten nicht geladen werden.",
    );
    expect(screen.getByText("Noch 376 Tage bis zum Contest")).toBeInTheDocument();
    const cards = within(screen.getByRole("region", { name: "Bereiche" }));
    expect(cards.getByRole("link", { name: /Trick-Tree/ })).toHaveAttribute("href", "/tricks");
    expect(cards.getByRole("link", { name: /Sessions/ })).toHaveAttribute("href", "/sessions");
    expect(cards.getByRole("link", { name: /Training/ })).toHaveAttribute("href", "/training");
  });
});
