import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import type * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { TrickFocusMarker, TrickTreeEdge, TrickTreeNode } from "../api";
import { formatPracticedOn, formatSuccessRate } from "../format";
import { layoutTree, missingPrerequisiteSlugs } from "../layout";
import { TrickStatusBadge } from "./TrickStatusBadge";

interface TrickTreeListProps {
  /** Bereits gefilterte (showLocked) Rohdaten, dieselben wie im Graph. */
  nodes: TrickTreeNode[];
  edges: TrickTreeEdge[];
  /** ux.md §7.2, Punkt 3: fokussiert beim Wechsel zur Liste, nicht beim Mount. */
  ref?: React.Ref<HTMLUListElement>;
  /** Fokus-Markierung aus der Empfehlung (design.md §5.3) – optional, solange die Empfehlung noch lädt (AK 10). */
  focus?: TrickFocusMarker;
}

/**
 * Gleiche Reihenfolge wie die Graph-Ebenen (Ticket, Abschnitt "Liste"):
 * `layoutTree()` sortiert bereits nach goalOrder/difficulty/slug innerhalb
 * jeder Ebene, also reicht es, seine Positionen nach y dann x zu ordnen –
 * keine zweite Sortier-Implementierung nötig.
 */
function orderedSlugs(nodes: TrickTreeNode[], edges: TrickTreeEdge[]): string[] {
  return layoutTree(nodes, edges)
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((position) => position.slug);
}

/** Barrierefreie Alternative zum Graphen (Ticket, Abschnitt "Liste") – derselbe Datensatz als `<ul>`. */
export function TrickTreeList({ nodes, edges, ref, focus }: TrickTreeListProps) {
  const nodeBySlug = new Map(nodes.map((node) => [node.slug, node]));
  const order = orderedSlugs(nodes, edges);

  return (
    <ul
      ref={ref}
      tabIndex={-1}
      aria-label="Trick-Tree als Liste"
      className="space-y-2 outline-none"
    >
      {order.map((slug) => {
        const node = nodeBySlug.get(slug);
        if (node === undefined) {
          return null;
        }
        const missingSlugs = missingPrerequisiteSlugs(slug, nodes, edges);
        const missingNames = missingSlugs
          .map((missingSlug) => nodeBySlug.get(missingSlug)?.name ?? missingSlug)
          .join(", ");
        const isFocused = focus?.focusSlugs.has(slug) ?? false;
        const isPrimary = focus?.primarySlug === slug;

        return (
          <li key={slug}>
            <Link
              to="/tricks/$slug"
              params={{ slug }}
              data-track="tricks.open-detail"
              className="block min-h-11 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <Card
                className={`gap-1 py-4 transition-colors hover:bg-accent/40 active:bg-accent/60 ${
                  isFocused ? "ring-2 ring-primary" : ""
                }`}
              >
                <CardContent className="space-y-1 px-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 font-medium">
                      {node.name}
                      {isFocused && (
                        <ArrowUpRight aria-hidden="true" className="size-3.5 text-primary" />
                      )}
                    </span>
                    <TrickStatusBadge status={node.status} />
                  </div>
                  {isPrimary && <Badge variant="outline">Als Nächstes</Badge>}
                  <p className="text-sm text-muted-foreground">
                    {formatSuccessRate(node.landedTotal, node.attemptsTotal)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatPracticedOn(node.lastPracticedOn ?? null)}
                  </p>
                  {missingSlugs.length > 0 && (
                    <p className="text-sm text-muted-foreground">{`Braucht noch: ${missingNames}`}</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
