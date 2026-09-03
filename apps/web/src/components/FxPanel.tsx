import { useEffect, useState } from "react";
import type { FxSnapshot } from "@ruff-term/shared";
import { fetchFx } from "../api/client";
import { usePriceFlashes } from "../lib/priceFlash";
import { SourceFooter } from "./SourceFooter";
import { formatSignedPct, pctClass } from "../lib/format";
import { PriceStamp } from "./PriceStamp";

const POLL_MS = 20_000;

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

      <h3 className="section-heading">G10 grid</h3>
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
                <td className={`num-cell ${pctClass(line.changePct1d)}`}>
                  {formatSignedPct(line.changePct1d)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="demo-banner" style={{ marginTop: 24 }}>
        Vol surface: implied vol by tenor/delta lives behind Ruffer's own
        rjre/fx-data tool (Citi Velocity's institutional FX API) — needs
        CITI_CLIENT_ID/CITI_CLIENT_SECRET, not available in this environment.
        Placeholder shape below, not real numbers.
      </div>
      <h3 className="section-heading">Vol surface (TBC)</h3>
      <table className="watchlist-table">
        <thead>
          <tr>
            <th>Tenor</th>
            <th className="num">25D Put</th>
            <th className="num">ATM</th>
            <th className="num">25D Call</th>
          </tr>
        </thead>
        <tbody>
          {["1W", "1M", "3M", "6M", "1Y"].map((tenor) => (
            <tr key={tenor}>
              <td className="ticker-cell">{tenor}</td>
              <td className="num-cell">—</td>
              <td className="num-cell">—</td>
              <td className="num-cell">—</td>
            </tr>
          ))}
        </tbody>
      </table>
      <SourceFooter
        sources={[
          "Yahoo Finance (G10 spot, live)",
          "Vol surface pending — intended source: rjre/fx-data (Citi Velocity)",
        ]}
      />
    </div>
  );
}
