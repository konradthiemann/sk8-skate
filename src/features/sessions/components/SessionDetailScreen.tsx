import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { type RefObject, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ApiRequestError, fetchSession, type SkateSessionResponse, sessionKeys } from "../api";
import {
  formatDuration,
  formatFluidLoss,
  formatKg,
  formatSessionDate,
  formatSuccessRate,
} from "../format";
import { DeleteSessionDialog } from "./DeleteSessionDialog";
import { KNEE_PAIN_WARNING_THRESHOLD } from "./SessionForm";

const LOADING_TEXT = "Session wird geladen …";
const ERROR_TEXT = "Diese Session konnte nicht geladen werden.";
const RETRY_TEXT = "Nochmal versuchen";
const NOT_FOUND_TEXT = "Diese Session gibt es nicht mehr.";
const BACK_TEXT = "Zurück zu den Sessions";
const TRICKS_TITLE = "Geübte Tricks";
const TRICKS_EMPTY_TEXT = "In dieser Session hast du keine Tricks erfasst.";
const NOT_SET = "–";
const KNEE_PAIN_WARNING_TEXT = "Ab 6 gilt: Pause vor Fortschritt.";

function scaleValue(value: number | null | undefined): string {
  return value === null || value === undefined ? NOT_SET : `${value} von 10`;
}

function kgOrDash(valueKg: number | null | undefined): string {
  return valueKg === null || valueKg === undefined ? NOT_SET : formatKg(valueKg);
}

interface MetricRowProps {
  label: string;
  value: string;
  hint?: string;
}

function MetricRow({ label, value, hint }: MetricRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-right">
        <span className="font-medium tabular-nums">{value}</span>
        {hint !== undefined && <p className="text-xs text-destructive">{hint}</p>}
      </div>
    </div>
  );
}

interface SessionDetailContentProps {
  sessionId: string;
  session: SkateSessionResponse;
  headingRef: RefObject<HTMLHeadingElement | null>;
}

function SessionDetailContent({ sessionId, session, headingRef }: SessionDetailContentProps) {
  const showKneeWarning =
    session.kneePain !== null &&
    session.kneePain !== undefined &&
    session.kneePain >= KNEE_PAIN_WARNING_THRESHOLD;
  const hasNotes =
    session.notes !== null && session.notes !== undefined && session.notes.length > 0;

  return (
    <>
      <div className="space-y-1">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-xl font-semibold tracking-tight outline-none"
        >
          {formatSessionDate(session.sessionDate)}
        </h1>
        <p className="text-sm text-muted-foreground">
          <span>{session.location}</span>
          <span aria-hidden="true"> · </span>
          <span>{formatDuration(session.durationMinutes)}</span>
          {session.startedAt !== null && session.startedAt !== undefined && (
            <>
              <span aria-hidden="true"> · </span>
              <span>{format(parseISO(session.startedAt), "HH:mm")}</span>
            </>
          )}
        </p>
      </div>

      <div className="divide-y rounded-md border px-3">
        <MetricRow label="Versuche" value={String(session.totalAttempts)} />
        <MetricRow label="Treffer" value={String(session.totalLanded)} />
        <MetricRow label="Erfolgsquote" value={formatSuccessRate(session.successRate ?? null)} />
        <MetricRow
          label="Flüssigkeitsverlust"
          value={formatFluidLoss(session.fluidLossKg ?? null)}
        />
        <MetricRow label="Gewicht vorher" value={kgOrDash(session.weightBeforeKg)} />
        <MetricRow label="Gewicht nachher" value={kgOrDash(session.weightAfterKg)} />
        <MetricRow label="Anstrengung" value={scaleValue(session.perceivedExertion)} />
        <MetricRow
          label="Knieschmerz links"
          value={scaleValue(session.kneePain)}
          hint={showKneeWarning ? KNEE_PAIN_WARNING_TEXT : undefined}
        />
      </div>

      <section aria-labelledby="tricks-heading" className="space-y-3">
        <h2 id="tricks-heading" className="text-lg font-semibold">
          {TRICKS_TITLE}
        </h2>
        {session.tricks.length === 0 ? (
          <p className="text-sm text-muted-foreground">{TRICKS_EMPTY_TEXT}</p>
        ) : (
          <div className="space-y-3">
            {session.tricks.map((trick) => (
              <div key={trick.id} className="space-y-1 rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{trick.trickName}</span>
                  <span className="tabular-nums">
                    {trick.landed} von {trick.attempts}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatSuccessRate(trick.successRate)}
                </p>
                {trick.notes !== null && trick.notes !== undefined && trick.notes.length > 0 && (
                  // Quote marks via CSS content, not literal characters, so the note text
                  // itself stays an isolated, exactly-matchable text node for tests.
                  <p className="text-sm italic before:content-['„'] after:content-['“']">
                    {trick.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {hasNotes && (
        <section className="space-y-1">
          <h2 className="text-lg font-semibold">Notiz</h2>
          <p className="text-sm text-muted-foreground">{session.notes}</p>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 pt-2">
        <Button asChild variant="outline" className="h-12" data-track="session.edit">
          <Link to="/sessions/$sessionId/edit" params={{ sessionId }}>
            Bearbeiten
          </Link>
        </Button>
        <DeleteSessionDialog
          sessionId={sessionId}
          sessionDate={session.sessionDate}
          location={session.location}
        />
      </div>
    </>
  );
}

/** Detail view for one session: metrics grid, practiced tricks with notes, edit/delete actions. */
export function SessionDetailScreen() {
  const { sessionId } = useParams({ from: "/sessions/$sessionId/" });
  const query = useQuery({
    queryKey: sessionKeys.detail(sessionId),
    queryFn: () => fetchSession(sessionId),
  });

  const notFound =
    query.isError && query.error instanceof ApiRequestError && query.error.status === 404;

  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (notFound || query.isSuccess) {
      headingRef.current?.focus();
    }
    // ux.md Abschnitt 7d: every screen this ticket touches focuses its own
    // heading on mount, so a route change without a full page load is still
    // announced to screen readers.
  }, [notFound, query.isSuccess]);

  return (
    <div className="space-y-4">
      <Link
        to="/sessions"
        data-track="session.back"
        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        <span aria-hidden="true">← </span>
        {BACK_TEXT}
      </Link>

      {query.isLoading && (
        <div role="status" className="py-6 text-center text-sm text-muted-foreground">
          {LOADING_TEXT}
        </div>
      )}

      {notFound && (
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-xl font-semibold tracking-tight outline-none"
        >
          {NOT_FOUND_TEXT}
        </h1>
      )}

      {query.isError && !notFound && (
        <div
          role="alert"
          className="space-y-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <p>{ERROR_TEXT}</p>
          <Button type="button" variant="outline" onClick={() => query.refetch()}>
            {RETRY_TEXT}
          </Button>
        </div>
      )}

      {query.isSuccess && (
        <SessionDetailContent sessionId={sessionId} session={query.data} headingRef={headingRef} />
      )}
    </div>
  );
}
