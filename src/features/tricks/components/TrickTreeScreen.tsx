import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  fetchTrickRecommendation,
  fetchTrickTree,
  type TrickFocusMarker,
  type TrickRecommendationResponse,
  trickKeys,
} from "../api";
import { toTrickStatus } from "../status";
import { FocusCard } from "./FocusCard";
import { TrickStatusBadge } from "./TrickStatusBadge";
import { TrickTreeGraph } from "./TrickTreeGraph";
import { TrickTreeList } from "./TrickTreeList";

const LEGEND_STATUSES = ["sitzt", "uebe", "bereit", "gesperrt"] as const;

/** Kaufmännisch gerundet, ohne Nachkommastelle – dieselbe Erfolgsschwelle wie das Backend liefert. */
function formatThresholdHint(masteryRate: number, masterySessions: number): string {
  const rate = Math.round(masteryRate * 100);
  return `Ein Trick gilt als „sitzt“ ab ${rate} % Erfolgsquote über ${masterySessions} Einheiten.`;
}

/**
 * Baut die Fokus-Markierung aus der Empfehlungsantwort (design.md §5.3) –
 * lokal statt exportiert, wie schon `formatThresholdHint()` hier.
 */
function buildFocusMarker(
  recommendation: TrickRecommendationResponse | undefined,
): TrickFocusMarker {
  if (recommendation === undefined) {
    return { focusSlugs: new Set(), primarySlug: null };
  }
  const slugs = [
    recommendation.primary?.slug,
    ...recommendation.secondary.map((s) => s.slug),
  ].filter((slug): slug is string => slug !== undefined);
  return { focusSlugs: new Set(slugs), primarySlug: recommendation.primary?.slug ?? null };
}

/**
 * Orchestriert Zustände (Laden/Fehler/Leer/Erfolg), Kopf, Legende und
 * Ansichtswahl (Ticket, Abschnitt "Aufbau des Screens").
 */
