import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef } from "react";
import { type Path, useFieldArray, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { TrickResponse } from "@/features/tricks/api";
import { formatKg } from "../format";
import { type SessionFormRequest, type SessionFormValues, sessionFormSchema } from "../schema";
import { ScaleInput } from "./ScaleInput";
import { SessionTrickRow } from "./SessionTrickRow";
import { TrickPicker } from "./TrickPicker";

const DURATION_PRESETS = [30, 45, 60, 90, 120];
/** Exported so `SessionDetailScreen` shows the same threshold without duplicating the magic number. */
export const KNEE_PAIN_WARNING_THRESHOLD = 6;
const KNEE_PAIN_WARNING_TEXT =
  "Ab 6 gilt: Pause vor Fortschritt. Notier den Wert und plan die nächste Einheit kürzer.";
const NO_FLUID_LOSS_TEXT = "Kein Verlust – du hast unterwegs mehr getrunken als verloren.";

export interface SessionFormProps {
  /** Full trick catalog for `TrickPicker`. */
  tricks: TrickResponse[];
  initialValues: SessionFormValues;
  onSubmit: (request: SessionFormRequest) => void | Promise<void>;
  onCancel: () => void;
  /** Controlled by the caller (the in-flight mutation), not react-hook-form's own state. */
  isSubmitting: boolean;
  /** react-hook-form dot-path -> German message, from mapped server violations. */
  fieldErrors?: Record<string, string>;
  /** Collected/unmapped violations, or the 500/network message. */
  generalError?: string | null;
  /** Submit button label while idle. Default keeps T-0104's "Session speichern". */
  submitLabel?: string;
  /** Submit button label while the mutation is in flight. Default keeps T-0104's "Wird gespeichert …". */
  pendingLabel?: string;
  /** `data-track` on the `<form>` element. Default keeps T-0104's "session.create". */
  trackName?: string;
  /** `data-track` on the cancel button. Default keeps T-0104's "session.cancel". */
  cancelTrackName?: string;
}

/**
 * Whether "Weitere Angaben" should start expanded: true when at least one of
 * its fields already carries a value (design.md Abschnitt 5) – otherwise
 * editing a session would hide values it actually has.
 */
function hasAdditionalDetails(values: SessionFormValues): boolean {
  return (
    values.startedAt.trim().length > 0 ||
    values.weightBeforeKg.trim().length > 0 ||
    values.weightAfterKg.trim().length > 0 ||
    values.perceivedExertion !== null ||
    values.kneePain !== null ||
    values.notes.trim().length > 0
  );
}

function resolveTrickName(
  catalog: TrickResponse[],
  field: SessionFormValues["tricks"][number],
): string {
  if (field.trickName !== undefined) {
    return field.trickName;
  }
  return catalog.find((trick) => trick.slug === field.trickSlug)?.name ?? field.trickSlug;
}

function parseWeight(raw: string): number | null {
  if (raw.trim().length === 0) {
    return null;
  }
  const value = Number.parseFloat(raw);
  return Number.isNaN(value) ? null : value;
}

/**
 * Owns `react-hook-form` + `zodResolver(sessionFormSchema)` and knows nothing
 * about the network – `SessionCreateScreen` translates server violations into
 * `fieldErrors`/`generalError`, which keeps this component reusable for
 * T-0105's edit screen without change.
 */
export function SessionForm({
  tricks,
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting,
  fieldErrors,
  generalError = null,
  submitLabel = "Session speichern",
  pendingLabel = "Wird gespeichert …",
  trackName = "session.create",
  cancelTrackName = "session.cancel",
}: SessionFormProps) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<SessionFormValues, unknown, SessionFormRequest>({
    resolver: zodResolver(sessionFormSchema),
    defaultValues: initialValues,
  });
  const { fields, append, remove } = useFieldArray({ control, name: "tricks" });
  const generalErrorRef = useRef<HTMLDivElement>(null);

  const durationValue = watch("durationMinutes");
  const weightBeforeRaw = watch("weightBeforeKg");
  const weightAfterRaw = watch("weightAfterKg");
  const exertion = watch("perceivedExertion");
  const kneePain = watch("kneePain");

  useEffect(() => {
    if (generalError !== null) {
      generalErrorRef.current?.focus();
    }
  }, [generalError]);

  useEffect(() => {
    if (fieldErrors === undefined) {
      return;
    }
    const entries = Object.entries(fieldErrors);
    for (const [path, message] of entries) {
      setError(path as Path<SessionFormValues>, { type: "server", message });
    }
    const firstPath = entries[0]?.[0];
    if (firstPath !== undefined) {
      setFocus(firstPath as Path<SessionFormValues>);
    }
    // react-hook-form's setError/setFocus keep a stable identity across renders.
  }, [fieldErrors, setError, setFocus]);

  function handleToggleTrick(trick: TrickResponse) {
    const index = fields.findIndex((field) => field.trickSlug === trick.slug);
    if (index >= 0) {
      remove(index);
      return;
    }
    append({ trickSlug: trick.slug, trickName: trick.name, attempts: 10, landed: 0 });
  }

  const weightBefore = parseWeight(weightBeforeRaw);
  const weightAfter = parseWeight(weightAfterRaw);
  const hasBothWeights = weightBefore !== null && weightAfter !== null;
  const fluidLossKg = hasBothWeights ? Math.round((weightBefore - weightAfter) * 100) / 100 : null;
  const fluidLossText =
    fluidLossKg === null
      ? ""
      : fluidLossKg >= 0
        ? `Flüssigkeitsverlust: ${formatKg(fluidLossKg)}`
        : NO_FLUID_LOSS_TEXT;
  const showKneeWarning = kneePain !== null && kneePain >= KNEE_PAIN_WARNING_THRESHOLD;

  async function submitValid(request: SessionFormRequest) {
    await onSubmit(request);
  }

  return (
    <form
      data-track={trackName}
      onSubmit={handleSubmit(submitValid)}
      className="space-y-6"
      noValidate
    >
      {generalError !== null && (
        <div
          ref={generalErrorRef}
          role="alert"
          tabIndex={-1}
          className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive outline-none"
        >
          {generalError}
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor="session-date">Datum</Label>
        <Input
          id="session-date"
          type="date"
          className="h-12"
          aria-invalid={errors.sessionDate ? "true" : undefined}
          {...register("sessionDate")}
        />
        {errors.sessionDate?.message !== undefined && (
          <p role="alert" className="text-sm text-destructive">
            {errors.sessionDate.message}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="duration">Dauer in Minuten</Label>
        <div className="flex flex-wrap gap-2">
          {DURATION_PRESETS.map((preset) => (
            <Button
              key={preset}
              type="button"
              variant="outline"
              className="h-11 px-3"
              aria-pressed={durationValue === preset}
              data-track="session.duration-preset"
              onClick={() => setValue("durationMinutes", preset, { shouldValidate: true })}
            >
              {preset}
            </Button>
          ))}
        </div>
        <Input
          id="duration"
          type="number"
          inputMode="numeric"
          className="h-12"
          aria-invalid={errors.durationMinutes ? "true" : undefined}
          {...register("durationMinutes", { valueAsNumber: true })}
        />
        <p className="text-xs text-muted-foreground">Oder tippe einen Wert direkt ein.</p>
        {errors.durationMinutes?.message !== undefined && (
          <p role="alert" className="text-sm text-destructive">
            {errors.durationMinutes.message}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="location">Ort</Label>
        <Input
          id="location"
          type="text"
          className="h-12"
          placeholder="Skatepark Braunschweig"
          aria-invalid={errors.location ? "true" : undefined}
          {...register("location")}
        />
        {errors.location?.message !== undefined && (
          <p role="alert" className="text-sm text-destructive">
            {errors.location.message}
          </p>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Geübte Tricks</h2>
        <TrickPicker
          tricks={tricks}
          selectedSlugs={fields.map((field) => field.trickSlug)}
          onToggle={handleToggleTrick}
        />
        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch kein Trick gewählt. Tippe oben auf einen Trick, dann zählst du hier Versuche und
            Treffer.
          </p>
        ) : (
          <div className="space-y-3">
            {fields.map((field, index) => (
              <SessionTrickRow
                key={field.id}
                control={control}
                index={index}
                trickName={resolveTrickName(tricks, field)}
                onRemove={() => remove(index)}
                attemptsError={errors.tricks?.[index]?.attempts?.message}
                landedError={errors.tricks?.[index]?.landed?.message}
              />
            ))}
          </div>
        )}
      </div>

      <details className="space-y-3" open={hasAdditionalDetails(initialValues) || undefined}>
        <summary data-track="session.details-toggle" className="cursor-pointer text-sm font-medium">
          Weitere Angaben
        </summary>
        <div className="space-y-4 pt-3">
          <div className="space-y-1">
            <Label htmlFor="started-at">Startzeit</Label>
            <Input id="started-at" type="time" className="h-12" {...register("startedAt")} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="weight-before">Gewicht vorher in kg</Label>
            <Input
              id="weight-before"
              type="number"
              step="0.1"
              inputMode="decimal"
              aria-invalid={errors.weightBeforeKg ? "true" : undefined}
              {...register("weightBeforeKg")}
            />
            {errors.weightBeforeKg?.message !== undefined && (
              <p role="alert" className="text-sm text-destructive">
                {errors.weightBeforeKg.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="weight-after">Gewicht nachher in kg</Label>
            <Input
              id="weight-after"
              type="number"
              step="0.1"
              inputMode="decimal"
              aria-invalid={errors.weightAfterKg ? "true" : undefined}
              {...register("weightAfterKg")}
            />
            {errors.weightAfterKg?.message !== undefined && (
              <p role="alert" className="text-sm text-destructive">
                {errors.weightAfterKg.message}
              </p>
            )}
          </div>

          <p aria-live="polite" className="text-sm text-muted-foreground">
            {fluidLossText}
          </p>

          <div className="space-y-1">
            <Label>Anstrengung</Label>
            <ScaleInput
              label="Anstrengung"
              min={1}
              max={10}
              value={exertion}
              onChange={(value) => setValue("perceivedExertion", value, { shouldValidate: true })}
            />
            <p className="text-xs text-muted-foreground">1 heißt locker, 10 heißt am Limit.</p>
          </div>

          <div className="space-y-1">
            <Label>Knieschmerz links</Label>
            <ScaleInput
              label="Knieschmerz links"
              min={0}
              max={10}
              value={kneePain}
              onChange={(value) => setValue("kneePain", value, { shouldValidate: true })}
            />
            <p className="text-xs text-muted-foreground">0 heißt kein Schmerz, 10 heißt maximal.</p>
            <div role="status" className="text-sm text-destructive">
              {showKneeWarning ? KNEE_PAIN_WARNING_TEXT : ""}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="notes">Notiz</Label>
            <Textarea
              id="notes"
              rows={3}
              placeholder="Was lief gut, was hat gehakt?"
              aria-invalid={errors.notes ? "true" : undefined}
              {...register("notes")}
            />
            {errors.notes?.message !== undefined && (
              <p role="alert" className="text-sm text-destructive">
                {errors.notes.message}
              </p>
            )}
          </div>
        </div>
      </details>

      <div className="space-y-2 pt-2">
        <Button type="submit" className="h-12 w-full" disabled={isSubmitting}>
          {isSubmitting ? pendingLabel : submitLabel}
        </Button>
        <Button
          type="button"
          variant="link"
          className="w-full"
          data-track={cancelTrackName}
          onClick={onCancel}
        >
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
