import { Link } from "@tanstack/react-router";
import type * as React from "react";
import { sections } from "@/app.sections";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { useNow } from "@/hooks/useNow";
import {
  CONTEST_LOCATION,
  daysUntilContest,
  formatContestCountdown,
  formatContestDate,
} from "@/lib/contest";

export function StartScreen({ children }: { children?: React.ReactNode }) {
  const now = useNow();
  const days = daysUntilContest(now);

  return (
    <div className="space-y-4">
      <section aria-labelledby="countdown-heading">
        <Card className="gap-2 py-5">
          <CardHeader className="gap-1 px-5">
            <CardDescription>Contest</CardDescription>
            <h1
              id="countdown-heading"
              className="text-2xl font-semibold tracking-tight tabular-nums"
            >
              {formatContestCountdown(days)}
            </h1>
          </CardHeader>
          <CardContent className="px-5">
            <p className="text-sm text-muted-foreground">
              {formatContestDate()} · {CONTEST_LOCATION}
            </p>
          </CardContent>
        </Card>
      </section>

      {children}

      <section aria-label="Bereiche" className="grid gap-3 sm:grid-cols-3">
        {sections.map(({ to, title, description, icon: Icon, track }) => (
          <Link
            key={to}
            to={to}
            data-track={track}
            className="group rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Card className="h-full gap-2 py-4 transition-colors group-hover:bg-accent/40 group-active:bg-accent/60">
              <CardHeader className="gap-2 px-4">
                <Icon className="size-5 text-primary" aria-hidden="true" />
                <h2 className="font-semibold leading-none">{title}</h2>
              </CardHeader>
              <CardContent className="px-4">
                <p className="text-sm text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
