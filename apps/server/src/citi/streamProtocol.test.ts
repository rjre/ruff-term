import { describe, expect, it } from "vitest";
import {
  decodeBatch,
  normalizePricePoint,
  timestampToIso,
} from "./streamProtocol.js";

/** Builds a batch the way Citi frames one: int64 stamp, then (int32, double) pairs. */
function batch(
  timestamp: number,
  pairs: Array<[number, number]>,
): ArrayBuffer {
  const buffer = new ArrayBuffer(8 + pairs.length * 12);
  const view = new DataView(buffer);
  view.setBigInt64(0, BigInt(timestamp), false);
  pairs.forEach(([subId, value], i) => {
    view.setInt32(8 + i * 12, subId, false);
    view.setFloat64(8 + i * 12 + 4, value, false);
  });
  return buffer;
}

describe("decodeBatch", () => {
  it("decodes the timestamp and every tick pair", () => {
    const decoded = decodeBatch(
      batch(202609032145, [
        [7, 1.1618],
        [9, 155.43],
      ]),
    );
    expect(decoded.timestamp).toBe(202609032145);
    expect(decoded.ticks).toEqual([
      { subId: 7, value: 1.1618 },
      { subId: 9, value: 155.43 },
    ]);
  });

  it("accepts a heartbeat batch carrying no ticks", () => {
    expect(decodeBatch(batch(202609032145, [])).ticks).toEqual([]);
  });

  it("reads big-endian, not the platform's byte order", () => {
    // A little-endian read of this would give a nonsense subid.
    expect(decodeBatch(batch(202609032145, [[1, 2]])).ticks[0].subId).toBe(1);
  });

  it("rejects a batch too short to hold its header", () => {
    expect(() => decodeBatch(new ArrayBuffer(4))).toThrow(/8-byte/);
  });

  it("rejects a body that is not a whole number of pairs", () => {
    expect(() => decodeBatch(new ArrayBuffer(8 + 7))).toThrow(/multiple of 12/);
  });
});

describe("timestampToIso", () => {
  it("reads yyyyMMddHHmm as UTC", () => {
    expect(timestampToIso(202609032145)).toBe("2026-09-03T21:45:00Z");
  });

  it("keeps a leading-zero month and hour intact", () => {
    expect(timestampToIso(202601020304)).toBe("2026-01-02T03:04:00Z");
  });
});

describe("normalizePricePoint", () => {
  it("expands the single-letter aliases", () => {
    expect(normalizePricePoint("C")).toBe("CLOSE");
    expect(normalizePricePoint("o")).toBe("OPEN");
  });

  it("passes an already-valid value through", () => {
    expect(normalizePricePoint("HIGH")).toBe("HIGH");
  });

  // The Historical Data API's "OHLC" is not valid here, and sending it earns
  // a CONN_ERROR that closes the whole connection.
  it("rejects anything else rather than letting the server drop us", () => {
    expect(() => normalizePricePoint("OHLC")).toThrow(/Invalid pricePoint/);
    expect(() => normalizePricePoint("")).toThrow(/Invalid pricePoint/);
  });
});
