import { describe, expect, it } from "vitest";
import type { VolSurfacePoint } from "@ruff-term/shared";
import { GRID, SMILE_POINTS, buildCurve, gridLabel } from "./smile.js";

/** The seven points Citi returned for EUR/USD 1M on 2026-09-03. */
const EURUSD_1M = [6.0457, 5.57166, 5.42404, 5.30844, 5.28448, 5.33192, 5.62027];

function quotes(vols: Array<number | null>): VolSurfacePoint[] {
  return SMILE_POINTS.map((p, i) => ({
    u: p.u,
    label: p.label,
    volPct: vols[i],
    kind: "quoted" as const,
  }));
}

describe("gridLabel", () => {
  it("labels puts, calls and the money", () => {
    expect(gridLabel(10)).toBe("10dP");
    expect(gridLabel(50)).toBe("ATM");
    expect(gridLabel(90)).toBe("10dC");
  });
});

describe("buildCurve", () => {
  it("returns the full 5-delta ladder", () => {
    const curve = buildCurve(quotes(EURUSD_1M));
    expect(curve).toHaveLength(GRID.length);
    expect(curve.map((c) => c.u)).toEqual(GRID);
    expect(curve[0].label).toBe("5dP");
    expect(curve[curve.length - 1].label).toBe("5dC");
  });

  it("reproduces the quoted points exactly", () => {
    const curve = buildCurve(quotes(EURUSD_1M));
    for (const [i, point] of SMILE_POINTS.entries()) {
      const fitted = curve.find((c) => c.u === point.u);
      expect(fitted?.kind).toBe("quoted");
      // A spline interpolates through its knots, so these are the real prints.
      expect(fitted?.volPct).toBeCloseTo(EURUSD_1M[i], 3);
    }
  });

  it("marks points between quotes interpolated and the wings extrapolated", () => {
    const curve = buildCurve(quotes(EURUSD_1M));
    const kind = (u: number) => curve.find((c) => c.u === u)?.kind;
    expect(kind(5)).toBe("extrapolated"); // outside the quoted 10-90 range
    expect(kind(95)).toBe("extrapolated");
    expect(kind(15)).toBe("interpolated");
    expect(kind(50)).toBe("quoted");
  });

  it("keeps EUR/USD's put skew — the wing bid over the money", () => {
    const curve = buildCurve(quotes(EURUSD_1M));
    const at = (u: number) => curve.find((c) => c.u === u)!.volPct!;
    expect(at(50)).toBeLessThan(at(10)); // ATM below the 10d put
    expect(at(50)).toBeLessThan(at(90)); // and below the 10d call
    expect(at(10)).toBeGreaterThan(at(90)); // puts bid over calls
  });

  it("still fits with some quotes missing", () => {
    const curve = buildCurve(quotes([6.05, null, 5.42, 5.31, null, 5.33, null]));
    expect(curve).toHaveLength(GRID.length);
    // The 10d call is now past the last quote, so it extrapolates.
    expect(curve.find((c) => c.u === 90)?.kind).toBe("extrapolated");
  });

  it("refuses to fit a smile from fewer than three quotes", () => {
    expect(buildCurve(quotes([6.05, null, null, 5.31, null, null, null]))).toEqual([]);
    expect(buildCurve(quotes([null, null, null, null, null, null, null]))).toEqual([]);
  });
});
