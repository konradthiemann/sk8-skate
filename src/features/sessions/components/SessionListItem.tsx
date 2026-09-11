import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import type { SkateSessionSummary } from "../api";
import { formatDuration, formatSessionDate, formatSuccessRate } from "../format";

interface SessionListItemProps {
  session: SkateSessionSummary;
}

const KNEE_WARNING_THRESHOLD = 6;

function trickCountText(trickCount: number): string {
  return trickCount === 1 ? "1 Trick" : `${trickCount} Tricks`;
}

/** One row in the session list – links to its detail view, the whole card is the tap target. */
export function SessionListItem({ session }: SessionListItemProps) {
  const showKneeWarning =
    session.kneePain !== null &&
    session.kneePain !== undefined &&
    session.kneePain >= KNEE_WARNING_THRESHOLD;

  return (
    <Link
      to="/sessions/$sessionId"
      params={{ sessionId: session.id }}
      data-track="session.open"
      className="block min-h-16 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <Card className="gap-1 py-4 transition-colors hover:bg-accent/40 active:bg-accent/60">
        <CardContent className="space-y-1 px-4">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{formatSessionDate(session.sessionDate)}</span>
            <div className="flex items-center gap-2">
              {showKneeWarning && (
                // biome-ignore lint/a11y/useAriaPropsSupportedByRole: intentional short visible label ("Knie") with a fuller accessible name (ux.md Abschnitt 7, Ergänzung 5).
                <span
                  aria-label={`Knieschmerz ${session.kneePain} von 10`}
                  className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
                >
                  Knie
                </span>
              )}
              {session.successRate === null || session.successRate === undefined ? (
                // biome-ignore lint/a11y/useAriaPropsSupportedByRole: "–" needs a spoken alternative ("keine Tricks erfasst") distinct from the visible dash.
                <span aria-label="keine Tricks erfasst" className="text-muted-foreground">
                  –
                </span>
              ) : (
                <span className="font-medium tabular-nums">
                  {formatSuccessRate(session.successRate)}
                </span>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            <span>{session.location}</span>
            <span aria-hidden="true"> · </span>
            <span>{formatDuration(session.durationMinutes)}</span>
            <span aria-hidden="true"> · </span>
            <span>{trickCountText(session.trickCount)}</span>
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
