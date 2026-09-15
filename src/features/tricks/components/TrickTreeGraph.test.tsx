import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { trickTreeNode } from "../test/handlers";
import { installMeasuredEnv } from "../test/measuredEnv";
import { TrickTreeGraph } from "./TrickTreeGraph";

/*
 * Smoke test only (Ticket-Testtabelle: "Ein Rauchtest ... rendert ... die
 * erwartete Knotenzahl"). Every content assertion (status, filtering,
 * navigation) lives in TrickTreeScreen.test.tsx via the list view, which
 * needs no environment trick.
 *
 * Contract pinned here (design.md leaves TrickTreeGraph's exact props to the
 * implementer, describing only what it renders): it receives the
 * already-filtered (showLocked) `nodes`/`edges` straight from the API shape
 * and computes its own layout via `layoutTree()` internally - the screen
 * does not pre-compute positions itself, matching the sequence diagram's
 * "S->>U: <TrickTreeGraph> rendert Knoten/Kanten" step.
 *
 *   interface TrickTreeGraphProps { nodes: TrickTreeNode[]; edges: TrickTreeEdge[] }
 *
 * `@xyflow/react` needs jsdom's `offsetWidth`/`offsetHeight` and a
 * `ResizeObserver` to measure its container before it places any node
 * (Ticket, section "Testumgebung xyflow") - `installMeasuredEnv()` supplies
 * both.
 */

describe("TrickTreeGraph", () => {
  let restoreMeasuredEnv: () => void;

  beforeEach(() => {
    restoreMeasuredEnv = installMeasuredEnv();
  });

  afterEach(() => {
    restoreMeasuredEnv();
  });

  it("renders one @xyflow/react node per trick", () => {
    const nodes = [
      trickTreeNode({ slug: "ollie", name: "Ollie", status: "sitzt" }),
      trickTreeNode({ slug: "50-50", name: "50-50", status: "uebe" }),
      trickTreeNode({ slug: "boardslide", name: "Boardslide", status: "gesperrt" }),
    ];
    const edges = [{ from: "ollie", to: "boardslide" }];

    const { container } = render(<TrickTreeGraph nodes={nodes} edges={edges} />);

    expect(container.querySelectorAll(".react-flow__node")).toHaveLength(3);
  });

  it("renders no nodes for an empty tree instead of crashing", () => {
    const { container } = render(<TrickTreeGraph nodes={[]} edges={[]} />);

    expect(container.querySelectorAll(".react-flow__node")).toHaveLength(0);
  });
});
