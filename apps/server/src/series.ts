import type { PriceBar } from "@ruff-term/shared";

/** The subset of a bar these helpers need, so callers can pass either a full
 * PriceBar or a trimmed projection of one. */
type CloseBar = Pick<PriceBar, "time" | "close">;

/** Percentage change from `from` to `to`, rounded to 2dp. A zero or missing
 * base yields 0 rather than Infinity. */
export function pctChange(from: number, to: number): number {
  if (!from) return 0;
  return Math.round(((to - from) / from) * 10000) / 100;
}

/** Last bar strictly before `cutoffSeconds`, from ascending-sorted bars. */
export function baseBefore<T extends CloseBar>(
  bars: T[],
  cutoffSeconds: number,
): T | null {
  let base: T | null = null;
  for (const bar of bars) {
    if (bar.time < cutoffSeconds) base = bar;
    else break;
  }
  return base;
}

/** `baseBefore`, falling back to the oldest bar when the window predates the
 * series — every caller wanted this, and several spelled it out inline. */
export function baseBeforeOrFirst<T extends CloseBar>(
  bars: T[],
  cutoffSeconds: number,
): T {
  return baseBefore(bars, cutoffSeconds) ?? bars[0];
}

const DAY_MS = 86_400_000;

/** Unix seconds `days` before now, for use as a `baseBefore` cutoff. */
export function daysAgoSeconds(days: number): number {
  return (Date.now() - days * DAY_MS) / 1000;
}

/** Unix seconds at the start of the current UTC month. */
export function monthStartSeconds(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000;
}

/** Unix seconds at the start of the current UTC year. */
export function yearStartSeconds(): number {
  return Date.UTC(new Date().getUTCFullYear(), 0, 1) / 1000;
}
