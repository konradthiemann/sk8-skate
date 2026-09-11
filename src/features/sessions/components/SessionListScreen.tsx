import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader } from "@/components/ui/card";
import { fetchSessions, type SkateSessionSummary, sessionKeys } from "../api";
import { formatMonthGroup } from "../format";
import { SessionListItem } from "./SessionListItem";

const PAGE_SIZE = 50;

interface MonthGroup {
  label: string;
  items: SkateSessionSummary[];
}

/** Sessions arrive newest-first from the backend; group consecutive same-month runs. */
function groupByMonth(items: SkateSessionSummary[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const item of items) {
    const label = formatMonthGroup(item.sessionDate);
    const current = groups.at(-1);
    if (current !== undefined && current.label === label) {
      current.items.push(item);
    } else {
      groups.push({ label, items: [item] });
    }
  }
  return groups;
}

function sessionCountText(total: number): string {
  return total === 1 ? "1 Session" : `${total} Sessions`;
}

export function SessionListScreen() {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const query = useQuery({
    queryKey: sessionKeys.list({ limit }),
    queryFn: () => fetchSessions({ limit }),
  });
  // Self-focuses on every mount (ux.md Abschnitt 7d): after a successful
  // delete on the detail view navigates back here, nothing else moves focus.
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-xl font-semibold tracking-tight outline-none"
        >
          Sessions
        </h1>
        {query.data !== undefined && (
          <span className="text-sm text-muted-foreground">
            {sessionCountText(query.data.total)}
          </span>
        )}
      </div>

      <Button asChild className="h-12 w-full" data-track="session.new">
        <Link to="/sessions/new">Session erfassen</Link>
      </Button>

      {query.isLoading && (
        <div role="status" className="py-6 text-center text-sm text-muted-foreground">
          Sessions werden geladen …
        </div>
      )}

      {query.isError && (
        <div
          role="alert"
          className="space-y-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <p>Deine Sessions konnten nicht geladen werden.</p>
          <Button
            type="button"
            variant="outline"
            data-track="sessions.retry"
            onClick={() => query.refetch()}
          >
            Nochmal versuchen
          </Button>
        </div>
      )}

      {query.isSuccess && query.data.total === 0 && (
        <Card>
          <CardHeader className="gap-2">
            <h2 className="font-semibold">Noch keine Session erfasst</h2>
            <CardDescription>
              Log deine erste Einheit. Danach siehst du hier deinen Verlauf mit Dauer, Tricks und
              Erfolgsquote.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {query.isSuccess && query.data.total > 0 && (
        <div className="space-y-4">
          {groupByMonth(query.data.items).map((group) => (
            <div key={group.label} className="space-y-2">
              <h2 className="text-base font-semibold">{group.label}</h2>
              <div className="space-y-2">
                {group.items.map((session) => (
                  <SessionListItem key={session.id} session={session} />
                ))}
              </div>
            </div>
          ))}
          {query.data.total > query.data.items.length && (
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full"
              data-track="sessions.load-more"
              onClick={() => setLimit((current) => current + PAGE_SIZE)}
            >
              Mehr laden
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
