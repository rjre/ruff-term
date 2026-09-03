import type { VolSurfacePoint } from "@ruff-term/shared";

/**
 * Citi publishes ATM plus 10/25/35-delta strike-quoted vol — seven real
 * quotes per (pair, tenor). `u` puts puts and calls on one increasing axis so
 * they interpolate as a single smooth curve: u = put delta for puts,
 * u = 100 - call delta for calls, u = 50 at the money. That lands each wing's
 * quotes the same distance from 50 on both sides, matching the shape a smile
 * actually has.
 */
export const SMILE_POINTS: Array<{ u: number; label: string; suffix: string }> =
  [
    { u: 10, label: "P10", suffix: "STRIKE_P10" },
    { u: 25, label: "P25", suffix: "STRIKE_P25" },
    { u: 35, label: "P35", suffix: "STRIKE_P35" },
    { u: 50, label: "ATM", suffix: "ATM" },
    { u: 65, label: "C35", suffix: "STRIKE_C35" },
    { u: 75, label: "C25", suffix: "STRIKE_C25" },
    { u: 90, label: "C10", suffix: "STRIKE_C10" },
  ];

/** The drawn ladder: every 5 delta from a 5-delta put to a 5-delta call. */
export const GRID = Array.from({ length: 19 }, (_, i) => (i + 1) * 5);

function secondDerivatives(xs: number[], ys: number[]): number[] {
  const n = xs.length;
  const y2 = new Array<number>(n).fill(0);
  const tmp = new Array<number>(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    const sig = (xs[i] - xs[i - 1]) / (xs[i + 1] - xs[i - 1]);
    const p = sig * y2[i - 1] + 2;
    y2[i] = (sig - 1) / p;
    const du =
      (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]) -
      (ys[i] - ys[i - 1]) / (xs[i] - xs[i - 1]);
    tmp[i] = ((6 * du) / (xs[i + 1] - xs[i - 1]) - sig * tmp[i - 1]) / p;
  }
  for (let i = n - 2; i >= 0; i--) y2[i] = y2[i] * y2[i + 1] + tmp[i];
  return y2;
}

/** Evaluating outside [xs[0], xs.at(-1)] extrapolates along the boundary
 * segment's cubic — which is what the 5-delta wings do. */
function splineAt(xs: number[], ys: number[], y2: number[], x: number): number {
  const n = xs.length;
  let lo: number;
  let hi: number;
  if (x <= xs[0]) {
    [lo, hi] = [0, 1];
  } else if (x >= xs[n - 1]) {
    [lo, hi] = [n - 2, n - 1];
  } else {
    lo = 0;
    hi = n - 1;
    while (hi - lo > 1) {
      const mid = (hi + lo) >> 1;
      if (xs[mid] > x) hi = mid;
      else lo = mid;
    }
  }
  const h = xs[hi] - xs[lo];
  const a = (xs[hi] - x) / h;
  const b = (x - xs[lo]) / h;
  return (
    a * ys[lo] +
    b * ys[hi] +
    (((a ** 3 - a) * y2[lo] + (b ** 3 - b) * y2[hi]) * h * h) / 6
  );
}

export function gridLabel(u: number): string {
  if (u === 50) return "ATM";
  return u < 50 ? `${u}dP` : `${100 - u}dC`;
}

/**
 * Fits a natural cubic spline through whatever quotes came back non-null and
 * reads off the full ladder. Returns an empty array below three quotes —
 * fewer than that describes a line, not a smile.
 */
export function buildCurve(quotes: VolSurfacePoint[]): VolSurfacePoint[] {
  const known = quotes
    .filter((q): q is VolSurfacePoint & { volPct: number } => q.volPct !== null)
    .map((q) => [q.u, q.volPct] as const)
    .sort((a, b) => a[0] - b[0]);
  if (known.length < 3) return [];

  const xs = known.map(([u]) => u);
  const ys = known.map(([, v]) => v);
  const y2 = secondDerivatives(xs, ys);
  const quotedU = new Set(xs);
  const lo = xs[0];
  const hi = xs[xs.length - 1];

  return GRID.map((u) => ({
    u,
    label: gridLabel(u),
    volPct: Math.round(splineAt(xs, ys, y2, u) * 10_000) / 10_000,
    kind: quotedU.has(u)
      ? "quoted"
      : u >= lo && u <= hi
        ? "interpolated"
        : "extrapolated",
  }));
}
