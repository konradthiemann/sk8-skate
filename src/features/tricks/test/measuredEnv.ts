/**
 * jsdom reports 0 for `offsetWidth`/`offsetHeight` and has no `ResizeObserver`
 * (Ticket T-0203, section "Testumgebung xyflow"). `@xyflow/react` measures its
 * container before it places a single node, so without this stub it renders
 * an empty canvas in every test - not a bug in the component, a gap in jsdom.
 * `T-0204` reuses this same helper for Recharts, which has the identical
 * measurement problem.
 *
 * `getBoundingClientRect()` also always reports zero in jsdom, and Recharts'
 * `ResponsiveContainer` reads its *initial* size from exactly that call (its
 * `ResizeObserver` callback only fires on a real resize, which our stub above
 * never triggers) - without stubbing it too, `SuccessRateChart` would mount
 * successfully but draw nothing (T-0204 addition; `@xyflow/react` never
 * needed this because it only reads `offsetWidth`/`offsetHeight`).
 *
 * Only `TrickTreeGraph.test.tsx` and `SuccessRateChart.test.tsx` need this:
 * every other assertion about trick content runs through the list view or
 * `TrickHistoryTable`, which need no such trick.
 */
export function installMeasuredEnv(width = 800, height = 600): () => void {
  const originalWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
  const originalHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
  const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
  const originalResizeObserver = globalThis.ResizeObserver;

  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    value: width,
  });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    value: height,
  });
  Element.prototype.getBoundingClientRect = () => ({
    width,
    height,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON() {},
  });

  class StubResizeObserver implements ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = StubResizeObserver;

  return function restoreMeasuredEnv() {
    if (originalWidth) {
      Object.defineProperty(HTMLElement.prototype, "offsetWidth", originalWidth);
    }
    if (originalHeight) {
      Object.defineProperty(HTMLElement.prototype, "offsetHeight", originalHeight);
    }
    Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    globalThis.ResizeObserver = originalResizeObserver;
  };
}
