/**
 * Shared number and timestamp formatting.
 *
 * Every panel used to carry its own copy of these helpers, which is how the
 * terminal ended up showing prices with an "as of" stamp on some screens and
 * bare, undated prices on others. Import from here instead so a price and its
 * timestamp look the same wherever they are rendered.
 */

/** Red/green/neutral class for a signed value. Null (no data) reads neutral. */
export function pctClass(value: number | null | undefined): string {
  if (value == null || value === 0) return "pct-flat";
  return value > 0 ? "pct-up" : "pct-down";
}

/** "+1.23%" / "-1.23%" / "0.00%". */
export function formatSignedPct(value: number, decimals = 2): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

/** "+1.23" / "-1.23" — a signed level change with no unit. */
export function formatSigned(value: number, decimals = 2): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}`;
}

/** A plain calendar date, e.g. "2026-08-06", as daily series report it. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Short "as of" stamp for a price.
 *
 * Today's ticks show the time alone ("16:30"); anything older also carries
 * its date ("29 Aug 16:30"), so a Friday close can't be misread as having
 * printed this morning. Values that aren't parseable instants — a plain
 * calendar date, or a pre-formatted string from an upstream snapshot — are
 * passed through untouched.
 */
export function formatQuoteTime(at: string): string {
  if (DATE_ONLY.test(at)) return at;
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return at;
  const time = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (isSameDay(date, new Date())) return time;
  const day = date.toLocaleDateString([], { day: "2-digit", month: "short" });
  return `${day} ${time}`;
}

/** Full local timestamp, for the tooltip behind a short stamp. */
export function formatQuoteTimestamp(at: string): string {
  if (DATE_ONLY.test(at)) return at;
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return at;
  return date.toLocaleString();
}
