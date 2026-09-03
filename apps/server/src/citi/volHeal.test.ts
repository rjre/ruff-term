import { describe, expect, it } from "vitest";
import type { CachedPoint } from "./store.js";
import { HEAL_WINDOW_MS, VolHealer } from "./volHeal.js";

const TAGS = [
  "FX.VOL.EUR.USD.STRIKE_P10.1M.IMPLIED.CITI",
  "FX.VOL.EUR.USD.ATM.1M.IMPLIED.CITI",
  "FX.VOL.EUR.USD.STRIKE_C10.1M.IMPLIED.CITI",
];

function setup() {
  const wanted: string[][] = [];
  const released: number[] = [];
  const saved: Array<Record<string, CachedPoint>> = [];
  let attachments = 0;
  let now = Date.UTC(2026, 8, 3, 12, 0, 0);

  const healer = new VolHealer({
    want: (tags) => wanted.push(tags),
    attach: () => {
      const id = ++attachments;
      return () => released.push(id);
    },
    save: (points) => saved.push(points),
    now: () => now,
  });

  return {
    healer,
    wanted,
    saved,
    released,
    get attachments() {
      return attachments;
    },
    advance: (ms: number) => {
      now += ms;
    },
    at: () => new Date(now).toISOString(),
  };
}

describe("VolHealer", () => {
  it("subscribes the missing tags and holds the socket", () => {
    const h = setup();
    h.healer.request("EUR/USD", "1M", TAGS);

    expect(h.wanted).toEqual([TAGS]);
    expect(h.attachments).toBe(1);
    expect(h.healer.active()).toEqual(["EUR/USD|1M"]);
  });

  it("does nothing when no tags are missing", () => {
    const h = setup();
    h.healer.request("EUR/USD", "1M", []);
    expect(h.attachments).toBe(0);
    expect(h.healer.active()).toEqual([]);
  });

  it("does not open a second attachment for the same tenor", () => {
    const h = setup();
    h.healer.request("EUR/USD", "1M", TAGS);
    h.healer.request("EUR/USD", "1M", TAGS);
    expect(h.attachments).toBe(1);
  });

  it("keeps tenors independent", () => {
    const h = setup();
    h.healer.request("EUR/USD", "1M", [TAGS[0]]);
    h.healer.request("EUR/USD", "3M", ["FX.VOL.EUR.USD.ATM.3M.IMPLIED.CITI"]);
    expect(h.healer.active()).toEqual(["EUR/USD|1M", "EUR/USD|3M"]);
  });

  it("seeds a matching tick into the cache, marked as stream-sourced", () => {
    const h = setup();
    h.healer.request("EUR/USD", "1M", TAGS);

    const consumed = h.healer.onTicks([
      { tag: TAGS[0], value: 6.05, at: "2026-09-03T21:16:00Z" },
    ]);

    expect(consumed).toEqual([TAGS[0]]);
    expect(h.saved).toHaveLength(1);
    expect(h.saved[0][TAGS[0]]).toMatchObject({
      value: 6.05,
      date: 20260903,
      source: "stream",
    });
  });

  it("ignores ticks for tags nobody is waiting on", () => {
    const h = setup();
    h.healer.request("EUR/USD", "1M", [TAGS[0]]);

    const consumed = h.healer.onTicks([
      { tag: "FX.SPOT.EUR.USD.CITI", value: 1.16, at: "2026-09-03T21:16:00Z" },
    ]);

    expect(consumed).toEqual([]);
    expect(h.saved).toHaveLength(0);
  });

  // The reference implementation observed all seven smile points arriving
  // together in a single batch, hours after subscribing.
  it("finishes and releases the socket once the whole smile arrives at once", () => {
    const h = setup();
    h.healer.request("EUR/USD", "1M", TAGS);

    h.healer.onTicks(
      TAGS.map((tag, i) => ({ tag, value: 5 + i, at: "2026-09-03T21:16:00Z" })),
    );

    expect(h.healer.active()).toEqual([]);
    expect(h.released).toEqual([1]);
  });

  it("keeps waiting while any tag is still outstanding", () => {
    const h = setup();
    h.healer.request("EUR/USD", "1M", TAGS);

    h.healer.onTicks([{ tag: TAGS[0], value: 6, at: "2026-09-03T21:16:00Z" }]);

    expect(h.healer.active()).toEqual(["EUR/USD|1M"]);
    expect(h.released).toEqual([]);
    expect(h.healer.status("EUR/USD", "1M")).toMatchObject({
      pending: [TAGS[1], TAGS[2]],
      seeded: [TAGS[0]],
    });
  });

  // A pair Citi does not entitle would otherwise hold the single permitted
  // connection open indefinitely.
  it("gives up once the window expires, releasing the socket", () => {
    const h = setup();
    h.healer.request("EUR/USD", "1M", TAGS);

    h.advance(HEAL_WINDOW_MS + 1);

    expect(h.healer.active()).toEqual([]);
    expect(h.released).toEqual([1]);
    expect(h.healer.status("EUR/USD", "1M")).toBeNull();
  });

  it("does not expire a heal that is still inside its window", () => {
    const h = setup();
    h.healer.request("EUR/USD", "1M", TAGS);
    h.advance(HEAL_WINDOW_MS - 1000);
    expect(h.healer.active()).toEqual(["EUR/USD|1M"]);
  });

  it("reports when the wait runs out", () => {
    const h = setup();
    h.healer.request("EUR/USD", "1M", TAGS);
    const status = h.healer.status("EUR/USD", "1M")!;
    expect(Date.parse(status.expiresAt) - Date.parse(status.startedAt)).toBe(
      HEAL_WINDOW_MS,
    );
  });

  it("survives a tick carrying an unparseable timestamp", () => {
    const h = setup();
    h.healer.request("EUR/USD", "1M", [TAGS[0]]);
    h.healer.onTicks([{ tag: TAGS[0], value: 6, at: "not a date" }]);
    expect(h.saved[0][TAGS[0]].date).toBe(0);
  });
});
