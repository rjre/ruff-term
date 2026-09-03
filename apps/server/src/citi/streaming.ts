import { EventEmitter } from "node:events";
import { STREAMING_WS_URL, credentials } from "./config.js";
import { getToken } from "./client.js";
import { connectsInLastDay, recordConnect } from "./store.js";
import {
  decodeBatch,
  normalizePricePoint,
  timestampToIso,
} from "./streamProtocol.js";

/**
 * Live tick feed over Citi's streaming websocket.
 *
 * Unlike /data this does NOT draw on the per-tag call budget — it has its own
 * limits, and they are the ones that shape this file:
 *
 *   - ONE live connection per login (10 per company).
 *   - ~100 connects per user per 24h.
 *   - 100,000 SUB / 100,000 UNSUB messages, 20,000 active subscriptions.
 *
 * The connect cap is the dangerous one in development, where `tsx watch`
 * restarts the server on every save. So the connection is opened lazily on
 * the first subscriber, closed again once nobody is listening, and every
 * connect is written to a persistent ledger that survives those restarts.
 */

/** Give up on a connection that never says CONN_READY. */
const READY_TIMEOUT_MS = 15_000;

/** Close the socket once no one has been listening for this long. */
const IDLE_CLOSE_MS = 2 * 60_000;

/** Refuse to reconnect past this, leaving headroom under Citi's ~100/24h. */
const CONNECT_BUDGET = 80;

const RECONNECT_BASE_MS = 5_000;
const RECONNECT_MAX_MS = 5 * 60_000;

export interface LiveTick {
  tag: string;
  value: number;
  /** ISO instant derived from the batch's yyyyMMddHHmm stamp. */
  at: string;
  /** When this process received it. */
  receivedAt: string;
}

export type StreamStatus =
  | "idle"
  | "connecting"
  | "live"
  | "reconnecting"
  | "unavailable";

interface Subscription {
  tag: string;
  msgId: number;
  subId?: number;
}

class CitiStream extends EventEmitter {
  private socket: WebSocket | null = null;
  private ready = false;
  private status: StreamStatus = "idle";
  private note: string | null = null;

  private wanted = new Set<string>();
  private subs = new Map<number, Subscription>();
  private bySubId = new Map<number, string>();
  private latest = new Map<string, LiveTick>();

  private msgIdCounter = 1;
  private subscribers = 0;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private connectedAt: string | null = null;

  /** Tags to subscribe to once the socket is ready. */
  want(tags: string[]): void {
    for (const tag of tags) this.wanted.add(tag);
    if (this.ready) this.sendPendingSubs();
  }

  getLatest(): Map<string, LiveTick> {
    return this.latest;
  }

  getState() {
    return {
      status: this.status,
      note: this.note,
      connectedAt: this.connectedAt,
      subscribed: [...this.bySubId.values()],
      connectsInLastDay: connectsInLastDay(),
      connectBudget: CONNECT_BUDGET,
    };
  }

