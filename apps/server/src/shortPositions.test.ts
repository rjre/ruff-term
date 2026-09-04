import { describe, expect, it } from "vitest";
import { reconstructIndividualRegime } from "./shortPositions.js";

function d(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

describe("reconstructIndividualRegime", () => {
  it("sums each holder's latest disclosure as of each date", () => {
    const points = reconstructIndividualRegime([
      { holder: "A", isin: "X", pct: 1, date: d("2020-01-01") },
      { holder: "B", isin: "X", pct: 2, date: d("2020-02-01") },
    ]);
    expect(points.get("X")).toEqual([
      { netShortPct: 1, positionDate: "2020-01-01", reconstructed: true },
      { netShortPct: 3, positionDate: "2020-02-01", reconstructed: true },
    ]);
  });

  it("carries a holder's position forward until they report again", () => {
    const points = reconstructIndividualRegime([
      { holder: "A", isin: "X", pct: 1, date: d("2020-01-01") },
      { holder: "B", isin: "X", pct: 2, date: d("2020-02-01") },
      { holder: "A", isin: "X", pct: 1.5, date: d("2020-03-01") },
    ]);
    // 2020-03-01: A's 1.5 replaces their earlier 1, B's 2 still stands.
    expect(points.get("X")?.at(-1)).toEqual({
      netShortPct: 3.5,
      positionDate: "2020-03-01",
      reconstructed: true,
    });
  });

  it("drops a holder out of the sum once they report zero", () => {
    const points = reconstructIndividualRegime([
      { holder: "A", isin: "X", pct: 1, date: d("2020-01-01") },
      { holder: "B", isin: "X", pct: 2, date: d("2020-02-01") },
      { holder: "A", isin: "X", pct: 0, date: d("2020-03-01") },
    ]);
    expect(points.get("X")?.at(-1)?.netShortPct).toBe(2);
  });

  it("merges same-day disclosures from different holders into one point", () => {
    const points = reconstructIndividualRegime([
      { holder: "A", isin: "X", pct: 1, date: d("2020-01-01") },
      { holder: "B", isin: "X", pct: 2, date: d("2020-01-01") },
    ]);
    expect(points.get("X")).toEqual([
      { netShortPct: 3, positionDate: "2020-01-01", reconstructed: true },
    ]);
  });

  it("keeps different companies independent", () => {
    const points = reconstructIndividualRegime([
      { holder: "A", isin: "X", pct: 1, date: d("2020-01-01") },
      { holder: "A", isin: "Y", pct: 5, date: d("2020-01-01") },
    ]);
    expect(points.get("X")?.[0].netShortPct).toBe(1);
    expect(points.get("Y")?.[0].netShortPct).toBe(5);
  });

  it("sorts out-of-order input by date before accumulating", () => {
    const points = reconstructIndividualRegime([
      { holder: "A", isin: "X", pct: 2, date: d("2020-02-01") },
      { holder: "A", isin: "X", pct: 1, date: d("2020-01-01") },
    ]);
    expect(points.get("X")?.map((p) => p.positionDate)).toEqual([
      "2020-01-01",
      "2020-02-01",
    ]);
  });

  it("returns an empty map for no input", () => {
    expect(reconstructIndividualRegime([]).size).toBe(0);
  });
});
