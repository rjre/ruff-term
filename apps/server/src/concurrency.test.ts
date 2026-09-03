import { describe, expect, it } from "vitest";
import { mapLimit } from "./concurrency.js";

/** Resolves after a macrotask, so overlapping work is observable. */
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 1));
}

describe("mapLimit", () => {
  it("keeps results in input order regardless of completion order", async () => {
    const items = [30, 5, 20, 1, 10];
    const out = await mapLimit(items, 3, async (ms) => {
      await new Promise((r) => setTimeout(r, ms));
      return ms;
    });
    expect(out).toEqual(items);
  });

  // The reason this exists: a cold screener load used to fire all 65 symbols
  // at Yahoo simultaneously.
  it("never exceeds the concurrency limit", async () => {
    let inFlight = 0;
    let peak = 0;

    await mapLimit(Array.from({ length: 40 }, (_, i) => i), 8, async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await tick();
      inFlight--;
    });

    expect(peak).toBeLessThanOrEqual(8);
    expect(peak).toBe(8); // and it does actually use the budget
  });

  it("handles an empty input", async () => {
    expect(await mapLimit([], 4, async () => 1)).toEqual([]);
  });

  it("handles fewer items than the limit", async () => {
    expect(await mapLimit([1, 2], 8, async (n) => n * 2)).toEqual([2, 4]);
  });

  it("passes the index to the callback", async () => {
    expect(await mapLimit(["a", "b", "c"], 2, async (v, i) => `${i}${v}`)).toEqual(
      ["0a", "1b", "2c"],
    );
  });

  it("propagates a rejection", async () => {
    await expect(
      mapLimit([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error("nope");
        return n;
      }),
    ).rejects.toThrow("nope");
  });

  it("rejects a nonsensical limit", async () => {
    await expect(mapLimit([1], 0, async (n) => n)).rejects.toThrow("limit");
  });
});
