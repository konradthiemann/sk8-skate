import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { useMemo, useState } from "react";
import { fetchTricks, trickKeys } from "@/features/tricks/api";
import { ApiRequestError, createSession, fetchSessions, sessionKeys, type Violation } from "../api";
import type { SessionFormRequest, SessionFormValues } from "../schema";
import { SessionForm } from "./SessionForm";

const DEFAULT_LOCATION = "Skatepark Braunschweig";
const SERVER_ERROR_TEXT =
  "Speichern hat nicht funktioniert. Deine Eingaben sind noch da – versuch es nochmal.";
const COLLECTED_ERROR_TITLE = "Beim Speichern gab es Probleme:";

const DIRECT_FIELD_NAMES = new Set([
  "sessionDate",
  "durationMinutes",
  "location",
  "startedAt",
  "weightBeforeKg",
  "weightAfterKg",
  "perceivedExertion",
  "kneePain",
  "notes",
]);
/** Server violation field paths for trick rows look like "tricks[0].landed". */
const TRICK_FIELD_PATTERN = /^tricks\[(\d+)]\.(attempts|landed|trickSlug|notes)$/;

interface MappedViolations {
  fieldErrors: Record<string, string>;
  unmapped: string[];
}

/**
 * Translates server violation field paths into react-hook-form dot-paths
 * (`tricks[0].landed` -> `tricks.0.landed`). Anything that does not match a
 * known pattern is defensive by design: it is collected instead of causing an
 * `undefined` field lookup in `SessionForm`.
 */
function mapViolations(violations: Violation[]): MappedViolations {
  const fieldErrors: Record<string, string> = {};
  const unmapped: string[] = [];
  for (const violation of violations) {
    if (DIRECT_FIELD_NAMES.has(violation.field)) {
      fieldErrors[violation.field] = violation.message;
      continue;
    }
    const match = TRICK_FIELD_PATTERN.exec(violation.field);
    if (match) {
      const [, index, property] = match;
      fieldErrors[`tricks.${index}.${property}`] = violation.message;
      continue;
    }
    unmapped.push(violation.message);
  }
  return { fieldErrors, unmapped };
}

interface FormError {
  fieldErrors?: Record<string, string>;
  generalError?: string;
}

/**
 * Waits for the trick catalog *and* the most recent session (both feed the
 * prefill), then renders `SessionForm`. Owns the network: translates server
 * violations into `SessionForm`'s `fieldErrors`/`generalError` props.
 */
export function SessionCreateScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<FormError | null>(null);

  const tricksQuery = useQuery({
    queryKey: trickKeys.list(),
    queryFn: fetchTricks,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const lastSessionQuery = useQuery({
    queryKey: sessionKeys.list({ limit: 1 }),
    queryFn: () => fetchSessions({ limit: 1 }),
  });

  const mutation = useMutation({
    mutationFn: createSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.all });
      navigate({ to: "/sessions" });
    },
  });

  const initialValues: SessionFormValues = useMemo(
    () => ({
      sessionDate: format(new Date(), "yyyy-MM-dd"),
      durationMinutes: 60,
      location: lastSessionQuery.data?.items[0]?.location ?? DEFAULT_LOCATION,
      tricks: [],
      startedAt: "",
      weightBeforeKg: "",
      weightAfterKg: "",
      perceivedExertion: null,
      kneePain: null,
      notes: "",
    }),
    [lastSessionQuery.data],
  );

  if (tricksQuery.isLoading || lastSessionQuery.isLoading) {
    return (
      <div role="status" className="py-6 text-center text-sm text-muted-foreground">
        Formular wird vorbereitet …
      </div>
    );
  }

  if (tricksQuery.isError) {
    return (
      <div
        role="alert"
        className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
      >
        Der Trick-Katalog konnte nicht geladen werden. Ohne ihn kannst du keine Tricks erfassen.
      </div>
    );
  }

  async function handleSubmit(request: SessionFormRequest) {
    setFormError(null);
    try {
      await mutation.mutateAsync(request);
    } catch (error) {
      if (
        error instanceof ApiRequestError &&
        error.status === 422 &&
        error.violations !== undefined
      ) {
        const { fieldErrors, unmapped } = mapViolations(error.violations);
        setFormError({
          fieldErrors,
          generalError:
            unmapped.length > 0 ? `${COLLECTED_ERROR_TITLE} ${unmapped.join(" ")}` : undefined,
        });
        return;
      }
      setFormError({ generalError: SERVER_ERROR_TEXT });
    }
  }

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Session erfassen</h1>
      <SessionForm
        tricks={tricksQuery.data ?? []}
        initialValues={initialValues}
        onSubmit={handleSubmit}
        onCancel={() => navigate({ to: "/sessions" })}
        isSubmitting={mutation.isPending}
        fieldErrors={formError?.fieldErrors}
        generalError={formError?.generalError ?? null}
      />
    </section>
  );
}
