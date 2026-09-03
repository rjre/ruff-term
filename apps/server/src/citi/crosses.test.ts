import { describe, expect, it } from "vitest";
import { LEGS, buildGrid, cross, usdRates } from "./crosses.js";

/** Real Citi closes for 2026-09-03, keyed by tag. */
const LATEST: Record<string, number> = {
  "FX.SPOT.EUR.USD.CITI": 1.1618,
  "FX.SPOT.GBP.USD.CITI": 1.3517,
  "FX.SPOT.AUD.USD.CITI": 0.7198,
  "FX.SPOT.NZD.USD.CITI": 0.5878,
  "FX.SPOT.USD.JPY.CITI": 155.43,
  "FX.SPOT.USD.CHF.CITI": 0.8081,
  "FX.SPOT.USD.CAD.CITI": 1.3798,
  "FX.SPOT.USD.SEK.CITI": 9.5487,
  "FX.SPOT.USD.NOK.CITI": 9.2926,
};

const price = (map: Record<string, number>) => (tag: string) => map[tag];

describe("usdRates", () => {
  it("takes a USD-quoted leg's price directly", () => {
    expect(usdRates(price(LATEST)).EUR).toBeCloseTo(1.1618, 6);
  });

  it("inverts a leg quoted with USD as the base", () => {
    // USD/JPY 155.43 means one yen buys 1/155.43 dollars.
    expect(usdRates(price(LATEST)).JPY).toBeCloseTo(1 / 155.43, 8);
  });

  it("always includes USD at parity", () => {
    expect(usdRates(() => undefined).USD).toBe(1);
  });

  it("omits a leg with no price rather than emitting NaN", () => {
    const rates = usdRates((tag) =>
      tag === "FX.SPOT.EUR.USD.CITI" ? undefined : LATEST[tag],
    );
    expect(rates).not.toHaveProperty("EUR");
    expect(rates.GBP).toBeCloseTo(1.3517, 6);
  });

  it("omits a zero price, which would otherwise divide by zero", () => {
    const rates = usdRates((tag) =>
      tag === "FX.SPOT.USD.JPY.CITI" ? 0 : LATEST[tag],
    );
    expect(rates).not.toHaveProperty("JPY");
  });
});

describe("cross", () => {
  const rates = usdRates(price(LATEST));

  it("triangulates a cross with no native tag", () => {
    // EURJPY = EURUSD × USDJPY, and there is no FX.SPOT.EUR.JPY tag.
    expect(cross(rates, "EUR", "JPY")).toBeCloseTo(1.1618 * 155.43, 4);
  });

  it("returns the USD leg itself for a USD cross", () => {
    expect(cross(rates, "EUR", "USD")).toBeCloseTo(1.1618, 6);
    expect(cross(rates, "USD", "JPY")).toBeCloseTo(155.43, 6);
  });

  it("is reciprocal", () => {
    expect(cross(rates, "GBP", "CHF") * cross(rates, "CHF", "GBP")).toBeCloseTo(1, 10);
  });
});

describe("buildGrid", () => {
  const latest = usdRates(price(LATEST));
  // A baseline where every currency is 1% weaker against USD than it is now.
  const baseline = usdRates((tag) => {
    const leg = LEGS.find((l) => l.tag === tag)!;
    return leg.invert ? LATEST[tag] * 1.01 : LATEST[tag] / 1.01;
  });

  it("covers every currency with a leg, plus USD", () => {
    expect(buildGrid(latest, baseline).currencies).toHaveLength(LEGS.length + 1);
  });

  it("leaves the diagonal null", () => {
    const { currencies, rates, changes } = buildGrid(latest, baseline);
    for (const c of currencies) {
      expect(rates[c][c]).toBeNull();
      expect(changes[c][c]).toBeNull();
    }
  });

  it("reports no cross change when every currency moved equally against USD", () => {
    const { changes } = buildGrid(latest, baseline);
    // Non-USD crosses are unchanged; only the USD row and column moved.
    expect(changes.EUR.JPY).toBeCloseTo(0, 6);
    expect(changes.GBP.CHF).toBeCloseTo(0, 6);
    expect(changes.EUR.USD).toBeCloseTo(1, 6);
  });

  it("scores strength as the average move across the row", () => {
    const { strength, changes, currencies } = buildGrid(latest, baseline);
    const row = currencies
      .filter((c) => c !== "EUR")
      .map((c) => changes.EUR[c]!)
      .reduce((s, v) => s + v, 0);
    expect(strength.EUR).toBeCloseTo(row / (currencies.length - 1), 2);
  });

  it("nulls changes for a currency with no baseline, keeping its rates", () => {
    const partial = { ...baseline };
    delete partial.JPY;
    const { rates, changes } = buildGrid(latest, partial);
    expect(rates.EUR.JPY).toBeCloseTo(1.1618 * 155.43, 4);
    expect(changes.EUR.JPY).toBeNull();
    expect(changes.EUR.GBP).not.toBeNull();
  });
});
