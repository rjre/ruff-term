import type { FxSnapshot, G10Line } from "@ruff-term/shared";
import { TtlCache } from "./cache.js";
import * as yahoo from "./yahoo/client.js";

/** G10 currencies against USD. Real vol-surface data (implied vol by tenor
 * and delta) lives behind Ruffer's own rjre/fx-data tool, which pulls it
 * from Citi Velocity's institutional FX API (`fxdata.volsurface`) — that
 * needs CITI_CLIENT_ID/CITI_CLIENT_SECRET, which this environment doesn't
 * have, so the vol surface section is a placeholder pointing at that repo
 * rather than invented numbers. */
const G10_PAIRS: Array<{ pair: string; ticker: string }> = [
  { pair: "EUR/USD", ticker: "EURUSD=X" },
  { pair: "GBP/USD", ticker: "GBPUSD=X" },
  { pair: "USD/JPY", ticker: "USDJPY=X" },
  { pair: "USD/CHF", ticker: "USDCHF=X" },
  { pair: "USD/CAD", ticker: "USDCAD=X" },
  { pair: "AUD/USD", ticker: "AUDUSD=X" },
  { pair: "NZD/USD", ticker: "NZDUSD=X" },
  { pair: "USD/SEK", ticker: "USDSEK=X" },
  { pair: "USD/NOK", ticker: "USDNOK=X" },
];

const cache = new TtlCache<FxSnapshot>(20_000);

async function loadSnapshot(): Promise<FxSnapshot> {
  const g10 = (
    await Promise.all(
      G10_PAIRS.map(async (p): Promise<G10Line | null> => {
        try {
          const { meta, bars } = await yahoo.fetchChart(p.ticker, "5d");
          if (bars.length < 2) return null;
          const latest = bars[bars.length - 1];
          const prev = bars[bars.length - 2];
          const lastPrice = meta.regularMarketPrice ?? latest.close;
          return {
            pair: p.pair,
            ticker: p.ticker,
            lastPrice,
            changePct1d: Math.round(((lastPrice - prev.close) / prev.close) * 10000) / 100,
          };
        } catch (err) {
          console.warn(`[fx] Skipping ${p.ticker}:`, (err as Error).message);
          return null;
        }
      })
    )
  ).filter((l): l is G10Line => l !== null);

  return { asOf: new Date().toISOString(), g10 };
}

export async function getFxSnapshot(): Promise<FxSnapshot> {
  return cache.getOrLoad("snapshot", loadSnapshot);
}
