import { useEffect, useRef, useState } from "react";

export type FlashDirection = "up" | "down";

const FLASH_MS = 3000;

/** Bloomberg-style "flash on tick" — diffs each poll against the previous
 * one by key and returns which keys just moved, for a few seconds. */
export function usePriceFlashes(
  entries: Array<{ key: string; value: number }>,
): Map<string, FlashDirection> {
  const prevValues = useRef<Map<string, number>>(new Map());
  const initialized = useRef(false);
  const [flashes, setFlashes] = useState<Map<string, FlashDirection>>(
    new Map(),
  );

  // Callers build `entries` inline, so it is a fresh array on every render.
  // Keying the effect off the array itself re-ran it (and tore down the
  // clear-flash timer) on the very re-render that setFlashes caused, leaving
  // the flash class stuck on the cell — which in turn meant a second tick in
  // the same direction never re-triggered the CSS animation. Key off the
  // values instead, so the effect only runs when a price actually changes.
  const signature = entries.map((e) => `${e.key}=${e.value}`).join("|");

  useEffect(() => {
    const prev = prevValues.current;
    const next = new Map<string, FlashDirection>();

    if (initialized.current) {
      for (const { key, value } of entries) {
        const before = prev.get(key);
        if (before !== undefined && before !== value) {
          next.set(key, value > before ? "up" : "down");
        }
      }
    }
    for (const { key, value } of entries) prev.set(key, value);
    initialized.current = true;

    if (next.size === 0) return;
    setFlashes(next);
    const timer = setTimeout(() => setFlashes(new Map()), FLASH_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return flashes;
}
