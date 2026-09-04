import { describe, expect, it } from "vitest";
import { changeOverLookback } from "./creditSeries";

function series(pairs: Array<[string, number]>) {
  return pairs.map(([date, value]) => ({ date, value }));
}

describe("changeOverLookback", () => {
  it("returns null for fewer than two points", () => {
    expect(changeOverLookback([], 365)).toBeNull();
    expect(changeOverLookback(series([["2026-01-01", 50]]), 365)).toBeNull();
  });

  it("computes change against the closest point at least N days earlier", () => {
    const s = series([
      ["2025-01-01", 100],
      ["2025-06-01", 80],
      ["2026-01-01", 60],
    ]);
    // ~365 days back from 2026-01-01 lands on/near 2025-01-01.
    expect(changeOverLookback(s, 365)).toBe(-40);
  });

  it("falls back to the earliest point when the series is shorter than the lookback", () => {
    const s = series([
      ["2026-08-01", 50],
      ["2026-09-01", 55],
    ]);
    expect(changeOverLookback(s, 365)).toBe(5);
  });

  it("returns null when the only candidate reference point is the latest point itself", () => {
    const s = series([["2026-09-01", 42]]);
    expect(changeOverLookback(s, 365)).toBeNull();
  });
});
