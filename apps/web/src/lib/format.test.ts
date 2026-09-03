import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatQuoteTime,
  formatQuoteTimestamp,
  formatSigned,
  formatSignedPct,
  pctClass,
} from "./format";

afterEach(() => vi.useRealTimers());

/** Pin "now" so today-vs-earlier branches are deterministic. */
function freezeAt(iso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
}

describe("pctClass", () => {
  it("maps sign to the up/down/flat classes", () => {
    expect(pctClass(1.5)).toBe("pct-up");
    expect(pctClass(-1.5)).toBe("pct-down");
    expect(pctClass(0)).toBe("pct-flat");
  });

  it("treats missing data as flat rather than down", () => {
    expect(pctClass(null)).toBe("pct-flat");
    expect(pctClass(undefined)).toBe("pct-flat");
  });
});

describe("formatSignedPct", () => {
  it("prefixes a plus only for positive values", () => {
    expect(formatSignedPct(1.234)).toBe("+1.23%");
    expect(formatSignedPct(-1.234)).toBe("-1.23%");
    expect(formatSignedPct(0)).toBe("0.00%");
  });

  it("honours a custom precision", () => {
    expect(formatSignedPct(1.234, 1)).toBe("+1.2%");
  });
});

describe("formatSigned", () => {
  it("formats a unitless level change", () => {
    expect(formatSigned(0.5)).toBe("+0.50");
    expect(formatSigned(-0.5)).toBe("-0.50");
  });
});

describe("formatQuoteTime", () => {
  it("shows time alone for a tick from today", () => {
    freezeAt("2026-03-10T18:00:00Z");
    // Same UTC day; exact rendering is locale-dependent, so assert on the
    // property that matters: no date component.
    expect(formatQuoteTime("2026-03-10T16:30:00Z")).not.toMatch(/Mar/);
  });

  // The point of the stamp: a Friday close must not read as this morning.
  it("adds the date for a tick from an earlier day", () => {
    freezeAt("2026-03-10T18:00:00Z");
    expect(formatQuoteTime("2026-03-06T16:30:00Z")).toMatch(/Mar/);
  });

  it("passes a plain calendar date through untouched", () => {
    expect(formatQuoteTime("2026-08-06")).toBe("2026-08-06");
  });

  it("passes an unparseable string through rather than showing NaN", () => {
    expect(formatQuoteTime("not a date")).toBe("not a date");
    expect(formatQuoteTime("")).toBe("");
  });

  // NAV Monitoring's upstream snapshot stamps itself like this. V8 parses it,
  // so it renders as a normal date/time rather than falling through.
  it("formats the loose timestamp NAV Monitoring supplies", () => {
    freezeAt("2026-09-03T18:00:00Z");
    const out = formatQuoteTime("2026-08-25 20:23 UTC");
    expect(out).not.toBe("2026-08-25 20:23 UTC");
    expect(out).toMatch(/Aug/);
  });
});

describe("formatQuoteTimestamp", () => {
  it("passes date-only and unparseable values through", () => {
    expect(formatQuoteTimestamp("2026-08-06")).toBe("2026-08-06");
    expect(formatQuoteTimestamp("garbage")).toBe("garbage");
  });

  it("renders a full timestamp for a real instant", () => {
    const out = formatQuoteTimestamp("2026-03-06T16:30:00Z");
    expect(out).not.toBe("2026-03-06T16:30:00Z");
    expect(out).toMatch(/2026/);
  });
});
