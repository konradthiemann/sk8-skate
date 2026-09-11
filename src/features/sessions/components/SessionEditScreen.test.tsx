import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import type { TrickFixture } from "@/features/tricks/test/handlers";
import { tricksHandler } from "@/features/tricks/test/handlers";
import { API_URL } from "@/test/msw/handlers";
import { server } from "@/test/msw/server";
import { renderApp } from "@/test/renderApp";
import { formatSessionDate } from "../format";
import {
  buildSessionResponse,
  sessionDetailHandler,
  sessionDetailNotFoundHandler,
  updateSessionValidationErrorHandler,
} from "../test/handlers";

/*
 * Renders through the real router (`/sessions/:id/edit`). The route does not
 * exist yet, so every test here fails on that missing route today – same
 * reasoning as `SessionListScreen.test.tsx` documented for T-0104.
 *
 * Kriterien 12-19. `ollie`/`kickflip` alone (T-0104's `buildSmallTrickCatalog`)
 * are not enough for Kriterium 14 (needs `manual` too), hence a local catalog.
 */

function buildEditTrickCatalog(): TrickFixture[] {
  return [
    {
      id: "ollie",
      slug: "ollie",
      name: "Ollie",
      category: "flatground",
      difficulty: 1,
      description: null,
      isGoal: true,
      goalOrder: 1,
      prerequisiteSlugs: [],
    },
    {
      id: "manual",
      slug: "manual",
      name: "Manual",
      category: "flatground",
      difficulty: 2,
      description: null,
      isGoal: false,
      goalOrder: null,
      prerequisiteSlugs: [],
    },
    {
      id: "kickflip",
      slug: "kickflip",
      name: "Kickflip",
      category: "flatground",
      difficulty: 3,
      description: null,
      isGoal: true,
      goalOrder: 2,
      prerequisiteSlugs: [],
    },
  ];
}

function buildFullSession() {
  return buildSessionResponse({
    id: "session-1",
    sessionDate: "2026-09-06",
    startedAt: "2026-09-06T14:30:00+00:00",
    durationMinutes: 90,
    location: "Skatepark Braunschweig",
    weightBeforeKg: 78.4,
    weightAfterKg: 77.6,
    fluidLossKg: 0.8,
    perceivedExertion: 7,
    kneePain: 3,
    notes: "Testnotiz",
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
        trickSlug: "manual",
        trickName: "Manual",
        attempts: 5,
        landed: 0,
        successRate: 0,
        notes: null,
      },
    ],
    totalAttempts: 35,
    totalLanded: 21,
    successRate: 0.6,
  });
}

function bareSession() {
  return buildSessionResponse({
    id: "session-1",
    sessionDate: "2026-09-06",
    startedAt: null,
    durationMinutes: 60,
    location: "Skatepark Braunschweig",
    weightBeforeKg: null,
    weightAfterKg: null,
    fluidLossKg: null,
    perceivedExertion: null,
    kneePain: null,
    notes: null,
    tricks: [],
    totalAttempts: 0,
    totalLanded: 0,
    successRate: null,
  });
}

