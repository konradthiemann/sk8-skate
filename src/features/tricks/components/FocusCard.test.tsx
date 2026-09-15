import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildTrickRecommendationFixture, trickSuggestion } from "../test/handlers";
import { FocusCard } from "./FocusCard";

/*
 * Props-only test, no MSW, no QueryClientProvider (design.md §5.4: the
 * `useQuery` for the recommendation lives one level up in `TrickTreeScreen`,
 * `FocusCard` only renders what it is given):
 *
 *   interface FocusCardProps {
 *     recommendation: TrickRecommendationResponse | undefined;
 *     isLoading: boolean;
 *     isError: boolean;
 *     onRetry: () => void;
 *   }
 *
 * Also no `<RouterProvider>`: this follows `TrickTreeGraph.test.tsx`'s
 * contract (explicitly named as the style template for this file, design.md
 * §5.4/tests.md), whose `TrickNode` deliberately renders a plain `<a href>`
 * instead of TanStack Router's `<Link>` so it can be rendered standalone in a
 * test. `FocusCard`'s trick links must follow the same rule - a `<Link>` here
 * would throw "useRouter must be used inside a <RouterProvider>".
 *
 * Kriterien 8, 9, 11 (Ticket-Testtabelle).
 */

describe("FocusCard", () => {
  it("Kriterium 8: shows the primary trick's name, reason, dosage, and the secondary suggestions", () => {
    const recommendation = buildTrickRecommendationFixture({
      primary: trickSuggestion({
        slug: "50-50",
        name: "50-50",
        reason: "Sitzt schon bei Ollie, Absprunghöhe stimmt.",
        dosage: { attemptsMin: 15, attemptsMax: 30, minutesMin: 10, minutesMax: 20 },
      }),
      secondary: [
        trickSuggestion({ slug: "boardslide", name: "Boardslide" }),
        trickSuggestion({ slug: "pop-shove-it", name: "Pop Shove-it" }),
      ],
    });

    render(
      <FocusCard
        recommendation={recommendation}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("Das übst du als Nächstes")).toBeInTheDocument();

    const primaryLink = screen.getByRole("link", { name: /50-50/ });
    expect(primaryLink).toHaveAttribute("href", "/tricks/50-50");
    expect(primaryLink).toHaveAttribute("data-track", "tricks.focus-open");
    expect(screen.getByText("Sitzt schon bei Ollie, Absprunghöhe stimmt.")).toBeInTheDocument();
    expect(screen.getByText("15–30 Versuche · 10–20 Minuten")).toBeInTheDocument();

    expect(screen.getByText("Danach dran:")).toBeInTheDocument();
    const secondaryLink = screen.getByRole("link", { name: /Boardslide/ });
    expect(secondaryLink).toHaveAttribute("href", "/tricks/boardslide");
    expect(secondaryLink).toHaveAttribute("data-track", "tricks.focus-secondary-open");
    expect(screen.getByRole("link", { name: /Pop Shove-it/ })).toBeInTheDocument();
  });

  it("Kriterium 9: shows the empty hint and no link or dosage when primary is null", () => {
    const recommendation = buildTrickRecommendationFixture({ primary: null, secondary: [] });

    render(
      <FocusCard
        recommendation={recommendation}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Gerade ist kein Trick offen. Schau in den Baum, was noch gesperrt ist."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText("Danach dran:")).not.toBeInTheDocument();
  });

  it("Kriterium 11: shows the knee-pain hint as a role=alert warning above the recommendation", () => {
    const recommendation = buildTrickRecommendationFixture({
      pauseHint: {
        code: "knee_pain",
        message: "Knie zwickt seit 2 Einheiten. Heute Pause vom Grinden.",
      },
    });

    const { container } = render(
      <FocusCard
        recommendation={recommendation}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Knie zwickt seit 2 Einheiten. Heute Pause vom Grinden.");
    // "über der Empfehlung" (Ticket) - die Warnung muss im DOM vor der Überschrift stehen.
    const text = container.textContent ?? "";
    const alertPosition = text.indexOf("Knie zwickt seit 2 Einheiten");
    const headingPosition = text.indexOf("Das übst du als Nächstes");
    expect(alertPosition).toBeGreaterThanOrEqual(0);
    expect(headingPosition).toBeGreaterThan(alertPosition);
  });

  it("shows a card-height skeleton while loading, without any recommendation content", () => {
    const { container } = render(
      <FocusCard recommendation={undefined} isLoading={true} isError={false} onRetry={vi.fn()} />,
    );

    expect(container.querySelector(".animate-pulse")).not.toBeNull();
    expect(screen.queryByText("Das übst du als Nächstes")).not.toBeInTheDocument();
  });

  it("shows the error text without a retry button when the recommendation fails to load", () => {
    render(
      <FocusCard recommendation={undefined} isLoading={false} isError={true} onRetry={vi.fn()} />,
    );

    // ux.md §3.3: bewusst KEIN "Erneut versuchen"-Button hier (Retry kommt mit
    // dem nächsten Öffnen von `/tricks` zurück) - `onRetry` existiert laut
    // design.md §5.4 als Prop, wird für diesen Zustand aber nicht an ein
    // sichtbares Element gebunden.
    expect(screen.getByText("Die Empfehlung lädt gerade nicht.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
