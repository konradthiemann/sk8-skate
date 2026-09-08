import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/test/renderApp";

describe("app shell", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date(2026, 8, 7, 12, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the app name and the contest countdown in the header", async () => {
    renderApp();

    const header = await screen.findByRole("banner");
    expect(within(header).getByRole("link", { name: "SK8 Skate" })).toHaveAttribute("href", "/");
    expect(within(header).getByText("Noch 376 Tage")).toBeInTheDocument();
  });

  it("offers a bottom navigation with all sections", async () => {
    renderApp();

    const nav = await screen.findByRole("navigation", { name: "Hauptnavigation" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Start",
      "Tricks",
      "Sessions",
      "Training",
    ]);
    expect(within(nav).getByRole("link", { name: "Start" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("navigates via the bottom navigation and records the screen change", async () => {
    const user = userEvent.setup();
    const { flushedEvents, telemetry } = renderApp();
    await screen.findByRole("heading", { name: "Trick-Tree" });

    const nav = screen.getByRole("navigation", { name: "Hauptnavigation" });
    await user.click(within(nav).getByRole("link", { name: "Sessions" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Sessions" })).toBeInTheDocument();
    expect(telemetry.currentScreen).toBe("/sessions");

    const events = await flushedEvents();
    expect(events.map((event) => event.type)).toEqual([
      "screen_view",
      "navigation",
      "time_on_screen",
      "screen_view",
    ]);
    expect(events[0]).toMatchObject({ screen: "/", meta: { from: null } });
    expect(events[1]).toMatchObject({
      screen: "/",
      target: "/sessions",
      meta: { from: "/", to: "/sessions", via: "bottom-nav" },
    });
    expect(events[2]).toMatchObject({ screen: "/", meta: { ms: expect.any(Number) } });
    expect(events[3]).toMatchObject({ screen: "/sessions", meta: { from: "/" } });
  });

  it("renders a German not-found screen for unknown paths", async () => {
    renderApp({ initialPath: "/gibt-es-nicht" });

    expect(
      await screen.findByRole("heading", { name: "Seite nicht gefunden" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Zur Startseite" })).toHaveAttribute("href", "/");
  });
});
