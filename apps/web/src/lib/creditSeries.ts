import type { CreditSeriesPoint } from "@ruff-term/shared";

/**
 * Change from the latest point back to the closest point at least `days`
 * earlier — a 1Y change for a 10-year daily series, without needing an exact
 * calendar match (weekends and holidays mean "exactly 365 days ago" rarely
 * lands on a quoted date).
 */
export function changeOverLookback(
  series: CreditSeriesPoint[],
  days: number,
): number | null {
  if (series.length < 2) return null;
  const latest = series[series.length - 1];
  const cutoff = new Date(latest.date).getTime() - days * 86_400_000;
  let reference = series[0];
  for (const point of series) {
    if (new Date(point.date).getTime() > cutoff) break;
    reference = point;
  }
  if (reference === latest) return null;
  return latest.value - reference.value;
}
