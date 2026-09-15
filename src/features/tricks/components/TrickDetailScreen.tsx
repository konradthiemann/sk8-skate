import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ApiRequestError,
  fetchTrickDetail,
  type TrickDetailResponse,
  type TrickHistoryEntry,
  type TrickRefView,
  trickKeys,
} from "../api";
import { formatCategory, formatDateOrDash, formatRatePercent } from "../format";
import { trickTreeSearchSchema } from "../schema";
import { SuccessRateChart } from "./SuccessRateChart";
import { TrickHistoryTable } from "./TrickHistoryTable";
import { TrickStatusBadge } from "./TrickStatusBadge";

const DEFAULT_TRICK_TREE_SEARCH = trickTreeSearchSchema.parse({});

/** Aufsteigend nach Datum (design.md §3) – die API liefert "neuestes zuerst" (schema.d.ts:799). */
function sortHistoryAscending(history: TrickHistoryEntry[]): TrickHistoryEntry[] {
  return [...history].sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
}

interface NumberTileProps {
  label: string;
  value: string;
}

function NumberTile({ label, value }: NumberTileProps) {
  return (
    <div className="flex min-h-11 flex-col justify-center gap-0.5 border-b px-3 py-2 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

interface TrickRefListProps {
  heading: string;
  emptyText: string;
  refs: TrickRefView[];
  dataTrack: string;
}

function TrickRefList({ heading, emptyText, refs, dataTrack }: TrickRefListProps) {
  return (
    <section className="space-y-2">
      <h2 className="font-semibold">{heading}</h2>
      {refs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {refs.map((ref) => (
            <li key={ref.slug}>
              <Link
                to="/tricks/$slug"
                params={{ slug: ref.slug }}
                data-track={dataTrack}
                className="flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className="font-medium">{ref.name}</span>
                <TrickStatusBadge status={ref.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Orchestriert Zustände und Aufbau der Detailseite (Ticket, Abschnitt "Detailseite"). */
export function TrickDetailScreen() {
  const { slug } = useParams({ from: "/tricks/$slug" });
  const query = useQuery({
    queryKey: trickKeys.detail(slug),
    queryFn: () => fetchTrickDetail(slug),
  });

  const notFound =
    query.isError && query.error instanceof ApiRequestError && query.error.status === 404;

  return (
    <section className="space-y-4">
      <Link
        to="/tricks"
        search={DEFAULT_TRICK_TREE_SEARCH}
        data-track="tricks.detail-back"
        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        <span aria-hidden="true">← </span>
        Zum Trick-Tree
      </Link>

      {query.isLoading && (
        <div role="status" aria-busy="true" aria-label="Trick wird geladen" className="space-y-2">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      )}

      {notFound && (
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Diesen Trick gibt es nicht</h1>
          <p className="text-sm text-muted-foreground">
            Vielleicht hat sich der Link geändert. Geh zurück zum Trick-Tree.
          </p>
        </div>
      )}

      {query.isError && !notFound && (
        <Alert variant="destructive">
          <AlertTitle>Der Trick lädt gerade nicht</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>Prüf deine Verbindung und versuch es noch einmal.</p>
            <Button
              type="button"
              variant="outline"
              data-track="tricks.detail-retry"
              onClick={() => query.refetch()}
            >
              Erneut versuchen
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {query.isSuccess && <TrickDetailContent trick={query.data} />}
    </section>
  );
}

interface TrickDetailContentProps {
  trick: TrickDetailResponse;
}

function TrickDetailContent({ trick }: TrickDetailContentProps) {
  const ascendingHistory = sortHistoryAscending(trick.history);
  const hasDescription = trick.description !== null && trick.description !== undefined;
  const hasChart = ascendingHistory.length >= 2;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{trick.name}</h1>
        <TrickStatusBadge status={trick.progress.status} />
        <p className="text-sm text-muted-foreground">
          {formatCategory(trick.category)} · Schwierigkeit {trick.difficulty} von 10
        </p>
        {trick.isGoal && trick.goalOrder !== null && trick.goalOrder !== undefined && (
          <p className="text-sm text-muted-foreground">Ziel {trick.goalOrder} von 7</p>
        )}
      </div>

      {hasDescription && <p className="text-sm">{trick.description}</p>}

      <div className="grid grid-cols-2 divide-x rounded-lg border">
        <div className="divide-y">
          <NumberTile label="Versuche" value={String(trick.progress.attemptsTotal)} />
          <NumberTile label="Quote gesamt" value={formatRatePercent(trick.progress.successRate)} />
          <NumberTile
            label="Erste Landung"
            value={formatDateOrDash(trick.progress.firstLandedOn)}
          />
        </div>
        <div className="divide-y">
          <NumberTile label="Treffer" value={String(trick.progress.landedTotal)} />
          <NumberTile
            label="Quote der letzten Einheiten"
            value={formatRatePercent(trick.progress.recentSuccessRate)}
          />
          <NumberTile
            label="Zuletzt geübt"
            value={formatDateOrDash(trick.progress.lastPracticedOn)}
          />
        </div>
      </div>

      <TrickRefList
        heading="Setzt voraus"
        emptyText="Dieser Trick hat keine Voraussetzung."
        refs={trick.requires}
        dataTrack="tricks.detail-prerequisite"
      />

      <TrickRefList
        heading="Schaltet frei"
        emptyText="Dieser Trick schaltet nichts frei."
        refs={trick.unlocks}
        dataTrack="tricks.detail-unlock"
      />

      <section className="space-y-2">
        <h2 className="font-semibold">Verlauf</h2>
        {ascendingHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Einheit mit diesem Trick erfasst.
          </p>
        ) : (
          <div className="space-y-3">
            {hasChart && (
              <SuccessRateChart history={ascendingHistory} masteryRate={trick.policy.masteryRate} />
            )}
            <TrickHistoryTable history={ascendingHistory} />
          </div>
        )}
      </section>
    </div>
  );
}
