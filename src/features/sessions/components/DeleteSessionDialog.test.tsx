import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { API_URL } from "@/test/msw/handlers";
import { server } from "@/test/msw/server";
import { renderApp } from "@/test/renderApp";
import {
  buildSessionResponse,
  deleteSessionServerErrorHandler,
  sessionDetailHandler,
  sessionsListHandler,
} from "../test/handlers";

/*
 * `DeleteSessionDialog` is exercised through `SessionDetailScreen` (its only
 * mount point, per design.md), reached via the real router just like every
 * other screen test. Kriterien 9-11.
 */

async function openDialog() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Löschen" }));
  await screen.findByRole("dialog", { name: "Session löschen?" });
  return user;
}

describe("DeleteSessionDialog", () => {
  it("Kriterium 9: 'Abbrechen' closes the dialog without sending any request", async () => {
    const session = buildSessionResponse({ id: "session-1" });
    // No DELETE handler: an accidental request fails the test via
    // MSW's onUnhandledRequest:"error" (src/test/setup.ts).
    server.use(sessionDetailHandler(session));
    renderApp({ initialPath: "/sessions/session-1" });

    const user = await openDialog();
    await user.click(screen.getByRole("button", { name: "Abbrechen" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Kriterium 10: 'Endgültig löschen' sends exactly one DELETE, then navigates to the list without the session", async () => {
    const session = buildSessionResponse({
      id: "session-1",
      sessionDate: "2026-09-06",
      location: "Skatepark Braunschweig",
    });
    let deleteRequests = 0;
    server.use(
      sessionDetailHandler(session),
      http.delete(`${API_URL}/api/skate-sessions/session-1`, () => {
        deleteRequests += 1;
        return new HttpResponse(null, { status: 204 });
      }),
      // The list screen the app navigates to afterwards refetches – without
      // the deleted session, proving it is really gone.
      sessionsListHandler([], 0),
    );
    renderApp({ initialPath: "/sessions/session-1" });

    const user = await openDialog();
    await user.click(screen.getByRole("button", { name: "Endgültig löschen" }));

    await screen.findByRole("heading", { name: "Sessions" });
    expect(deleteRequests).toBe(1);
    expect(screen.getByText("Noch keine Session erfasst")).toBeInTheDocument();
  });

  it("Kriterium 11: a 500 on delete keeps the dialog open with role=alert, and it can be retried", async () => {
    const session = buildSessionResponse({ id: "session-1" });
    server.use(sessionDetailHandler(session), deleteSessionServerErrorHandler("session-1", 500));
    renderApp({ initialPath: "/sessions/session-1" });

    const user = await openDialog();
    await user.click(screen.getByRole("button", { name: "Endgültig löschen" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Löschen hat nicht funktioniert. Versuch es nochmal.");
    expect(screen.getByRole("dialog", { name: "Session löschen?" })).toBeInTheDocument();
  });

  it("ux.md Ergänzung: 'Endgültig löschen' is marked as the destructive action, 'Abbrechen' is not", async () => {
    const session = buildSessionResponse({ id: "session-1" });
    server.use(sessionDetailHandler(session));
    renderApp({ initialPath: "/sessions/session-1" });

    await openDialog();

    expect(screen.getByRole("button", { name: "Endgültig löschen" })).toHaveAttribute(
      "data-variant",
      "destructive",
    );
    expect(screen.getByRole("button", { name: "Abbrechen" })).not.toHaveAttribute(
      "data-variant",
      "destructive",
    );
  });

  it("ux.md Ergänzung: 'Abbrechen' receives focus when the dialog opens", async () => {
    const session = buildSessionResponse({ id: "session-1" });
    server.use(sessionDetailHandler(session));
    renderApp({ initialPath: "/sessions/session-1" });

    await openDialog();

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Abbrechen" }));
  });
});
