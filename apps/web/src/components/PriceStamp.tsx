import { formatQuoteTime, formatQuoteTimestamp } from "../lib/format";

const SYNTHETIC_TITLE =
  "Upstream price feed unavailable — this value is simulated, not a real market print";

interface Props {
  /**
   * When the price was struck: an ISO instant for live quotes, or a plain
   * calendar date for series that only publish daily.
   */
  at: string | null | undefined;
  /** Optional lead-in for date-only stamps, e.g. "As of". */
  prefix?: string;
  /**
   * True when the price above is fabricated fallback data. Such a value is
   * generated at request time, so its "timestamp" would read as this
   * instant — the most misleading stamp possible. Say what it is instead.
   */
  synthetic?: boolean;
}

/**
 * The "as of" line rendered directly under a price. Every price in the
 * terminal carries one so a stale quote is never mistaken for a live tick —
 * the short label sits under the number, the full timestamp is in the
 * tooltip.
 */
export function PriceStamp({ at, prefix, synthetic }: Props) {
  if (synthetic) {
    return (
      <div className="price-updated price-updated-synthetic" title={SYNTHETIC_TITLE}>
        simulated
      </div>
    );
  }
  if (!at) return <div className="price-updated">—</div>;
  return (
    <div className="price-updated" title={`As of ${formatQuoteTimestamp(at)}`}>
      {prefix ? `${prefix} ` : ""}
      {formatQuoteTime(at)}
    </div>
  );
}
