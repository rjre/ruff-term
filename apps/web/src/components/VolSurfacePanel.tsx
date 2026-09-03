import { useEffect, useState } from "react";
import type { VolSurfaceSnapshot } from "@ruff-term/shared";
import { fetchVolSurface } from "../api/client";
import { PriceStamp } from "./PriceStamp";

const PAIRS = ["EUR/USD", "GBP/USD", "USD/JPY", "XAU/USD"];
const TENORS = ["1W", "1M", "3M", "6M", "1Y"];

interface Loaded {
  /** The pair/tenor these values answer. */
  key: string;
  snapshot: VolSurfaceSnapshot | null;
}

function kindClass(kind: string): string {
  return `vol-cell vol-${kind}`;
}

/**
 * Citi Velocity implied-vol smile: the seven quoted delta points, plus the
 * fitted 5-delta ladder between and just past them.
 *
 * Fetched only when the pair or tenor changes — never polled. Citi meters the
 * underlying endpoint at roughly ten calls per tag for the life of the
 * account, so the server caches each combination to disk for 12 hours and
 * this panel simply asks for it.
 */
export function VolSurfacePanel() {
  const [pair, setPair] = useState(PAIRS[0]);
  const [tenor, setTenor] = useState("1M");
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  const key = `${pair}|${tenor}`;
  const snapshot = loaded?.key === key ? loaded.snapshot : null;
  const loading = loaded?.key !== key;

  useEffect(() => {
    let cancelled = false;
    fetchVolSurface(pair, tenor)
      .then((s) => !cancelled && setLoaded({ key, snapshot: s }))
      .catch(() => !cancelled && setLoaded({ key, snapshot: null }));
    return () => {
      cancelled = true;
    };
  }, [pair, tenor, key]);

  return (
    <>
      <h3 className="section-heading">Implied vol smile</h3>
      <div className="screener-toolbar">
        <label className="guide-select-label" htmlFor="vol-pair">
          Pair
        </label>
        <select
          id="vol-pair"
          className="search-input"
          style={{ maxWidth: 130 }}
          value={pair}
          onChange={(e) => setPair(e.target.value)}
        >
          {PAIRS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <div className="chart-toolbar-group">
          {TENORS.map((t) => (
            <button
              key={t}
              className={`toggle-btn ${t === tenor ? "active" : ""}`}
              onClick={() => setTenor(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {snapshot?.note && <div className="demo-banner">{snapshot.note}</div>}

      {snapshot?.healing && (
        <div className="note-banner">
          <strong>Recovering from the stream.</strong> No further metered call
          can help — the per-tag budget is account-level and does not reset —
          so this tenor's {snapshot.healing.pending.length} outstanding quote
          {snapshot.healing.pending.length === 1 ? " is" : "s are"} subscribed
          on the streaming websocket instead, which is metered separately.
          {snapshot.healing.seeded.length > 0 &&
            ` ${snapshot.healing.seeded.length} already recovered.`}{" "}
          Vol tags publish whole smiles in batches hours apart, so this is a
          long wait rather than a retry; giving up{" "}
          {new Date(snapshot.healing.expiresAt).toLocaleString()}.
        </div>
      )}

      {loading ? (
        <div className="empty-state">Loading vol surface…</div>
      ) : !snapshot || snapshot.curve.length === 0 ? (
        <div className="empty-state">
          No vol surface available for {pair} {tenor}.
        </div>
      ) : (
        <>
          <table className="watchlist-table vol-table">
            <thead>
              <tr>
                <th>Delta</th>
                {snapshot.curve.map((point) => (
                  <th key={point.u} className="num">
                    {point.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="ticker-cell">
                  <div>
                    {snapshot.pair} {snapshot.tenor}
                  </div>
                  <PriceStamp at={snapshot.asOfDate} prefix="As of" />
                </td>
                {snapshot.curve.map((point) => (
                  <td
                    key={point.u}
                    className={kindClass(point.kind)}
                    title={`${point.label} · ${point.kind}`}
                  >
                    {point.volPct?.toFixed(2) ?? "—"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <div className="vol-legend">
            <span className="vol-swatch vol-quoted" /> quoted by Citi
            <span className="vol-swatch vol-interpolated" /> interpolated
            <span className="vol-swatch vol-extrapolated" /> extrapolated
            <span className="vol-legend-note">
              {snapshot.callsSpent} of ~10 metered calls used on this tenor's
              tags. Cached for 12h; not polled.
              {snapshot.fromStream > 0 &&
                ` ${snapshot.fromStream} of 7 quotes recovered from the stream.`}
            </span>
          </div>
        </>
      )}
    </>
  );
}
