import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildSmallTrickCatalog } from "@/features/tricks/test/handlers";
import type { SessionFormValues } from "../schema";
import { SessionForm } from "./SessionForm";

/*
 * `SessionForm` contract this test pins down (design.md leaves the exact
 * props to the implementer, so this is the concretized interface):
 *
 *   interface SessionFormProps {
 *     tricks: TrickResponse[];         // catalog for TrickPicker
 *     initialValues: SessionFormValues;
 *     onSubmit(request): void | Promise<void>; // called with the zod-transformed request
 *     onCancel(): void;
 *     isSubmitting: boolean;
 *     fieldErrors?: Record<string, string>;    // react-hook-form dot-path -> German message
 *     generalError?: string | null;            // collected/unmapped violations, or 500/network text
 *   }
 *
 * SessionForm owns react-hook-form + zodResolver(sessionFormSchema) itself and
 * knows nothing about the network – SessionCreateScreen (T-0104) parses server
 * violations into `fieldErrors`/`generalError`, which keeps SessionForm reusable
 * for T-0105's edit screen without change.
 */

const TRICKS = buildSmallTrickCatalog(); // Ollie (goal 1), Kickflip (goal 2)

function baseInitialValues(overrides: Partial<SessionFormValues> = {}): SessionFormValues {
  return {
    sessionDate: "2026-09-08",
    durationMinutes: 60,
    location: "Skatepark Braunschweig",
    tricks: [],
    startedAt: "",
    weightBeforeKg: "",
    weightAfterKg: "",
    perceivedExertion: null,
    kneePain: null,
    notes: "",
    ...overrides,
  };
}

function renderForm(overrides: Partial<React.ComponentProps<typeof SessionForm>> = {}) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  render(
    <SessionForm
      tricks={TRICKS}
      initialValues={baseInitialValues()}
      onSubmit={onSubmit}
      onCancel={onCancel}
      isSubmitting={false}
      {...overrides}
    />,
  );
  return { onSubmit, onCancel };
}

async function openMoreDetails(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText("Weitere Angaben"));
}

/** Native date/time inputs: jsdom does not reliably simulate segment-by-segment keyboard typing here (unlike text inputs), so the value is set directly – the one documented exception to "userEvent instead of fireEvent" (ADR-007). */
function setDate(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
}

