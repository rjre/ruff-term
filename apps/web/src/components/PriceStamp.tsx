import { formatQuoteTime, formatQuoteTimestamp } from "../lib/format";

interface Props {
  /**
   * When the price was struck: an ISO instant for live quotes, or a plain
   * calendar date for series that only publish daily.
   */
  at: string | null | undefined;
  /** Optional lead-in for date-only stamps, e.g. "As of". */
  prefix?: string;
}

/**
 * The "as of" line rendered directly under a price. Every price in the
 * terminal carries one so a stale quote is never mistaken for a live tick —
 * the short label sits under the number, the full timestamp is in the
 * tooltip.
 */
export function PriceStamp({ at, prefix }: Props) {
  if (!at) return <div className="price-updated">—</div>;
  const label = formatQuoteTime(at);
  return (
    <div className="price-updated" title={`As of ${formatQuoteTimestamp(at)}`}>
      {prefix ? `${prefix} ` : ""}
      {label}
    </div>
  );
}
