import { type Edge, MarkerType, type Node, type NodeProps, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TrickFocusMarker, TrickTreeEdge, TrickTreeNode } from "../api";
import { layoutTree } from "../layout";
import { TrickStatusBadge } from "./TrickStatusBadge";

/**
 * `@xyflow/react`s `useResizeHandler` ruft in einem `useEffect` unbedingt
 * `new ResizeObserver(...)` auf, ohne `typeof`-Absicherung. Echte Browser
 * kennen `ResizeObserver` alle; ein minimaler No-Op-Fallback schützt nur die
 * Umgebungen, die es nicht tun (u. a. jsdom in Tests ohne
 * `installMeasuredEnv()`, siehe `test/measuredEnv.ts`) – ohne ihn würde jedes
 * Mounten dieser Komponente dort die komplette Seite über eine
 * Error-Boundary zum Absturz bringen. Siehe impl.md "Abweichungen".
 */
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class NoopResizeObserver implements ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

interface TrickTreeGraphProps {
  /** Bereits gefilterte (showLocked) Rohdaten – der Graph berechnet sein Layout selbst. */
  nodes: TrickTreeNode[];
  edges: TrickTreeEdge[];
  /** Fokus-Markierung aus der Empfehlung (design.md §5.3) – optional, solange die Empfehlung noch lädt (AK 10). */
  focus?: TrickFocusMarker;
}

interface TrickNodeData extends Record<string, unknown> {
  slug: string;
  name: string;
  status: string;
  isFocused: boolean;
  isPrimary: boolean;
}

/**
 * Plain `<a>` statt TanStack Routers `<Link>`: `TrickTreeGraph.test.tsx`
 * rendert diese Komponente ohne `RouterProvider` (tests.md pins genau diesen
 * Vertrag), und `<Link>` wirft dort synchron
 * ("useRouter must be used inside a <RouterProvider>"), weil `@xyflow/react`
 * Knoten in einem eigenen internen Kontext rendert. Ein einfaches `href`
 * navigiert weiterhin zur Detailseite, nur ohne TanStack Routers
 * Client-seitiges Preloading. Siehe impl.md "Abweichungen".
 *
 * Eigenes Symbol statt `Target` für die Fokus-Markierung (ux.md §7.4):
 * `TRICK_STATUS_META.uebe.icon` ist bereits `Target` – ein Fokus-Trick mit
 * Status "uebe" hätte sonst zwei `Target`-Icons mit unterschiedlicher
 * Bedeutung auf demselben Knoten.
 */
function TrickNode({ data }: NodeProps<Node<TrickNodeData>>) {
  return (
    <a
      href={`/tricks/${data.slug}`}
      data-track="tricks.open-detail"
      className={`relative flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg border bg-card px-3 py-2 text-center shadow-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
        data.isFocused ? "ring-2 ring-primary" : ""
      }`}
    >
      {data.isFocused && (
        <ArrowUpRight aria-hidden="true" className="absolute top-1 right-1 size-3.5 text-primary" />
      )}
      <span className="text-sm font-medium">{data.name}</span>
      <TrickStatusBadge status={data.status} />
      {data.isPrimary && <Badge variant="outline">Als Nächstes</Badge>}
    </a>
  );
}

const nodeTypes = { trick: TrickNode };

/**
 * `<ReactFlow>`-Wrapper (Ticket, Abschnitt "Graph"). Bekommt die
 * Rohdaten und berechnet Positionen intern über `layoutTree()` – die
 * Anordnung ist eine Eigenschaft des Graphen, nicht des aufrufenden Screens.
 */
export function TrickTreeGraph({ nodes, edges, focus }: TrickTreeGraphProps) {
  const positions = layoutTree(nodes, edges);
  const positionBySlug = new Map(positions.map((position) => [position.slug, position]));

  const flowNodes: Node<TrickNodeData>[] = nodes.map((node) => ({
    id: node.slug,
    type: "trick",
    position: positionBySlug.get(node.slug) ?? { x: 0, y: 0 },
    data: {
      slug: node.slug,
      name: node.name,
      status: node.status,
      isFocused: focus?.focusSlugs.has(node.slug) ?? false,
      isPrimary: focus?.primarySlug === node.slug,
    },
  }));

  const flowEdges: Edge[] = edges.map((edge) => ({
    id: `${edge.from}->${edge.to}`,
    source: edge.from,
    target: edge.to,
    markerEnd: { type: MarkerType.ArrowClosed },
  }));

  return (
    // Ein <section> mit Accessible Name bekommt implizit role="region"
    // (WAI-ARIA) - das erfüllt Ticket + ux.md 3.2 ohne role/div.
    <section
      aria-label="Trick-Tree als Karte"
      style={{ height: "70dvh" }}
      className="overflow-hidden rounded-lg border"
    >
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        fitView
        minZoom={0.4}
        maxZoom={1.6}
        panOnScroll
      />
    </section>
  );
}
