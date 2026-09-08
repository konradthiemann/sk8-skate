import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/test/renderApp";

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
});
