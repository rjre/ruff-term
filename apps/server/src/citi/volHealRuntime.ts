import { citiStream, type LiveTick } from "./streaming.js";
import { putCachedTags } from "./store.js";
import { VolHealer } from "./volHeal.js";

/**
 * The live wiring for VolHealer, kept apart from the class so the recovery
 * logic can be tested without a websocket.
 */
export const volHealer = new VolHealer({
  want: (tags) => citiStream.want(tags),
  attach: () => citiStream.attach(),
  save: (points) => putCachedTags(points),
});

// Every batch is offered to the healer; it keeps only the tags a blocked
// tenor is waiting on and ignores the rest (spot legs, other tenors).
citiStream.on("ticks", (ticks: LiveTick[]) => {
  const seeded = volHealer.onTicks(ticks);
  if (seeded.length > 0) {
    console.info(
      `[citi] Vol smile seeded from the stream: ${seeded.length} tag(s) — ${seeded.join(", ")}`,
    );
  }
});