describe("SessionEditScreen", () => {
  it("Kriterium 12: prefills every field from the session and starts 'Weitere Angaben' open", async () => {
    server.use(sessionDetailHandler(buildFullSession()), tricksHandler(buildEditTrickCatalog()));

    renderApp({ initialPath: "/sessions/session-1/edit" });

    expect(await screen.findByLabelText("Datum")).toHaveValue("2026-09-06");
    expect(screen.getByLabelText("Dauer in Minuten")).toHaveValue(90);
    expect(screen.getByLabelText("Ort")).toHaveValue("Skatepark Braunschweig");

    expect(screen.getByRole("button", { name: "Ollie", pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Versuche für Ollie" })).toHaveValue(30);
    expect(screen.getByRole("spinbutton", { name: "Treffer für Ollie" })).toHaveValue(21);
    expect(screen.getByRole("button", { name: "Manual", pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Versuche für Manual" })).toHaveValue(5);
    expect(screen.getByRole("spinbutton", { name: "Treffer für Manual" })).toHaveValue(0);

    expect(screen.getByLabelText("Startzeit")).toHaveValue("14:30");
    expect(screen.getByLabelText("Gewicht vorher in kg")).toHaveValue(78.4);
    expect(screen.getByLabelText("Gewicht nachher in kg")).toHaveValue(77.6);
    expect(
      within(screen.getByRole("radiogroup", { name: "Anstrengung" })).getByRole("radio", {
        name: "7",
      }),
    ).toBeChecked();
    expect(
      within(screen.getByRole("radiogroup", { name: "Knieschmerz links" })).getByRole("radio", {
        name: "3",
      }),
    ).toBeChecked();
    expect(screen.getByLabelText("Notiz")).toHaveValue("Testnotiz");

    const details = document.querySelector("details");
    expect(details?.open).toBe(true);
  });

  it("Kriterium 13: 'Weitere Angaben' stays collapsed when none of its fields are set", async () => {
    server.use(sessionDetailHandler(bareSession()), tricksHandler(buildEditTrickCatalog()));

    renderApp({ initialPath: "/sessions/session-1/edit" });

    await screen.findByLabelText("Datum");
    const details = document.querySelector("details");
    expect(details?.open).toBe(false);
  });

  it("Kriterium 14: deselecting 'manual' and selecting 'kickflip' sends exactly ollie and kickflip in the PUT body", async () => {
    const user = userEvent.setup();
    let capturedBody: { tricks?: { trickSlug: string }[] } | undefined;
    server.use(
      sessionDetailHandler(buildFullSession()),
      tricksHandler(buildEditTrickCatalog()),
      http.put(`${API_URL}/api/skate-sessions/session-1`, async ({ request }) => {
        capturedBody = (await request.json()) as typeof capturedBody;
        return HttpResponse.json(buildFullSession(), { status: 200 });
      }),
    );
    renderApp({ initialPath: "/sessions/session-1/edit" });
    await screen.findByLabelText("Datum");

    await user.click(screen.getByRole("button", { name: "Manual", pressed: true }));
    await user.click(screen.getByRole("button", { name: "Kickflip", pressed: false }));
    await user.click(screen.getByRole("button", { name: "Änderungen speichern" }));

    expect(await screen.findByText(formatSessionDate("2026-09-06"))).toBeInTheDocument();
    expect(capturedBody).toBeDefined();
    const slugs = (capturedBody?.tricks ?? []).map((trick) => trick.trickSlug).sort();
    expect(slugs).toEqual(["kickflip", "ollie"]);
  });

  it("Kriterium 15: a successful save navigates back to the detail view with the changed values", async () => {
    const user = userEvent.setup();
    const original = buildFullSession();
    const updated = { ...original, location: "Skatehalle Hannover" };
    server.use(
      sessionDetailHandler(original),
      tricksHandler(buildEditTrickCatalog()),
      http.put(`${API_URL}/api/skate-sessions/session-1`, async ({ request }) => {
        await request.json();
        server.use(sessionDetailHandler(updated));
        return HttpResponse.json(updated, { status: 200 });
      }),
    );
    renderApp({ initialPath: "/sessions/session-1/edit" });

    const location = await screen.findByLabelText("Ort");
    await user.clear(location);
    await user.type(location, "Skatehalle Hannover");
    await user.click(screen.getByRole("button", { name: "Änderungen speichern" }));

    expect(await screen.findByText("Skatehalle Hannover")).toBeInTheDocument();
    expect(screen.queryByLabelText("Ort")).not.toBeInTheDocument();
  });

  it("Kriterium 16: a 422 on 'durationMinutes' shows the server message under that field, staying on the form", async () => {
    const user = userEvent.setup();
    server.use(
      sessionDetailHandler(buildFullSession()),
      tricksHandler(buildEditTrickCatalog()),
      updateSessionValidationErrorHandler("session-1", [
        { field: "durationMinutes", message: "Die Dauer wurde vom Server abgelehnt." },
      ]),
    );
    renderApp({ initialPath: "/sessions/session-1/edit" });

    await screen.findByLabelText("Datum");
    await user.click(screen.getByRole("button", { name: "Änderungen speichern" }));

    const message = await screen.findByText("Die Dauer wurde vom Server abgelehnt.");
    expect(message.closest('[role="alert"]')).not.toBeNull();
    expect(screen.getByLabelText("Dauer in Minuten")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Datum")).toBeInTheDocument();
  });

  it("Kriterium 17: 'Abbrechen' returns to the detail view without sending any request", async () => {
    const user = userEvent.setup();
    // No PUT handler registered: an accidental save request fails the test
    // via MSW's onUnhandledRequest:"error".
    server.use(sessionDetailHandler(buildFullSession()), tricksHandler(buildEditTrickCatalog()));
    renderApp({ initialPath: "/sessions/session-1/edit" });

    await screen.findByLabelText("Datum");
    await user.click(screen.getByRole("button", { name: "Abbrechen" }));

    expect(await screen.findByText(formatSessionDate("2026-09-06"))).toBeInTheDocument();
    expect(screen.queryByLabelText("Datum")).not.toBeInTheDocument();
  });

  it("Kriterium 18: an unknown ID shows 'not found' and no form", async () => {
    server.use(sessionDetailNotFoundHandler("missing-id"), tricksHandler(buildEditTrickCatalog()));

    renderApp({ initialPath: "/sessions/missing-id/edit" });

    expect(await screen.findByText("Diese Session gibt es nicht mehr.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Datum")).not.toBeInTheDocument();
  });

  it("Kriterium 19: clearing 'Gewicht nachher' sends weightAfterKg: null, and the detail view shows a dash for fluid loss", async () => {
    const user = userEvent.setup();
    const original = buildFullSession();
    const updated = { ...original, weightAfterKg: null, fluidLossKg: null };
    let capturedBody: { weightAfterKg?: number | null } | undefined;
    server.use(
      sessionDetailHandler(original),
      tricksHandler(buildEditTrickCatalog()),
      http.put(`${API_URL}/api/skate-sessions/session-1`, async ({ request }) => {
        capturedBody = (await request.json()) as typeof capturedBody;
        server.use(sessionDetailHandler(updated));
        return HttpResponse.json(updated, { status: 200 });
      }),
    );
    renderApp({ initialPath: "/sessions/session-1/edit" });

    const weightAfter = await screen.findByLabelText("Gewicht nachher in kg");
    await user.clear(weightAfter);
    await user.click(screen.getByRole("button", { name: "Änderungen speichern" }));

    expect(await screen.findByText("Flüssigkeitsverlust")).toBeInTheDocument();
    expect(capturedBody?.weightAfterKg).toBeNull();
    expect(screen.getAllByText("–").length).toBeGreaterThanOrEqual(1);
  });
});
