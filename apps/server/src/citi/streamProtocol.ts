/**
 * Wire format for Citi's streaming tick batches.
 *
 * A batch is an 8-byte big-endian int64 timestamp (yyyyMMddHHmm as a number,
 * not an epoch) followed by any number of 12-byte pairs: a 4-byte big-endian
 * int32 subscription id and an 8-byte big-endian double value.
 */

const HEADER_BYTES = 8;
const PAIR_BYTES = 12;

export interface TickBatch {
  /** yyyyMMddHHmm, as Citi sends it. */
  timestamp: number;
  ticks: Array<{ subId: number; value: number }>;
}

export function decodeBatch(buffer: ArrayBuffer): TickBatch {
  if (buffer.byteLength < HEADER_BYTES) {
    throw new Error("batch shorter than the 8-byte timestamp header");
  }
  const body = buffer.byteLength - HEADER_BYTES;
  if (body % PAIR_BYTES !== 0) {
    throw new Error(`batch body length ${body} is not a multiple of ${PAIR_BYTES}`);
  }

  const view = new DataView(buffer);
  // The timestamp is an int64 but yyyyMMddHHmm fits comfortably in a double,
  // so this never loses precision.
  const timestamp = Number(view.getBigInt64(0, false));

  const ticks: TickBatch["ticks"] = [];
  for (let offset = HEADER_BYTES; offset < buffer.byteLength; offset += PAIR_BYTES) {
    ticks.push({
      subId: view.getInt32(offset, false),
      value: view.getFloat64(offset + 4, false),
    });
  }
  return { timestamp, ticks };
}

/** yyyyMMddHHmm (UTC) to an ISO instant. */
export function timestampToIso(stamp: number): string {
  const s = String(stamp).padStart(12, "0");
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:00Z`;
}

const PRICE_POINT_ALIASES: Record<string, string> = {
  C: "CLOSE",
  O: "OPEN",
  H: "HIGH",
  L: "LOW",
};

const VALID_PRICE_POINTS = new Set(["CLOSE", "OPEN", "HIGH", "LOW"]);

/**
 * SUB messages take CLOSE/HIGH/LOW/OPEN — not the "C"/"OHLC" the Historical
 * Data API uses. An invalid value earns a CONN_ERROR that closes the whole
 * connection, so this rejects rather than passes it through.
 */
export function normalizePricePoint(pricePoint: string): string {
  const upper = pricePoint.toUpperCase();
  const value = PRICE_POINT_ALIASES[upper] ?? upper;
  if (!VALID_PRICE_POINTS.has(value)) {
    throw new Error(
      `Invalid pricePoint "${pricePoint}"; must be one of ${[...VALID_PRICE_POINTS].sort().join(", ")}`,
    );
  }
  return value;
}
