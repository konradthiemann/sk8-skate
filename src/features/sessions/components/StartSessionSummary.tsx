import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { endOfWeek, format, parseISO, startOfWeek } from "date-fns";
import { de } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNow } from "@/hooks/useNow";
import { fetchSessions, sessionKeys } from "../api";
import { formatDuration, formatFluidLoss, formatSessionDate, formatSuccessRate } from "../format";
import { summarizeWeek } from "../week";

const LOADING_TEXT = "Deine Sessions werden geladen …";
const ERROR_TEXT = "Deine Sessions konnten nicht geladen werden.";
const LAST_TITLE = "Letzte Session";
const LAST_EMPTY_TEXT = "Noch keine Session erfasst. Log deine erste Einheit.";
const LAST_EMPTY_ACTION = "Session erfassen";
const WEEK_TITLE = "Diese Woche";
const WEEK_EMPTY_TEXT = "Diese Woche noch keine Session. Zeit für die erste.";
const WEEK_LIST_LABEL = "Diese Woche, Montag bis Sonntag";

const WEEKDAY_ABBREVIATIONS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function sessionCountText(count: number): string {
  return count === 1 ? "1 Session" : `${count} Sessions`;
}

/** Last session + running-week block for the start page (design.md Abschnitt 5), this app only. */
export function StartSessionSummary() {
  const now = useNow();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const from = format(weekStart, "yyyy-MM-dd");
  const to = format(weekEnd, "yyyy-MM-dd");

  const lastQuery = useQuery({
    queryKey: sessionKeys.list({ limit: 1 }),
    queryFn: () => fetchSessions({ limit: 1 }),
  });
  const weekQuery = useQuery({
    queryKey: sessionKeys.list({ from, to, limit: 20 }),
    queryFn: () => fetchSessions({ from, to, limit: 20 }),
  });

  if (lastQuery.isLoading || weekQuery.isLoading) {
    return (
      <div role="status" className="py-4 text-center text-sm text-muted-foreground">
        {LOADING_TEXT}
      </div>
    );
  }

  if (lastQuery.isError || weekQuery.isError || !lastQuery.isSuccess || !weekQuery.isSuccess) {
    return (
      <div
        role="alert"
        className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
      >
        {ERROR_TEXT}
      </div>
    );
  }

  const last = lastQuery.data.items[0];
  const week = summarizeWeek(weekQuery.data.items, now);
  const maxDuration = Math.max(1, ...week.days.map((day) => day.durationMinutes));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="gap-1">
          <CardDescription>{LAST_TITLE}</CardDescription>
          {last !== undefined && <CardTitle>{formatSessionDate(last.sessionDate)}</CardTitle>}
        </CardHeader>
        <CardContent>
          {last === undefined ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{LAST_EMPTY_TEXT}</p>
              <Button asChild className="h-12 w-full" data-track="start.session-new">
                <Link to="/sessions/new">{LAST_EMPTY_ACTION}</Link>
              </Button>
            </div>
          ) : (
            <Link
              to="/sessions/$sessionId"
              params={{ sessionId: last.id }}
              data-track="start.last-session"
              className="block space-y-1 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <p className="text-sm text-muted-foreground">
                {last.location}
                <span aria-hidden="true"> · </span>
                {formatDuration(last.durationMinutes)}
              </p>
              <p className="text-sm font-medium">
                {formatSuccessRate(last.successRate ?? null)}
                <span aria-hidden="true"> · </span>
                {formatFluidLoss(last.fluidLossKg ?? null)} Flüssigkeitsverlust
              </p>
            </Link>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-1">
          <CardDescription>{WEEK_TITLE}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {week.sessionCount === 0 ? (
            <p className="text-sm text-muted-foreground">{WEEK_EMPTY_TEXT}</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {sessionCountText(week.sessionCount)}
                <span aria-hidden="true"> · </span>
                {formatDuration(week.totalDurationMinutes)}
                {week.successRate !== null && (
                  <>
                    <span aria-hidden="true"> · </span>
                    {formatSuccessRate(week.successRate)} getroffen
                  </>
                )}
              </p>
              <ul aria-label={WEEK_LIST_LABEL} className="flex h-24 items-end gap-2">
                {week.days.map((day, index) => {
                  const weekday = format(parseISO(day.date), "EEEE", { locale: de });
                  const label = day.hasSession
                    ? `${weekday}: ${formatDuration(day.durationMinutes)}`
                    : `${weekday}: keine Session`;
                  const heightPercent = day.hasSession
                    ? Math.max(15, Math.round((day.durationMinutes / maxDuration) * 100))
                    : 8;
                  return (
                    <li
                      key={day.date}
                      aria-label={label}
                      className="flex flex-1 flex-col items-center gap-1"
                    >
                      <div
                        aria-hidden="true"
                        className={`w-full rounded-t ${day.hasSession ? "bg-primary" : "bg-muted"}`}
                        style={{ height: `${heightPercent}%` }}
                      />
                      <span aria-hidden="true" className="text-xs text-muted-foreground">
                        {WEEKDAY_ABBREVIATIONS[index]}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
