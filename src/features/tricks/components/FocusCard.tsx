import { Info, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { TrickRecommendationResponse } from "../api";
import { formatDosage } from "../format";
import { TrickStatusBadge } from "./TrickStatusBadge";

interface FocusCardProps {
  recommendation: TrickRecommendationResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  /**
   * Vorgehalten für Symmetrie mit `TrickDetailScreen`s eigenem, sichtbaren
   * Retry-Button, falls ein künftiges Ticket doch einen ergänzt – ux.md §3.3
   * verlangt hier bewusst KEINEN sichtbaren "Erneut versuchen"-Button (Retry
   * käme mit dem nächsten Öffnen von `/tricks` ohnehin zurück), deshalb bleibt
   * diese Prop ungenutzt.
   */
  onRetry: () => void;
}

/**
 * Rein darstellend, keine eigene Datenladung (design.md §5.4) – die
 * Empfehlung kommt fertig geladen von `TrickTreeScreen`.
 */
// `onRetry` bleibt Teil des gepinnten Props-Vertrags (design.md §5.4, tests.md
// Ambiguität 2), aber ux.md §3.3 verlangt keinen sichtbaren Button, der ihn
// aufruft - deshalb hier nur entgegengenommen (Unterstrich für
// `noUnusedParameters`), nicht verwendet.
export function FocusCard({
  recommendation,
  isLoading,
  isError,
  onRetry: _onRetry,
}: FocusCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Skeleton className="h-40 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const pauseHint = recommendation?.pauseHint ?? null;
  const primary = recommendation?.primary ?? null;
  const secondary = recommendation?.secondary ?? [];

  return (
    <Card>
      <CardContent className="space-y-4">
        {pauseHint !== null && (
          <Alert variant={pauseHint.code === "knee_pain" ? "destructive" : "default"}>
            {pauseHint.code === "knee_pain" ? (
              <TriangleAlert aria-hidden="true" />
            ) : (
              <Info aria-hidden="true" />
            )}
            <AlertDescription>{pauseHint.message}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <h2 className="font-semibold">Das übst du als Nächstes</h2>

          {isError && (
            <p className="text-sm text-muted-foreground">Die Empfehlung lädt gerade nicht.</p>
          )}

          {!isError && primary === null && (
            <p className="text-sm text-muted-foreground">
              Gerade ist kein Trick offen. Schau in den Baum, was noch gesperrt ist.
            </p>
          )}

          {!isError && primary !== null && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <a
                  href={`/tricks/${primary.slug}`}
                  data-track="tricks.focus-open"
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {primary.name}
                </a>
                <TrickStatusBadge status={primary.status} />
              </div>
              <p className="text-sm text-muted-foreground">{primary.reason}</p>
              <p className="text-sm text-muted-foreground">{formatDosage(primary.dosage)}</p>

              {secondary.length > 0 && (
                <div className="space-y-1 pt-1">
                  <p className="text-sm font-medium">Danach dran:</p>
                  <ul className="space-y-1">
                    {secondary.map((suggestion) => (
                      <li key={suggestion.slug}>
                        <a
                          href={`/tricks/${suggestion.slug}`}
                          data-track="tricks.focus-secondary-open"
                          className="text-sm underline-offset-4 hover:underline"
                        >
                          {suggestion.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
