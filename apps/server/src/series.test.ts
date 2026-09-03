import { describe, expect, it } from "vitest";
import { baseBefore, baseBeforeOrFirst, pctChange } from "./series.js";

const bars = [
  { time: 100, close: 10 },
  { time: 200, close: 20 },
  { time: 300, close: 30 },
];

describe("pctChange", () => {
  it("computes a signed percentage to 2dp", () => {
    expect(pctChange(100, 110)).toBe(10);
    expect(pctChange(100, 90)).toBe(-10);
    expect(pctChange(3, 4)).toBe(33.33);
  });

  it("returns 0 rather than Infinity for a zero base", () => {
    expect(pctChange(0, 50)).toBe(0);
  });

  it("returns 0 for an unchanged value", () => {
    expect(pctChange(42, 42)).toBe(0);
  });
});

describe("baseBefore", () => {
  it("returns the last bar strictly before the cutoff", () => {
    expect(baseBefore(bars, 250)?.close).toBe(20);
  });

  it("excludes a bar exactly on the cutoff", () => {
    expect(baseBefore(bars, 200)?.close).toBe(10);
  });

  it("returns null when the cutoff predates the series", () => {
    expect(baseBefore(bars, 50)).toBeNull();
  });

  it("returns the newest bar when the cutoff is past the series", () => {
    expect(baseBefore(bars, 10_000)?.close).toBe(30);
  });
});

describe("baseBeforeOrFirst", () => {
  it("falls back to the oldest bar when the window predates the series", () => {
    expect(baseBeforeOrFirst(bars, 50).close).toBe(10);
  });

  it("otherwise matches baseBefore", () => {
    expect(baseBeforeOrFirst(bars, 250).close).toBe(20);
  });
});
