import { describe, expect, it } from "vitest";
import { layoutTree, missingPrerequisiteSlugs } from "./layout";

/*
 * `layoutTree()`/`missingPrerequisiteSlugs()` contract this test pins down
 * (design.md §5.2/§5.5 describe the algorithm in prose and pseudocode, not an
 * exact TypeScript signature):
 *
 *   interface LayoutNode { slug: string; goalOrder: number | null; difficulty: number; status: string }
 *   interface LayoutEdge { from: string; to: string } // from = prerequisite, to = dependent
 *   interface TreePosition { slug: string; x: number; y: number }
 *
 *   layoutTree(nodes: LayoutNode[], edges: LayoutEdge[]): TreePosition[]
 *   missingPrerequisiteSlugs(slug: string, nodes: LayoutNode[], edges: LayoutEdge[]): string[]
 *
 * Both pure functions, no DOM. `nodes` mirrors the subset of `TrickTreeNode`
 * (schema.d.ts) that the algorithm reads, so `TrickTreeScreen` can pass the
 * real API objects straight through without dropping fields.
 */

interface LayoutNode {
  slug: string;
  goalOrder: number | null;
  difficulty: number;
  status: string;
}

interface LayoutEdge {
  from: string;
  to: string;
}

interface TreePosition {
  slug: string;
  x: number;
  y: number;
}

function node(overrides: Partial<LayoutNode> & Pick<LayoutNode, "slug">): LayoutNode {
  return { goalOrder: null, difficulty: 1, status: "bereit", ...overrides };
}

function getPosition(positions: TreePosition[], slug: string): TreePosition {
  const position = positions.find((candidate) => candidate.slug === slug);
  if (position === undefined) {
    throw new Error(`layoutTree() did not return a position for "${slug}"`);
  }
  return position;
}

describe("layoutTree", () => {
  it("Kriterium 11: places every trick one level below its deepest prerequisite, in the specified sort order", () => {
    const nodes: LayoutNode[] = [
      node({ slug: "ollie", goalOrder: 1, difficulty: 1 }),
      node({ slug: "a-trick", goalOrder: null, difficulty: 1 }),
      node({ slug: "b-trick", goalOrder: null, difficulty: 1 }),
      node({ slug: "kickflip", goalOrder: 2, difficulty: 3 }),
      node({ slug: "shuvit", goalOrder: null, difficulty: 3 }),
      node({ slug: "hardflip", goalOrder: null, difficulty: 5 }),
    ];
    const edges: LayoutEdge[] = [
      { from: "ollie", to: "kickflip" },
      { from: "ollie", to: "shuvit" },
      { from: "kickflip", to: "hardflip" },
    ];

    const positions = layoutTree(nodes, edges) as TreePosition[];

    expect(positions).toHaveLength(6);

    // Level 0 (no prerequisites): ollie, a-trick, b-trick share one y.
    const level0Y = getPosition(positions, "ollie").y;
    expect(getPosition(positions, "a-trick").y).toBe(level0Y);
    expect(getPosition(positions, "b-trick").y).toBe(level0Y);

    // Level 1 (depends on ollie): kickflip, shuvit share the next y down.
    const level1Y = getPosition(positions, "kickflip").y;
    expect(getPosition(positions, "shuvit").y).toBe(level1Y);
    expect(level1Y).toBeGreaterThan(level0Y);

    // Level 2 (depends on kickflip): one more step down, same step size.
    const level2Y = getPosition(positions, "hardflip").y;
    expect(level2Y).toBeGreaterThan(level1Y);
    expect(level2Y - level1Y).toBe(level1Y - level0Y);

    // Sort order within level 0: goalOrder first (ollie), then null-goalOrder
    // tricks by difficulty then slug (a-trick before b-trick).
    expect(getPosition(positions, "ollie").x).toBeLessThan(getPosition(positions, "a-trick").x);
    expect(getPosition(positions, "a-trick").x).toBeLessThan(getPosition(positions, "b-trick").x);

    // Sort order within level 1: kickflip (goalOrder 2) before shuvit (null).
    expect(getPosition(positions, "kickflip").x).toBeLessThan(getPosition(positions, "shuvit").x);
  });

  it("Kriterium 11: two calls with the same input produce identical positions", () => {
    const nodes: LayoutNode[] = [
      node({ slug: "ollie", goalOrder: 1 }),
      node({ slug: "kickflip", goalOrder: 2 }),
    ];
    const edges: LayoutEdge[] = [{ from: "ollie", to: "kickflip" }];

    expect(layoutTree(nodes, edges)).toEqual(layoutTree(nodes, edges));
  });

  it("Kriterium 12: a cycle terminates and still yields a finite position for every node", () => {
    const nodes: LayoutNode[] = [node({ slug: "a" }), node({ slug: "b" })];
    const edges: LayoutEdge[] = [
      { from: "a", to: "b" },
      { from: "b", to: "a" },
    ];

    const positions = layoutTree(nodes, edges) as TreePosition[];

    expect(positions).toHaveLength(2);
    for (const position of positions) {
      expect(Number.isFinite(position.x)).toBe(true);
      expect(Number.isFinite(position.y)).toBe(true);
    }
  });

  it("Kriterium 12: a longer cycle (three nodes) also terminates with one position each", () => {
    const nodes: LayoutNode[] = [node({ slug: "a" }), node({ slug: "b" }), node({ slug: "c" })];
    const edges: LayoutEdge[] = [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
      { from: "c", to: "a" },
    ];

    const positions = layoutTree(nodes, edges) as TreePosition[];

    expect(positions.map((position) => position.slug).sort()).toEqual(["a", "b", "c"]);
  });
});

describe("missingPrerequisiteSlugs", () => {
  it("Kriterium 6: returns only prerequisites that have not reached 'sitzt'", () => {
    const nodes: LayoutNode[] = [
      node({ slug: "ollie", status: "sitzt" }),
      node({ slug: "50-50", status: "uebe" }),
      node({ slug: "boardslide", status: "gesperrt" }),
    ];
    const edges: LayoutEdge[] = [
      { from: "ollie", to: "boardslide" },
      { from: "50-50", to: "boardslide" },
    ];

    expect(missingPrerequisiteSlugs("boardslide", nodes, edges)).toEqual(["50-50"]);
  });

  it("returns an empty list once every prerequisite has landed", () => {
    const nodes: LayoutNode[] = [
      node({ slug: "ollie", status: "sitzt" }),
      node({ slug: "kickflip", status: "sitzt" }),
    ];
    const edges: LayoutEdge[] = [{ from: "ollie", to: "kickflip" }];

    expect(missingPrerequisiteSlugs("kickflip", nodes, edges)).toEqual([]);
  });

  it("returns an empty list for a trick with no prerequisites at all", () => {
    const nodes: LayoutNode[] = [node({ slug: "ollie", status: "bereit" })];

    expect(missingPrerequisiteSlugs("ollie", nodes, [])).toEqual([]);
  });
});
