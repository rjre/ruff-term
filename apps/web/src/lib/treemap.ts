export interface TreemapInput {
  key: string;
  /** Relative sizing weight — must be > 0. Callers should pre-scale (e.g.
   * log10) if raw values span multiple orders of magnitude, or one item
   * dominates the layout and everything else collapses to slivers. */
  value: number;
}

export interface TreemapRect {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Squarified treemap (Bruls, Huizing, van Wijk) — lays items into rows along
 * whichever side of the remaining space is currently shorter, growing each
 * row only while doing so improves the worst aspect ratio in it, so tiles
 * stay close to square instead of degenerating into thin strips the way a
 * naive slice-and-dice treemap does under skewed weights.
 */
export function squarify(items: TreemapInput[], width: number, height: number): TreemapRect[] {
  const positive = items.filter((i) => i.value > 0);
  if (positive.length === 0 || width <= 0 || height <= 0) return [];

  const total = positive.reduce((sum, i) => sum + i.value, 0);
  const scale = (width * height) / total;
  const sorted = [...positive]
    .sort((a, b) => b.value - a.value)
    .map((i) => ({ key: i.key, area: i.value * scale }));

  const rects: TreemapRect[] = [];

  function worstAspect(row: typeof sorted, length: number): number {
    const sum = row.reduce((s, r) => s + r.area, 0);
    if (sum === 0 || length === 0) return Infinity;
    const max = Math.max(...row.map((r) => r.area));
    const min = Math.min(...row.map((r) => r.area));
    const s2 = sum * sum;
    const l2 = length * length;
    return Math.max((l2 * max) / s2, s2 / (l2 * min));
  }

  function layoutRow(
    row: typeof sorted,
    x: number,
    y: number,
    w: number,
    h: number,
    horizontal: boolean,
  ): { x: number; y: number; w: number; h: number } {
    const sum = row.reduce((s, r) => s + r.area, 0);
    if (horizontal) {
      const rowHeight = w > 0 ? sum / w : 0;
      let cx = x;
      for (const item of row) {
        const itemWidth = rowHeight > 0 ? item.area / rowHeight : 0;
        rects.push({ key: item.key, x: cx, y, width: itemWidth, height: rowHeight });
        cx += itemWidth;
      }
      return { x, y: y + rowHeight, w, h: h - rowHeight };
    }
    const rowWidth = h > 0 ? sum / h : 0;
    let cy = y;
    for (const item of row) {
      const itemHeight = rowWidth > 0 ? item.area / rowWidth : 0;
      rects.push({ key: item.key, x, y: cy, width: rowWidth, height: itemHeight });
      cy += itemHeight;
    }
    return { x: x + rowWidth, y, w: w - rowWidth, h };
  }

  let remaining = sorted;
  let cx = 0;
  let cy = 0;
  let cw = width;
  let ch = height;

  while (remaining.length > 0) {
    const horizontal = cw >= ch;
    const length = horizontal ? cw : ch;

    let row = [remaining[0]];
    let rest = remaining.slice(1);
    while (rest.length > 0) {
      const withNext = [...row, rest[0]];
      if (worstAspect(withNext, length) <= worstAspect(row, length)) {
        row = withNext;
        rest = rest.slice(1);
      } else {
        break;
      }
    }

    const next = layoutRow(row, cx, cy, cw, ch, horizontal);
    cx = next.x;
    cy = next.y;
    cw = next.w;
    ch = next.h;
    remaining = rest;
  }

  return rects;
}
