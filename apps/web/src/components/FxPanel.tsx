import { useEffect, useMemo, useState } from "react";
import type { FxSnapshot, G10Line } from "@ruff-term/shared";
import { fetchFx } from "../api/client";
import { usePriceFlashes } from "../lib/priceFlash";
import { SourceFooter } from "./SourceFooter";
import { VolSurfacePanel } from "./VolSurfacePanel";
import { formatSignedPct, pctClass } from "../lib/format";
import { PriceStamp } from "./PriceStamp";

const POLL_MS = 20_000;
/** %1D magnitude that maps to full heatmap color saturation. G10 spot rarely
 * moves more than ~1% in a day, so this keeps everyday moves visibly shaded
 * instead of everything looking pale. */
const HEATMAP_MAX_PCT = 1;

function heatStyle(
  value: number,
  maxAbs = HEATMAP_MAX_PCT,
): { background: string; color: string } {
  const alpha = Math.min(Math.abs(value) / maxAbs, 1) * 0.75;
  const background =
    value >= 0 ? `rgba(12,163,12,${alpha})` : `rgba(208,59,59,${alpha})`;
  const color = alpha > 0.45 ? "#ffffff" : "var(--text)";
  return { background, color };
}

function moveLabel(value: number): string {
  const abs = Math.abs(value);
  if (abs < 0.1) return "Flat";
  if (value > 0) return abs >= 0.5 ? "Strong" : "Firmer";
  return abs >= 0.5 ? "Weak" : "Softer";
}

interface CurrencyMove {
  code: string;
  changePct1d: number;
}

/** Every G10 line quotes one currency against USD, but which side of the
 * pair USD sits on varies (EUR/USD vs USD/JPY). Normalize each line to "% move
 * of the non-USD currency vs USD" so they're directly comparable, then derive
 * USD's own broad move as the mirror of the G9 average — that's the only way
 * to answer "has the dollar moved" from spot pairs alone, since USD/USD isn't
 * a quotable pair. */
function deriveCurrencyStrength(g10: G10Line[]): CurrencyMove[] {
  const nonUsd: CurrencyMove[] = [];
  for (const line of g10) {
    const [base, quote] = line.pair.split("/");
    if (quote === "USD") {
      nonUsd.push({ code: base, changePct1d: line.changePct1d });
    } else if (base === "USD") {
      nonUsd.push({ code: quote, changePct1d: -line.changePct1d });
    }
  }
  if (nonUsd.length === 0) return [];
  const usdMove =
    -nonUsd.reduce((sum, c) => sum + c.changePct1d, 0) / nonUsd.length;
  return [...nonUsd, { code: "USD", changePct1d: usdMove }].sort(
    (a, b) => b.changePct1d - a.changePct1d,
  );
}

interface Props {
  onSelectTicker?: (ticker: string) => void;
}

export function FxPanel({ onSelectTicker }: Props) {
  const [snapshot, setSnapshot] = useState<FxSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const data = await fetchFx();
        if (!cancelled) setSnapshot(data);
      } catch {
        // keep showing the last good snapshot
      }
    }
    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const flashes = usePriceFlashes(
    (snapshot?.g10 ?? []).map((l) => ({ key: l.ticker, value: l.lastPrice })),
  );

  const strength = useMemo(
    () => deriveCurrencyStrength(snapshot?.g10 ?? []),
    [snapshot],
  );
  const usd = strength.find((c) => c.code === "USD");
  const strongest = strength[0];
  const weakest = strength[strength.length - 1];
  const jpy = strength.find((c) => c.code === "JPY");

  return (
    <div className="module-view">
      <div className="module-banner">
        <div>
          <div className="module-banner-title">FX</div>
          <div className="module-banner-sub">
            G10 spot grid, refreshing every 20s.
            {snapshot
              ? ` Last update ${new Date(snapshot.asOf).toLocaleTimeString()}.`
              : ""}
          </div>
        </div>
      </div>

      <h3 className="section-heading">G10 grid — heatmap</h3>
      {!snapshot ? (
        <div className="empty-state">Loading G10 grid…</div>
      ) : (
        <table className="watchlist-table" style={{ maxWidth: 480 }}>
          <thead>
            <tr>
              <th>Pair</th>
              <th className="num">Last</th>
              <th className="num">%1D</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.g10.map((line) => (
              <tr
                key={line.ticker}
                className={
                  onSelectTicker ? "screener-row-clickable" : undefined
                }
                onClick={
                  onSelectTicker ? () => onSelectTicker(line.ticker) : undefined
                }
              >
                <td className="ticker-cell">{line.pair}</td>
                <td
                  className={`num-cell price-cell${
                    flashes.get(line.ticker) ? ` flash-${flashes.get(line.ticker)}` : ""
                  }`}
                >
                  <div>{line.lastPrice.toFixed(4)}</div>
                  <PriceStamp at={line.updatedAt} />
                </td>
                <td className="num-cell" style={heatStyle(line.changePct1d)}>
                  {formatSignedPct(line.changePct1d)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 className="section-heading" style={{ marginTop: 24 }}>
        Currency strength — what&apos;s moving vs what
      </h3>
      {!snapshot ? (
        <div className="empty-state">Loading currency strength…</div>
      ) : !usd || !strongest || !weakest ? (
        <div className="empty-state">No G10 lines to rank.</div>
      ) : (
        <>
          <div className="note-banner" style={{ marginBottom: 12 }}>
            USD is broadly {usd.changePct1d >= 0 ? "stronger" : "weaker"}{" "}
            today ({formatSignedPct(usd.changePct1d)}, avg vs the other
            nine). {strongest.code} leads the board (
            {formatSignedPct(strongest.changePct1d)}), {weakest.code} lags (
            {formatSignedPct(weakest.changePct1d)}).
            {jpy
              ? ` JPY is ${jpy.changePct1d >= 0 ? "stronger" : "weaker"} vs USD (${formatSignedPct(jpy.changePct1d)}).`
              : ""}
          </div>
          <table className="watchlist-table" style={{ maxWidth: 480 }}>
            <thead>
              <tr>
                <th>Currency</th>
                <th className="num">%1D vs USD</th>
                <th>Signal</th>
              </tr>
            </thead>
            <tbody>
              {strength.map((c) => (
                <tr key={c.code}>
                  <td className="ticker-cell">
                    {c.code}
                    {c.code === "USD" ? (
                      <span
                        className="module-banner-sub"
                        style={{ marginLeft: 6 }}
                      >
                        (avg vs G9)
                      </span>
                    ) : null}
                  </td>
                  <td className="num-cell" style={heatStyle(c.changePct1d)}>
                    {formatSignedPct(c.changePct1d)}
                  </td>
                  <td className={pctClass(c.changePct1d)}>
                    {moveLabel(c.changePct1d)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div style={{ marginTop: 24 }}>
        <VolSurfacePanel />
      </div>
      <SourceFooter
        sources={[
          "Yahoo Finance (G10 spot, live)",
          "Citi Velocity Historical Data API (implied vol, EOD close)",
        ]}
      />
    </div>
  );
}
