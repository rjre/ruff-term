/**
 * Cross-rate triangulation for the G10 grid.
 *
 * Citi's FX.SPOT tags publish the nine USD-quoted majors; there is no native
 * EURJPY, GBPCHF or AUDNZD tag. Every other cross is arithmetic on those nine
 * legs, so a full 90-cross matrix costs one API call rather than ninety tags.
 */

export const CURRENCIES = [
  "USD", "EUR", "JPY", "GBP", "CHF", "CAD", "AUD", "NZD", "SEK", "NOK",
];

/**
 * `invert` marks the legs quoted the market way round with USD as the base
 * (USD/JPY, so USD per unit is 1/price) versus those quoted against USD
 * (EUR/USD, where the price is USD per unit already).
 */
export const LEGS: Array<{ ccy: string; tag: string; invert: boolean }> = [
  { ccy: "EUR", tag: "FX.SPOT.EUR.USD.CITI", invert: false },
  { ccy: "GBP", tag: "FX.SPOT.GBP.USD.CITI", invert: false },
  { ccy: "AUD", tag: "FX.SPOT.AUD.USD.CITI", invert: false },
  { ccy: "NZD", tag: "FX.SPOT.NZD.USD.CITI", invert: false },
  { ccy: "JPY", tag: "FX.SPOT.USD.JPY.CITI", invert: true },
  { ccy: "CHF", tag: "FX.SPOT.USD.CHF.CITI", invert: true },
  { ccy: "CAD", tag: "FX.SPOT.USD.CAD.CITI", invert: true },
  { ccy: "SEK", tag: "FX.SPOT.USD.SEK.CITI", invert: true },
  { ccy: "NOK", tag: "FX.SPOT.USD.NOK.CITI", invert: true },
];

export const TAGS = LEGS.map((l) => l.tag);

/** USD per one unit of each currency. A leg with no price is left out. */
export function usdRates(
  price: (tag: string) => number | undefined,
): Record<string, number> {
  const rates: Record<string, number> = { USD: 1 };
  for (const leg of LEGS) {
    const p = price(leg.tag);
    if (p === undefined || p === 0) continue;
    rates[leg.ccy] = leg.invert ? 1 / p : p;
  }
  return rates;
}

/** Units of `quote` per one unit of `base` — cross(r,"EUR","JPY") is EURJPY. */
export function cross(
  rates: Record<string, number>,
  base: string,
  quote: string,
): number {
  return rates[base] / rates[quote];
}

export interface Grid {
  currencies: string[];
  rates: Record<string, Record<string, number | null>>;
  changes: Record<string, Record<string, number | null>>;
  strength: Record<string, number | null>;
}

/** The full matrix plus a per-currency strength score: its average move
 * against every other currency in the grid. */
export function buildGrid(
  latest: Record<string, number>,
  baseline: Record<string, number>,
): Grid {
  const currencies = CURRENCIES.filter((c) => c in latest);
  const comparable = new Set(currencies.filter((c) => c in baseline));

  const rates: Grid["rates"] = {};
  const changes: Grid["changes"] = {};
  const strength: Grid["strength"] = {};

  for (const a of currencies) {
    rates[a] = {};
    changes[a] = {};
    const moves: number[] = [];
    for (const b of currencies) {
      if (a === b) {
        rates[a][b] = null;
        changes[a][b] = null;
        continue;
      }
      rates[a][b] = cross(latest, a, b);
      if (comparable.has(a) && comparable.has(b)) {
        const pct = (cross(latest, a, b) / cross(baseline, a, b) - 1) * 100;
        changes[a][b] = Math.round(pct * 1000) / 1000;
        moves.push(pct);
      } else {
        changes[a][b] = null;
      }
    }
    strength[a] =
      moves.length > 0
        ? Math.round((moves.reduce((s, m) => s + m, 0) / moves.length) * 1000) /
          1000
        : null;
  }

  return { currencies, rates, changes, strength };
}
