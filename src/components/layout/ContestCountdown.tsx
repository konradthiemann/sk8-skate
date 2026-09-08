import { Badge } from "@/components/ui/badge";
import { useNow } from "@/hooks/useNow";
import {
  CONTEST_LOCATION,
  daysUntilContest,
  formatContestCountdownShort,
  formatContestDate,
} from "@/lib/contest";

/** Compact "Noch N Tage" badge for the header. */
export function ContestCountdown() {
  const now = useNow();
  const days = daysUntilContest(now);

  return (
    <Badge
      variant="secondary"
      className="tabular-nums"
      title={`${formatContestDate()} · ${CONTEST_LOCATION}`}
    >
      {formatContestCountdownShort(days)}
    </Badge>
  );
}
