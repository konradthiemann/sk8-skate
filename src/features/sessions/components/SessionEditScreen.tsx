import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { fetchTricks, trickKeys } from "@/features/tricks/api";
import {
  ApiRequestError,
  fetchSession,
  type SkateSessionResponse,
  sessionKeys,
  updateSession,
  type Violation,
} from "../api";
import type { SessionFormRequest, SessionFormValues } from "../schema";
import { SessionForm } from "./SessionForm";

const SERVER_ERROR_TEXT =
  "Speichern hat nicht funktioniert. Deine Eingaben sind noch da – versuch es nochmal.";
const COLLECTED_ERROR_TITLE = "Beim Speichern gab es Probleme:";
const LOADING_TEXT = "Session wird geladen …";
const NOT_FOUND_TEXT = "Diese Session gibt es nicht mehr.";

/*
 * Same violation-mapping shape as `SessionCreateScreen` (T-0104). Kept local
 * rather than extracted into a shared helper: `SessionCreateScreen.tsx` is
 * not one of this ticket's listed files, and this mapper is small enough
 * that duplicating it here is lower-risk than touching an unrelated,
 * already-shipped screen just to share it.
 */
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
const TRICK_FIELD_PATTERN = /^tricks\[(\d+)]\.(attempts|landed|trickSlug|notes)$/;

interface MappedViolations {
  fieldErrors: Record<string, string>;
  unmapped: string[];
}

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

/** Maps the `GET` response onto `SessionForm`'s field values (design.md Abschnitt 5). */
function toFormValues(session: SkateSessionResponse): SessionFormValues {
  return {
    sessionDate: session.sessionDate,
    durationMinutes: session.durationMinutes,
    location: session.location,
    tricks: session.tricks.map((trick) => ({
      trickSlug: trick.trickSlug,
      trickName: trick.trickName,
      attempts: trick.attempts,
      landed: trick.landed,
    })),
    startedAt:
      session.startedAt === null || session.startedAt === undefined
        ? ""
        : session.startedAt.slice(11, 16),
    weightBeforeKg: session.weightBeforeKg?.toString() ?? "",
    weightAfterKg: session.weightAfterKg?.toString() ?? "",
    perceivedExertion: session.perceivedExertion ?? null,
    kneePain: session.kneePain ?? null,
    notes: session.notes ?? "",
  };
}

/**
 * Loads the session and the trick catalog, maps the response onto
 * `SessionFormValues`, and reuses `SessionForm` unchanged in structure – only
 * different labels/tracking and a `PUT` instead of a `POST`.
 */
export function SessionEditScreen() {
  const { sessionId } = useParams({ from: "/sessions/$sessionId/edit" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<FormError | null>(null);

  const sessionQuery = useQuery({
    queryKey: sessionKeys.detail(sessionId),
    queryFn: () => fetchSession(sessionId),
  });
  const tricksQuery = useQuery({
    queryKey: trickKeys.list(),
    queryFn: fetchTricks,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const mutation = useMutation({
    mutationFn: (request: SessionFormRequest) => updateSession(sessionId, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.all });
      navigate({ to: "/sessions/$sessionId", params: { sessionId } });
    },
  });

  const notFound =
    sessionQuery.isError &&
    sessionQuery.error instanceof ApiRequestError &&
    sessionQuery.error.status === 404;

  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    // ux.md Abschnitt 7a: the "not found" heading takes focus itself, the
    // same treatment as the detail view's own not-found state.
    if (notFound) {
      headingRef.current?.focus();
    }
  }, [notFound]);

  if (sessionQuery.isLoading || tricksQuery.isLoading) {
    return (
      <div role="status" className="py-6 text-center text-sm text-muted-foreground">
        {LOADING_TEXT}
      </div>
    );
  }

  if (notFound) {
    return (
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-xl font-semibold tracking-tight outline-none"
      >
        {NOT_FOUND_TEXT}
      </h1>
    );
  }

  if (sessionQuery.isError || tricksQuery.isError || sessionQuery.data === undefined) {
    return (
      <div
        role="alert"
        className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
      >
        {SERVER_ERROR_TEXT}
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
      <h1 className="text-xl font-semibold tracking-tight">Session bearbeiten</h1>
      <SessionForm
        tricks={tricksQuery.data ?? []}
        initialValues={toFormValues(sessionQuery.data)}
        onSubmit={handleSubmit}
        onCancel={() => navigate({ to: "/sessions/$sessionId", params: { sessionId } })}
        isSubmitting={mutation.isPending}
        fieldErrors={formError?.fieldErrors}
        generalError={formError?.generalError ?? null}
        submitLabel="Änderungen speichern"
        pendingLabel="Wird gespeichert …"
        trackName="session.update"
        cancelTrackName="session.update-cancel"
      />
    </section>
  );
}
