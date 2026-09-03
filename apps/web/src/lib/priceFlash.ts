import { useEffect, useState } from "react";

export type FlashDirection = "up" | "down";

const FLASH_MS = 3000;

interface Tracked {
  /** Identifies the price set the other two fields were derived from. */
  signature: string;
  values: Map<string, number>;
  flashes: Map<string, FlashDirection>;
}

const EMPTY_FLASHES = new Map<string, FlashDirection>();

const INITIAL: Tracked = {
  signature: "",
  values: new Map(),
  flashes: EMPTY_FLASHES,
};

function diff(
  previous: Map<string, number>,
  entries: Array<{ key: string; value: number }>,
): Tracked["flashes"] {
  const flashes = new Map<string, FlashDirection>();
  for (const { key, value } of entries) {
    const before = previous.get(key);
    // An unseen key is not a move — a row appearing shouldn't flash.
    if (before !== undefined && before !== value) {
      flashes.set(key, value > before ? "up" : "down");
    }
  }
  return flashes;
}

/**
 * Bloomberg-style "flash on tick" — diffs each poll against the previous one
 * by key and returns which keys just moved, for a few seconds.
 *
 * The diff happens during render rather than in an effect. Callers build
 * `entries` inline, so it is a new array on every render: keying an effect off
 * it re-ran on the very re-render the state update caused, tearing down the
 * clear-flash timer and leaving the class stuck on the cell — after which a
 * second tick in the same direction never re-animated. Deriving from a
 * signature of the values sidesteps that, and saves the extra render pass an
 * effect would cost on every poll.
 */
export function usePriceFlashes(
  entries: Array<{ key: string; value: number }>,
): Map<string, FlashDirection> {
  const [tracked, setTracked] = useState<Tracked>(INITIAL);

  const signature = entries.map((e) => `${e.key}=${e.value}`).join("|");

  if (signature !== tracked.signature) {
    // Adjusting state during render, as React documents for deriving from
    // changed inputs: pure, and re-rendered before anything is committed.
    setTracked({
      signature,
      values: new Map(entries.map((e) => [e.key, e.value])),
      // On the first run every key is unseen, so this is empty — a freshly
      // loaded table establishes the baseline rather than flashing wholesale.
      flashes: diff(tracked.values, entries),
    });
  }

  const active = tracked.flashes.size > 0;
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(
      () => setTracked((t) => ({ ...t, flashes: EMPTY_FLASHES })),
      FLASH_MS,
    );
    return () => clearTimeout(timer);
  }, [tracked, active]);

  return tracked.flashes;
}
