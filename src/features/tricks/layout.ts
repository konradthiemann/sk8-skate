/**
 * Reine Graph-Topologie-Funktionen auf `nodes`/`edges` (design.md §5.5): kein
 * DOM, keine Bibliothek, testbar wie normale Funktionen. `layoutTree()`
 * berechnet Positionen für `TrickTreeGraph`, `missingPrerequisiteSlugs()`
 * liefert die Datengrundlage für den Listentext "Braucht noch: {namen}".
 */

export interface TrickTreeLayoutNode {
  slug: string;
  goalOrder?: number | null;
  difficulty: number;
  status: string;
}

export interface TrickTreeLayoutEdge {
  /** Slug der Voraussetzung. */
  from: string;
  /** Slug des abhängigen Tricks. */
  to: string;
}

export interface TrickTreePosition {
  slug: string;
  x: number;
  y: number;
}

const NODE_WIDTH = 200;
const NODE_HEIGHT = 80;
const GAP_X = 40;
const GAP_Y = 60;

function buildPrerequisitesBySlug(edges: readonly TrickTreeLayoutEdge[]): Map<string, string[]> {
  const prerequisitesBySlug = new Map<string, string[]>();
  for (const edge of edges) {
    const prerequisites = prerequisitesBySlug.get(edge.to) ?? [];
    prerequisites.push(edge.from);
    prerequisitesBySlug.set(edge.to, prerequisites);
  }
  return prerequisitesBySlug;
}

/**
 * `depth(trick)` = 0 ohne Voraussetzung, sonst `1 + max(depth(Voraussetzungen))`,
 * iterativ berechnet. Die Schleife läuft höchstens so oft, wie es Knoten
 * gibt – ein Zyklus (fachlich unmöglich laut EPIC-01, aber defensiv
 * abgesichert) wächst dadurch pro Runde weiter, statt die Funktion hängen zu
 * lassen, und landet am Ende automatisch auf der nächsthöheren Ebene.
 */
function computeDepths(
  nodes: readonly TrickTreeLayoutNode[],
  prerequisitesBySlug: Map<string, string[]>,
): Map<string, number> {
  const depths = new Map<string, number>(nodes.map((node) => [node.slug, 0]));

  for (let iteration = 0; iteration < nodes.length; iteration += 1) {
    let changed = false;
    for (const node of nodes) {
      const prerequisites = prerequisitesBySlug.get(node.slug);
      if (prerequisites === undefined || prerequisites.length === 0) {
        continue;
      }
      const deepestPrerequisite = Math.max(...prerequisites.map((slug) => depths.get(slug) ?? 0));
      const newDepth = deepestPrerequisite + 1;
      if (newDepth !== depths.get(node.slug)) {
        depths.set(node.slug, newDepth);
        changed = true;
      }
    }
    if (!changed) {
      break;
    }
  }

  return depths;
}

/** goalOrder zuerst (aufsteigend, leere zuletzt), dann difficulty, dann slug. */
function compareWithinLevel(a: TrickTreeLayoutNode, b: TrickTreeLayoutNode): number {
  const aGoalOrder = a.goalOrder ?? null;
  const bGoalOrder = b.goalOrder ?? null;
  if (aGoalOrder !== null && bGoalOrder !== null) {
    return aGoalOrder - bGoalOrder;
  }
  if (aGoalOrder !== null) {
    return -1;
  }
  if (bGoalOrder !== null) {
    return 1;
  }
  if (a.difficulty !== b.difficulty) {
    return a.difficulty - b.difficulty;
  }
  return a.slug.localeCompare(b.slug);
}

/**
 * Ordnet jeden Trick eine Ebene unter seiner tiefsten Voraussetzung an
 * (Ticket, Abschnitt "Anordnung"). Rein und deterministisch: zwei Aufrufe mit
 * denselben Eingaben liefern identische Positionen.
 */
export function layoutTree(
  nodes: readonly TrickTreeLayoutNode[],
  edges: readonly TrickTreeLayoutEdge[],
): TrickTreePosition[] {
  const prerequisitesBySlug = buildPrerequisitesBySlug(edges);
  const depths = computeDepths(nodes, prerequisitesBySlug);

  const nodesByDepth = new Map<number, TrickTreeLayoutNode[]>();
  for (const node of nodes) {
    const depth = depths.get(node.slug) ?? 0;
    const group = nodesByDepth.get(depth) ?? [];
    group.push(node);
    nodesByDepth.set(depth, group);
  }

  const positions: TrickTreePosition[] = [];
  for (const [depth, group] of nodesByDepth) {
    const sorted = [...group].sort(compareWithinLevel);
    sorted.forEach((node, index) => {
      positions.push({
        slug: node.slug,
        x: index * (NODE_WIDTH + GAP_X),
        y: depth * (NODE_HEIGHT + GAP_Y),
      });
    });
  }

  return positions;
}

/**
 * Voraussetzungen eines Tricks, die noch nicht "sitzt" sind (design.md §5.5,
 * Vertragslücke aus §3: `TrickTreeNode` selbst trägt keine
 * `missingPrerequisites`-Liste).
 */
export function missingPrerequisiteSlugs(
  slug: string,
  nodes: readonly TrickTreeLayoutNode[],
  edges: readonly TrickTreeLayoutEdge[],
): string[] {
  const statusBySlug = new Map(nodes.map((node) => [node.slug, node.status]));
  const prerequisiteSlugs = edges.filter((edge) => edge.to === slug).map((edge) => edge.from);
  return prerequisiteSlugs.filter(
    (prerequisiteSlug) => statusBySlug.get(prerequisiteSlug) !== "sitzt",
  );
}
