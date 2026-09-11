import { format } from "date-fns";
import { z } from "zod";

/** A single practiced-trick row as held in `SessionForm`'s field array. */
const trickRowRawSchema = z
  .object({
    trickSlug: z.string(),
    /** Display name only – not part of the request body, stripped on submit. */
    trickName: z.string().optional(),
    attempts: z.number(),
    landed: z.number(),
  })
  .superRefine((row, ctx) => {
    if (row.attempts < 1 || row.attempts > 999) {
      ctx.addIssue({
        code: "custom",
        path: ["attempts"],
        message: "Versuche müssen zwischen 1 und 999 liegen.",
      });
    }
    if (row.landed < 0) {
      ctx.addIssue({
        code: "custom",
        path: ["landed"],
        message: "Treffer können nicht negativ sein.",
      });
    } else if (row.landed > row.attempts) {
      ctx.addIssue({
        code: "custom",
        path: ["landed"],
        message: "Es können nicht mehr Treffer als Versuche sein.",
      });
    }
  });

const sessionFormRawSchema = z.object({
  sessionDate: z.string(),
  durationMinutes: z.number(),
  location: z.string(),
  tricks: z.array(trickRowRawSchema).max(50, "Höchstens 50 Tricks pro Session."),
  startedAt: z.string(),
  weightBeforeKg: z.string(),
  weightAfterKg: z.string(),
  perceivedExertion: z.number().nullable(),
  kneePain: z.number().nullable(),
  notes: z.string(),
});

function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

/**
 * Raw values `SessionForm` (react-hook-form) holds before submit – the input
 * type `zodResolver` infers for `useForm`. `sessionFormSchema.parse(...)`
 * transforms this into the exact `SkateSessionRequest`-shaped body T-0102
 * expects (camelCase, `null` instead of empty strings for unset optional
 * fields, trick rows stripped down to `trickSlug`/`attempts`/`landed`).
 */
export type SessionFormValues = z.input<typeof sessionFormSchema>;

/** The transformed request body `SessionForm.onSubmit` receives. */
export type SessionFormRequest = z.output<typeof sessionFormSchema>;

export const sessionFormSchema = sessionFormRawSchema
  .superRefine((raw, ctx) => {
    if (isBlank(raw.sessionDate)) {
      ctx.addIssue({ code: "custom", path: ["sessionDate"], message: "Bitte gib ein Datum an." });
    } else if (raw.sessionDate > todayIso()) {
      ctx.addIssue({
        code: "custom",
        path: ["sessionDate"],
        message: "Das Datum darf nicht in der Zukunft liegen.",
      });
    }

    if (Number.isNaN(raw.durationMinutes)) {
      ctx.addIssue({
        code: "custom",
        path: ["durationMinutes"],
        message: "Bitte gib die Dauer an.",
      });
    } else if (raw.durationMinutes < 1 || raw.durationMinutes > 600) {
      ctx.addIssue({
        code: "custom",
        path: ["durationMinutes"],
        message: "Die Dauer muss zwischen 1 und 600 Minuten liegen.",
      });
    }

    const trimmedLocation = raw.location.trim();
    if (trimmedLocation.length === 0) {
      ctx.addIssue({ code: "custom", path: ["location"], message: "Bitte gib den Ort an." });
    } else if (trimmedLocation.length > 200) {
      ctx.addIssue({
        code: "custom",
        path: ["location"],
        message: "Der Ort darf höchstens 200 Zeichen lang sein.",
      });
    }

    const seenSlugs = new Set<string>();
    raw.tricks.forEach((row, index) => {
      if (seenSlugs.has(row.trickSlug)) {
        ctx.addIssue({
          code: "custom",
          path: ["tricks", index, "trickSlug"],
          message: "Diesen Trick hast du schon in der Liste.",
        });
      }
      seenSlugs.add(row.trickSlug);
    });

    const hasWeightBefore = !isBlank(raw.weightBeforeKg);
    const hasWeightAfter = !isBlank(raw.weightAfterKg);
    if (hasWeightBefore) {
      const value = Number.parseFloat(raw.weightBeforeKg);
      if (Number.isNaN(value) || value < 30 || value > 250) {
        ctx.addIssue({
          code: "custom",
          path: ["weightBeforeKg"],
          message: "Das Gewicht muss zwischen 30 und 250 kg liegen.",
        });
      }
    }
    if (hasWeightAfter) {
      if (!hasWeightBefore) {
        ctx.addIssue({
          code: "custom",
          path: ["weightAfterKg"],
          message: "Ohne Gewicht vorher ergibt das Gewicht nachher keinen Wert.",
        });
      } else {
        const value = Number.parseFloat(raw.weightAfterKg);
        if (Number.isNaN(value) || value < 30 || value > 250) {
          ctx.addIssue({
            code: "custom",
            path: ["weightAfterKg"],
            message: "Das Gewicht muss zwischen 30 und 250 kg liegen.",
          });
        }
      }
    }

    if (raw.notes.length > 2000) {
      ctx.addIssue({
        code: "custom",
        path: ["notes"],
        message: "Die Notiz darf höchstens 2000 Zeichen lang sein.",
      });
    }
  })
  .transform((raw) => {
    const trimmedLocation = raw.location.trim();
    const startedAt = isBlank(raw.startedAt) ? null : `${raw.sessionDate}T${raw.startedAt}:00`;
    const weightBeforeKg = isBlank(raw.weightBeforeKg)
      ? null
      : Number.parseFloat(raw.weightBeforeKg);
    const weightAfterKg = isBlank(raw.weightAfterKg) ? null : Number.parseFloat(raw.weightAfterKg);
    const notes = raw.notes.trim().length > 0 ? raw.notes : null;

    return {
      sessionDate: raw.sessionDate,
      startedAt,
      durationMinutes: raw.durationMinutes,
      location: trimmedLocation,
      weightBeforeKg,
      weightAfterKg,
      perceivedExertion: raw.perceivedExertion,
      kneePain: raw.kneePain,
      notes,
      tricks: raw.tricks.map(({ trickSlug, attempts, landed }) => ({
        trickSlug,
        attempts,
        landed,
      })),
    };
  });