export function TrickTreeScreen() {
  const search = useSearch({ from: "/tricks/" });
  const navigate = useNavigate({ from: "/tricks/" });
  const query = useQuery({ queryKey: trickKeys.tree(), queryFn: fetchTrickTree });
  // AK 10: zwei getrennte Queries, zwei getrennte Fehlerbehandlungen - ein
  // Fehler der Empfehlung darf den Trick-Tree nie mitreißen (design.md §5.4/§6).
  const recommendationQuery = useQuery({
    queryKey: trickKeys.recommendation(),
    queryFn: fetchTrickRecommendation,
  });
  const focus = buildFocusMarker(recommendationQuery.data);

  // ux.md §7.2: die Ansage/der Fokuswechsel gehören an die Stelle, die der
  // Klick ohnehin schon auslöst - kein `useEffect`, der auf `search.view`
  // reagiert (das würde auch bei Zurück-/Vorwärts-Navigation feuern).
  const [announcement, setAnnouncement] = useState("");
  const shouldFocusListRef = useRef(false);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (search.view === "list" && shouldFocusListRef.current) {
      listRef.current?.focus();
      shouldFocusListRef.current = false;
    }
  }, [search.view]);

  function handleViewChange(nextValue: string) {
    // ToggleGroup type="single" (ux.md §4/Wireframe): eine sich gegenseitig
    // ausschließende Wahl ist semantisch ein radiogroup/radio-Paar, kein
    // Werkzeugleisten-Toggle - Radix rendert das nur unter "single" korrekt
    // (role="radiogroup"/"radio" statt role="toolbar"/"button"). Radix ruft
    // onValueChange("") auf, wenn der bereits aktive Eintrag erneut angeklickt
    // wird (Deselektion) - das ignorieren wir, `search.view` bleibt bestehen
    // statt auf keine Ansicht zu fallen.
    if (nextValue !== "graph" && nextValue !== "list") {
      return;
    }
    if (nextValue === "list") {
      shouldFocusListRef.current = true;
    }
    setAnnouncement(nextValue === "list" ? "Ansicht: Liste." : "Ansicht: Karte.");
    navigate({ search: (previous) => ({ ...previous, view: nextValue }) });
  }

  function handleShowLockedChange(checked: boolean) {
    navigate({ search: (previous) => ({ ...previous, showLocked: checked }) });
  }

  const allNodes = query.data?.nodes ?? [];
  const allEdges = query.data?.edges ?? [];
  const visibleNodes = search.showLocked
    ? allNodes
    : allNodes.filter((node) => toTrickStatus(node.status) !== "gesperrt");
  const visibleSlugs = new Set(visibleNodes.map((node) => node.slug));
  const visibleEdges = allEdges.filter(
    (edge) => visibleSlugs.has(edge.from) && visibleSlugs.has(edge.to),
  );

  const isCatalogEmpty = query.isSuccess && allNodes.length === 0;
  const isFilteredEmpty = query.isSuccess && allNodes.length > 0 && visibleNodes.length === 0;
  const showContent = query.isSuccess && visibleNodes.length > 0;

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Trick-Tree</h1>
        <p className="text-sm text-muted-foreground">
          Was sitzt, was dran ist und was danach kommt.
        </p>
      </div>

      {/*
       * ux.md §7.2: die Fokus-Karte steht direkt nach der Überschrift, noch
       * vor Umschalter/Schalter - ein Pausenhinweis oder eine Empfehlung ist
       * dringlicher als die Frage "Karte oder Liste anzeigen".
       */}
      <FocusCard
        recommendation={recommendationQuery.data}
        isLoading={recommendationQuery.isLoading}
        isError={recommendationQuery.isError}
        onRetry={() => recommendationQuery.refetch()}
      />

      {/*
       * Umschalter/Schalter/Schwellenhinweis erscheinen erst mit
       * `query.isSuccess`, nicht unbedingt ab dem ersten Render: Ohne diese
       * Gate würde `screen.findByRole("button", { name: "Karte" })` schon
       * beim allerersten (leeren) Render erfolgreich auflösen (Testing
       * Librarys `waitFor` prüft synchron vor jedem Intervall-Tick), noch
       * bevor die Trick-Tree-Antwort da ist - ein nachfolgender synchroner
       * `getByRole("link", ...)`-Check auf einen Listeneintrag würde dann
       * fehlschlagen. Siehe impl.md "Abweichungen".
       */}
      {query.isSuccess && (
        <div className="space-y-3">
          <ToggleGroup
            type="single"
            value={search.view}
            onValueChange={handleViewChange}
            className="w-full"
          >
            <ToggleGroupItem value="graph" data-track="tricks.view-graph" className="h-11 flex-1">
              Karte
            </ToggleGroupItem>
            <ToggleGroupItem value="list" data-track="tricks.view-list" className="h-11 flex-1">
              Liste
            </ToggleGroupItem>
          </ToggleGroup>

          <div className="flex items-center gap-2">
            <Switch
              id="trick-tree-show-locked"
              checked={search.showLocked}
              onCheckedChange={handleShowLockedChange}
              data-track="tricks.toggle-locked"
            />
            <Label htmlFor="trick-tree-show-locked">Gesperrte zeigen</Label>
          </div>

          <p className="text-sm text-muted-foreground">
            {formatThresholdHint(query.data.policy.masteryRate, query.data.policy.masterySessions)}
          </p>
        </div>
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {query.isLoading && (
        <div
          role="status"
          aria-busy="true"
          aria-label="Trick-Tree wird geladen"
          className="space-y-2"
        >
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      )}

      {query.isError && (
        <Alert variant="destructive">
          <AlertTitle>Der Trick-Tree lädt gerade nicht</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>Prüf deine Verbindung und versuch es noch einmal.</p>
            <Button
              type="button"
              variant="outline"
              data-track="tricks.retry"
              onClick={() => query.refetch()}
            >
              Erneut versuchen
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isCatalogEmpty && (
        <Card>
          <CardHeader className="gap-2">
            <h2 className="font-semibold">Noch kein Trick-Katalog</h2>
            <CardDescription>
              Sobald Tricks angelegt sind, siehst du sie hier als Karte.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {isFilteredEmpty && (
        <p className="text-sm text-muted-foreground">
          Alle Tricks sind ausgeblendet. Blende die gesperrten wieder ein.
        </p>
      )}

      {showContent && (
        <>
          {search.view === "graph" ? (
            <TrickTreeGraph nodes={visibleNodes} edges={visibleEdges} focus={focus} />
          ) : (
            <TrickTreeList ref={listRef} nodes={visibleNodes} edges={visibleEdges} focus={focus} />
          )}

          <div className="space-y-2">
            <h2 className="font-semibold">Legende</h2>
            <div className="flex flex-wrap gap-2">
              {LEGEND_STATUSES.map((status) => (
                <TrickStatusBadge key={status} status={status} />
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
