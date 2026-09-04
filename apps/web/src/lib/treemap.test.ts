import { describe, expect, it } from "vitest";
import { squarify } from "./treemap";

function area(rects: ReturnType<typeof squarify>): number {
  return rects.reduce((sum, r) => sum + r.width * r.height, 0);
}

describe("squarify", () => {
  it("returns one rect filling the whole area for a single item", () => {
    const rects = squarify([{ key: "a", value: 10 }], 200, 100);
    expect(rects).toEqual([{ key: "a", x: 0, y: 0, width: 200, height: 100 }]);
  });

  it("conserves total area across many items", () => {
    const items = [
      { key: "a", value: 50 },
      { key: "b", value: 30 },
      { key: "c", value: 15 },
      { key: "d", value: 5 },
    ];
    const rects = squarify(items, 400, 300);
    expect(rects).toHaveLength(4);
    expect(area(rects)).toBeCloseTo(400 * 300, 5);
  });

  it("gives every rect a positive, finite size", () => {
    const items = [
      { key: "a", value: 100 },
      { key: "b", value: 1 },
      { key: "c", value: 50 },
    ];
    const rects = squarify(items, 500, 250);
    for (const r of rects) {
      expect(r.width).toBeGreaterThan(0);
      expect(r.height).toBeGreaterThan(0);
      expect(Number.isFinite(r.width)).toBe(true);
      expect(Number.isFinite(r.height)).toBe(true);
    }
  });

  it("sizes rects proportionally to their weight", () => {
    // Equal weights should get (approximately) equal areas.
    const rects = squarify(
      [
        { key: "a", value: 1 },
        { key: "b", value: 1 },
      ],
      200,
      100,
    );
    const areas = rects.map((r) => r.width * r.height);
    expect(areas[0]).toBeCloseTo(areas[1], 5);
  });

  it("ignores non-positive weights", () => {
    const rects = squarify(
      [
        { key: "a", value: 10 },
        { key: "b", value: 0 },
        { key: "c", value: -5 },
      ],
      200,
      100,
    );
    expect(rects.map((r) => r.key)).toEqual(["a"]);
  });

  it("returns nothing for an empty input or a zero-sized container", () => {
    expect(squarify([], 200, 100)).toEqual([]);
    expect(squarify([{ key: "a", value: 1 }], 0, 100)).toEqual([]);
    expect(squarify([{ key: "a", value: 1 }], 200, 0)).toEqual([]);
  });

  it("keeps rects within the container bounds", () => {
    const items = Array.from({ length: 12 }, (_, i) => ({ key: `k${i}`, value: (i + 1) * 3 }));
    const rects = squarify(items, 640, 360);
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(-1e-9);
      expect(r.y).toBeGreaterThanOrEqual(-1e-9);
      expect(r.x + r.width).toBeLessThanOrEqual(640 + 1e-6);
      expect(r.y + r.height).toBeLessThanOrEqual(360 + 1e-6);
    }
  });
});