describe("SessionForm", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date(2026, 8, 8, 12, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("Kriterium 12: adding a trick tile creates a row with attempts 10 and landed 0, and marks the tile pressed", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(
      screen.queryByRole("spinbutton", { name: "Versuche für Ollie" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ollie", pressed: false }));

    expect(screen.getByRole("button", { name: "Ollie", pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Versuche für Ollie" })).toHaveValue(10);
    expect(screen.getByRole("spinbutton", { name: "Treffer für Ollie" })).toHaveValue(0);
  });

  it("Kriterium 13: tapping an already-selected tile removes its row", async () => {
    const user = userEvent.setup();
    renderForm();

    const tile = screen.getByRole("button", { name: "Ollie", pressed: false });
    await user.click(tile);
    expect(screen.getByRole("spinbutton", { name: "Versuche für Ollie" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ollie", pressed: true }));

    expect(
      screen.queryByRole("spinbutton", { name: "Versuche für Ollie" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ollie", pressed: false })).toBeInTheDocument();
  });

  it("Kriterium 14: three taps on the attempts '+' raise the counter from 10 to 13", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: "Ollie", pressed: false }));

    const increase = screen.getByRole("button", { name: "Versuche für Ollie: Eins mehr" });
    await user.click(increase);
    await user.click(increase);
    await user.click(increase);

    expect(screen.getByRole("spinbutton", { name: "Versuche für Ollie" })).toHaveValue(13);
  });

  it("Kriterium 15: the landed '+' does not push landed above attempts", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: "Ollie", pressed: false }));

    const attemptsDecrease = screen.getByRole("button", {
      name: "Versuche für Ollie: Eins weniger",
    });
    for (let i = 0; i < 5; i += 1) {
      await user.click(attemptsDecrease); // attempts 10 -> 5
    }
    const landedIncrease = screen.getByRole("button", { name: "Treffer für Ollie: Eins mehr" });
    for (let i = 0; i < 5; i += 1) {
      await user.click(landedIncrease); // landed 0 -> 5
    }
    expect(screen.getByRole("spinbutton", { name: "Treffer für Ollie" })).toHaveValue(5);

    await user.click(landedIncrease); // attempted 5 -> 6, must be clamped

    expect(screen.getByRole("spinbutton", { name: "Treffer für Ollie" })).toHaveValue(5);
  });

  it("Kriterium 16: typing landed above attempts directly is rejected on submit, without a request", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.click(screen.getByRole("button", { name: "Ollie", pressed: false }));

    const attempts = screen.getByRole("spinbutton", { name: "Versuche für Ollie" });
    await user.clear(attempts);
    await user.type(attempts, "5");
    const landed = screen.getByRole("spinbutton", { name: "Treffer für Ollie" });
    await user.clear(landed);
    await user.type(landed, "6");

    await user.click(screen.getByRole("button", { name: "Session speichern" }));

    const message = await screen.findByText("Es können nicht mehr Treffer als Versuche sein.");
    expect(message.closest('[role="alert"]')).not.toBeNull();
    expect(screen.getByRole("spinbutton", { name: "Treffer für Ollie" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("Kriterium 17: a duration of 0 is rejected on submit, without a request", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    const duration = screen.getByLabelText("Dauer in Minuten");
    await user.clear(duration);
    await user.type(duration, "0");
    await user.click(screen.getByRole("button", { name: "Session speichern" }));

    const message = await screen.findByText("Die Dauer muss zwischen 1 und 600 Minuten liegen.");
    expect(message.closest('[role="alert"]')).not.toBeNull();
    expect(duration).toHaveAttribute("aria-invalid", "true");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("Kriterium 18: a date of tomorrow is rejected on submit, without a request", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    setDate(screen.getByLabelText("Datum"), "2026-09-09");
    await user.click(screen.getByRole("button", { name: "Session speichern" }));

    const message = await screen.findByText("Das Datum darf nicht in der Zukunft liegen.");
    expect(message.closest('[role="alert"]')).not.toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("Kriterium 19: an empty location is rejected on submit, and focus moves to it", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    const location = screen.getByLabelText("Ort");
    await user.clear(location);
    await user.click(screen.getByRole("button", { name: "Session speichern" }));

    const message = await screen.findByText("Bitte gib den Ort an.");
    expect(message.closest('[role="alert"]')).not.toBeNull();
    expect(location).toHaveAttribute("aria-invalid", "true");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(location);
  });

  it("Kriterium 20: weight after without weight before is rejected on submit", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await openMoreDetails(user);

    const weightAfter = screen.getByLabelText("Gewicht nachher in kg");
    await user.type(weightAfter, "77.1");
    await user.click(screen.getByRole("button", { name: "Session speichern" }));

    const message = await screen.findByText(
      "Ohne Gewicht vorher ergibt das Gewicht nachher keinen Wert.",
    );
    expect(message.closest('[role="alert"]')).not.toBeNull();
    expect(weightAfter).toHaveAttribute("aria-invalid", "true");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("Kriterium 21: both weights set shows the computed fluid loss without submitting", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await openMoreDetails(user);

    await user.type(screen.getByLabelText("Gewicht vorher in kg"), "78.4");
    await user.type(screen.getByLabelText("Gewicht nachher in kg"), "77.1");

    expect(screen.getByText("Flüssigkeitsverlust: 1,3 kg")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("Kriterium 22: a weight gain is reported as no loss, not a negative value", async () => {
    const user = userEvent.setup();
    renderForm();
    await openMoreDetails(user);

    await user.type(screen.getByLabelText("Gewicht vorher in kg"), "77.1");
    await user.type(screen.getByLabelText("Gewicht nachher in kg"), "77.3");

    expect(
      screen.getByText("Kein Verlust – du hast unterwegs mehr getrunken als verloren."),
    ).toBeInTheDocument();
  });

  it("Kriterium 23: choosing knee pain 6 shows the pause warning as a status message", async () => {
    const user = userEvent.setup();
    renderForm();
    await openMoreDetails(user);

    const kneeGroup = screen.getByRole("radiogroup", { name: "Knieschmerz links" });
    await user.click(within(kneeGroup).getByRole("radio", { name: "6" }));

    const warning = await screen.findByText(/Ab 6 gilt: Pause vor Fortschritt/);
    expect(warning.closest('[role="status"]')).not.toBeNull();
  });

  it("does not show the knee pain warning below 6", async () => {
    const user = userEvent.setup();
    renderForm();
    await openMoreDetails(user);

    const kneeGroup = screen.getByRole("radiogroup", { name: "Knieschmerz links" });
    await user.click(within(kneeGroup).getByRole("radio", { name: "5" }));

    expect(screen.queryByText(/Ab 6 gilt: Pause vor Fortschritt/)).not.toBeInTheDocument();
  });

  it("Kriterium 27: while submitting, the button is disabled and reads 'Wird gespeichert …'", () => {
    renderForm({ isSubmitting: true });

    const button = screen.getByRole("button", { name: "Wird gespeichert …" });
    expect(button).toBeDisabled();
  });

  it("Kriterium 29: a field-mapped server violation appears under that trick's landed field, inputs kept", async () => {
    renderForm({
      initialValues: baseInitialValues({
        tricks: [{ trickSlug: "ollie", trickName: "Ollie", attempts: 5, landed: 5 }],
      }),
      fieldErrors: { "tricks.0.landed": "Der Server hat diesen Wert abgelehnt." },
    });

    const message = await screen.findByText("Der Server hat diesen Wert abgelehnt.");
    expect(message.closest('[role="alert"]')).not.toBeNull();
    expect(screen.getByRole("spinbutton", { name: "Treffer für Ollie" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByRole("spinbutton", { name: "Treffer für Ollie" })).toHaveValue(5);
  });

  it("Kriterium 30: an unmapped violation is shown collected at the top of the form", async () => {
    renderForm({
      generalError: "Beim Speichern gab es Probleme: Ein unbekanntes Feld war ungültig.",
    });

    const message = await screen.findByText(
      "Beim Speichern gab es Probleme: Ein unbekanntes Feld war ungültig.",
    );
    expect(message.closest('[role="alert"]')).not.toBeNull();
  });

  it("Kriterium 31: a server/network error keeps all inputs and shows the generic message", async () => {
    renderForm({
      initialValues: baseInitialValues({ location: "Skatehalle Hannover" }),
      generalError:
        "Speichern hat nicht funktioniert. Deine Eingaben sind noch da – versuch es nochmal.",
    });

    const message = await screen.findByText(
      "Speichern hat nicht funktioniert. Deine Eingaben sind noch da – versuch es nochmal.",
    );
    expect(message.closest('[role="alert"]')).not.toBeNull();
    expect(screen.getByLabelText("Ort")).toHaveValue("Skatehalle Hannover");
  });
});
