import { describe, expect, it } from "vitest";
import { calculateCollectionVirtualWindow } from "../useCollectionVirtualWindow";

describe("calculateCollectionVirtualWindow", () => {
  it("keeps the first rows selected while the result region is below the viewport", () => {
    expect(calculateCollectionVirtualWindow({
      totalRows: 1000,
      rowHeight: 56,
      overscan: 8,
      viewportHeight: 700,
      scrollTop: 200,
      rowsStart: 900,
    })).toEqual({ start: 0, end: 29, viewportHeight: 700, rowScrollTop: 0 });
  });

  it("converts collection-page scroll offsets into row offsets", () => {
    expect(calculateCollectionVirtualWindow({
      totalRows: 1000,
      rowHeight: 56,
      overscan: 8,
      viewportHeight: 700,
      scrollTop: 6500,
      rowsStart: 900,
    })).toEqual({ start: 92, end: 121, viewportHeight: 700, rowScrollTop: 5600 });
  });

  it("recalculates the visible window when the collection viewport changes size", () => {
    const short = calculateCollectionVirtualWindow({
      totalRows: 1000,
      rowHeight: 56,
      overscan: 8,
      viewportHeight: 280,
      scrollTop: 3700,
      rowsStart: 900,
    });
    const tall = calculateCollectionVirtualWindow({
      totalRows: 1000,
      rowHeight: 56,
      overscan: 8,
      viewportHeight: 700,
      scrollTop: 3700,
      rowsStart: 900,
    });

    expect(short.start).toBe(tall.start);
    expect(tall.end).toBeGreaterThan(short.end);
    expect(short.rowScrollTop).toBe(tall.rowScrollTop);
  });

  it("returns an empty window for an empty result set", () => {
    expect(calculateCollectionVirtualWindow({
      totalRows: 0,
      rowHeight: 56,
      overscan: 8,
      viewportHeight: 700,
      scrollTop: 5000,
      rowsStart: 900,
    })).toEqual({ start: 0, end: 0, viewportHeight: 700, rowScrollTop: 0 });
  });
});
