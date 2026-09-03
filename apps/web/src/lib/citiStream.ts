import { useEffect, useState } from "react";

export type StreamStatus =
  | "idle"
  | "connecting"
  | "live"
  | "reconnecting"
  | "unavailable"
  | "disconnected";

export interface LiveTick {
  tag: string;
  value: number;
  /** ISO instant derived from the batch's yyyyMMddHHmm stamp. */
  at: string;
  receivedAt: string;
}

export interface StreamState {
  status: StreamStatus;
  note: string | null;
  connectedAt: string | null;
  subscribed: string[];
  connectsInLastDay: number;
  connectBudget: number;
}

const INITIAL: StreamState = {
  status: "connecting",
  note: null,
  connectedAt: null,
  subscribed: [],
  connectsInLastDay: 0,
  connectBudget: 0,
};

export interface CitiStream {
  state: StreamState;
  /** Latest value per tag. */
  prices: Record<string, LiveTick>;
}

/**
 * Subscribes to the server's Server-Sent Events feed of Citi spot ticks.
 *
 * The browser holds the SSE connection; the server holds the single upstream
 * websocket Citi permits per login and opens it only while someone is
 * listening. EventSource reconnects on its own, so there is no retry logic
 * here — but each browser reconnect is cheap, unlike the upstream one.
 */
export function useCitiStream(enabled: boolean): CitiStream {
  const [state, setState] = useState<StreamState>(INITIAL);
  const [prices, setPrices] = useState<Record<string, LiveTick>>({});

  useEffect(() => {
    if (!enabled) return;
    const source = new EventSource("/api/citi/stream");

    source.addEventListener("state", (event) => {
      try {
        setState(JSON.parse((event as MessageEvent).data) as StreamState);
      } catch {
        // A malformed frame is not worth tearing the stream down for.
      }
    });

    source.addEventListener("ticks", (event) => {
      try {
        const ticks = JSON.parse((event as MessageEvent).data) as LiveTick[];
        if (ticks.length === 0) return;
        setPrices((prev) => {
          const next = { ...prev };
          for (const tick of ticks) next[tick.tag] = tick;
          return next;
        });
      } catch {
        // ditto
      }
    });

    source.onerror = () => {
      // EventSource retries by itself; reflect the gap rather than acting.
      setState((prev) => ({ ...prev, status: "disconnected" }));
    };

    return () => source.close();
  }, [enabled]);

  return { state, prices };
}
