import { useEffect, useRef, useState } from "react";

export type FlashDirection = "up" | "down";

/** Bloomberg-style "flash on tick" — diffs each poll against the previous
 * one by key and returns which keys just moved, for ~900ms. */
export function usePriceFlashes(
  entries: Array<{ key: string; value: number }>,
): Map<string, FlashDirection> {
  const prevValues = useRef<Map<string, number>>(new Map());
  const initialized = useRef(false);
  const [flashes, setFlashes] = useState<Map<string, FlashDirection>>(
    new Map(),
  );

  useEffect(() => {
    if (initialized.current) {
      const next = new Map<string, FlashDirection>();
      for (const { key, value } of entries) {
        const prev = prevValues.current.get(key);
        if (prev !== undefined && prev !== value) {
          next.set(key, value > prev ? "up" : "down");
        }
      }
      if (next.size > 0) {
        setFlashes(next);
        const timer = setTimeout(() => setFlashes(new Map()), 3000);
        for (const { key, value } of entries) prevValues.current.set(key, value);
        return () => clearTimeout(timer);
      }
    }
    for (const { key, value } of entries) prevValues.current.set(key, value);
    initialized.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  return flashes;
}