  /**
   * Register interest. The socket opens on the first listener and closes a
   * couple of minutes after the last one leaves — Citi permits only one live
   * connection per login, so holding it open unattended is antisocial.
   */
  attach(): () => void {
    this.subscribers += 1;
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    void this.ensureConnected();

    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.subscribers -= 1;
      if (this.subscribers <= 0) this.scheduleIdleClose();
    };
  }

  private scheduleIdleClose(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      if (this.subscribers <= 0) this.close("idle");
    }, IDLE_CLOSE_MS);
  }

  private setStatus(status: StreamStatus, note: string | null = null): void {
    this.status = status;
    this.note = note;
    this.emit("state", this.getState());
  }

  private async ensureConnected(): Promise<void> {
    if (this.socket || this.status === "connecting") return;
    if (!credentials()) {
      this.setStatus("unavailable", "Citi credentials are not configured.");
      return;
    }
    if (connectsInLastDay() >= CONNECT_BUDGET) {
      this.setStatus(
        "unavailable",
        `Streaming connect budget reached (${connectsInLastDay()} in the last 24h; Citi allows ~100).`,
      );
      return;
    }

    this.setStatus("connecting");
    let url: string;
    try {
      const creds = credentials();
      const token = await getToken();
      const query = new URLSearchParams({
        client_id: creds!.clientId,
        // Must be the literal "Bearer <token>", not the bare token.
        access_token: `Bearer ${token}`,
        frequency: "MI01",
      });
      url = `${STREAMING_WS_URL}?${query.toString()}`;
    } catch (err) {
      this.fail(`token request failed: ${(err as Error).message}`);
      return;
    }

    recordConnect();
    const socket = new WebSocket(url);
    socket.binaryType = "arraybuffer";
    this.socket = socket;

    const readyTimer = setTimeout(() => {
      if (!this.ready) {
        this.fail(`no CONN_READY within ${READY_TIMEOUT_MS / 1000}s`);
        socket.close();
      }
    }, READY_TIMEOUT_MS);

    socket.onmessage = (event) => this.onMessage(event);
    socket.onerror = () => this.fail("websocket error");
    socket.onclose = (event) => {
      clearTimeout(readyTimer);
      this.onClose(event.code, event.reason);
    };
  }

  private onMessage(event: MessageEvent): void {
    if (event.data instanceof ArrayBuffer) {
      this.onBatch(event.data);
      return;
    }
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(String(event.data)) as Record<string, unknown>;
    } catch {
      return;
    }

    switch (payload.type) {
      case "CONN_READY":
        this.ready = true;
        this.reconnectAttempt = 0;
        this.connectedAt = new Date().toISOString();
        this.setStatus("live");
        // Nothing may be sent before CONN_READY, so the subs queue until now.
        this.sendPendingSubs();
        break;
      case "SUBACK": {
        if (payload.status !== "OK") break;
        // SUBACK does not echo the tag — correlate through the message id we
        // chose when sending the SUB.
        const sub = this.subs.get(Number(payload.id));
        const subId = Number(payload.subid);
        if (sub && Number.isFinite(subId)) {
          sub.subId = subId;
          this.bySubId.set(subId, sub.tag);
          this.emit("state", this.getState());
        }
        break;
      }
      case "CONN_ERROR":
        this.fail(String(payload.message ?? "connection error"));
        break;
      default:
        break;
    }
  }

  private onBatch(buffer: ArrayBuffer): void {
    let batch;
    try {
      batch = decodeBatch(buffer);
    } catch (err) {
      console.warn("[citi-stream] Bad tick batch:", (err as Error).message);
      return;
    }
    const at = timestampToIso(batch.timestamp);
    const receivedAt = new Date().toISOString();
    const updates: LiveTick[] = [];

    for (const { subId, value } of batch.ticks) {
      const tag = this.bySubId.get(subId);
      if (!tag) continue;
      const tick: LiveTick = { tag, value, at, receivedAt };
      this.latest.set(tag, tick);
      updates.push(tick);
    }
    if (updates.length > 0) this.emit("ticks", updates);
  }

  private sendPendingSubs(): void {
    if (!this.ready || !this.socket) return;
    const already = new Set([...this.subs.values()].map((s) => s.tag));
    for (const tag of this.wanted) {
      if (already.has(tag)) continue;
      const msgId = this.msgIdCounter++;
      this.subs.set(msgId, { tag, msgId });
      this.socket.send(
        JSON.stringify({
          type: "SUB",
          id: msgId,
          tag,
          pricePoint: normalizePricePoint("C"),
        }),
      );
    }
  }

  private fail(reason: string): void {
    console.warn(`[citi-stream] ${reason}`);
    this.setStatus(this.subscribers > 0 ? "reconnecting" : "idle", reason);
  }

  private onClose(code: number, reason: string): void {
    this.ready = false;
    this.socket = null;
    // Citi drops every subscription server-side when the socket closes.
    this.subs.clear();
    this.bySubId.clear();

    if (this.subscribers <= 0) {
      this.setStatus("idle", this.note);
      return;
    }
    this.scheduleReconnect(reason || `closed with code ${code}`);
  }

  private scheduleReconnect(reason: string): void {
    if (this.reconnectTimer) return;
    if (connectsInLastDay() >= CONNECT_BUDGET) {
      this.setStatus(
        "unavailable",
        `Streaming connect budget reached (${connectsInLastDay()} in the last 24h).`,
      );
      return;
    }
    // Exponential backoff: reconnecting hard would eat the ~100/24h budget in
    // minutes and leave nothing for the rest of the day.
    const delay = Math.min(
      RECONNECT_BASE_MS * 2 ** this.reconnectAttempt,
      RECONNECT_MAX_MS,
    );
    this.reconnectAttempt += 1;
    this.setStatus("reconnecting", `${reason}; retrying in ${Math.round(delay / 1000)}s`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.ensureConnected();
    }, delay);
  }

  close(reason: string): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ready = false;
    this.setStatus("idle", reason === "idle" ? "Closed while nobody was listening." : reason);
    this.socket?.close();
    this.socket = null;
  }
}

export const citiStream = new CitiStream();

// Leave the socket closed rather than letting Citi time it out: the
// one-connection-per-login limit means a lingering socket blocks the next
// process from connecting at all.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    citiStream.close("server shutting down");
    process.exit(0);
  });
}
