import { describe, expect, it, vi } from "vitest";
import { LiveCache, TtlCache } from "./cache.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("TtlCache", () => {
  it("serves a cached value without reloading", async () => {
    const cache = new TtlCache<string>(1000);
    const load = vi.fn().mockResolvedValue("v");

    expect(await cache.getOrLoad("k", load)).toBe("v");
    expect(await cache.getOrLoad("k", load)).toBe("v");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("reloads once the TTL has expired", async () => {
    vi.useFakeTimers();
    try {
      const cache = new TtlCache<number>(1000);
      let n = 0;
      const load = () => Promise.resolve(++n);

      expect(await cache.getOrLoad("k", load)).toBe(1);
      vi.setSystemTime(Date.now() + 1001);
      expect(await cache.getOrLoad("k", load)).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  // The regression this class was changed for: every panel polls on its own
  // timer and several tabs may be open, so a key expiring under load used to
  // fan out into one upstream call per concurrent request.
  it("collapses concurrent misses on the same key into one load", async () => {
    const cache = new TtlCache<string>(1000);
    const gate = deferred<string>();
    const load = vi.fn().mockReturnValue(gate.promise);

    const waiters = Promise.all([
      cache.getOrLoad("k", load),
      cache.getOrLoad("k", load),
      cache.getOrLoad("k", load),
    ]);
    gate.resolve("shared");

    expect(await waiters).toEqual(["shared", "shared", "shared"]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("keeps different keys independent", async () => {
    const cache = new TtlCache<string>(1000);
    const load = vi.fn(async (key: string) => `v:${key}`);

    const [a, b] = await Promise.all([
      cache.getOrLoad("a", () => load("a")),
      cache.getOrLoad("b", () => load("b")),
    ]);
    expect([a, b]).toEqual(["v:a", "v:b"]);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failed load, and retries cleanly afterwards", async () => {
    const cache = new TtlCache<string>(1000);
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("upstream down"))
      .mockResolvedValueOnce("recovered");

    await expect(cache.getOrLoad("k", load)).rejects.toThrow("upstream down");
    // A poisoned in-flight entry would wedge the key forever.
    expect(await cache.getOrLoad("k", load)).toBe("recovered");
  });

  it("shares one in-flight load even when it rejects", async () => {
    const cache = new TtlCache<string>(1000);
    const gate = deferred<string>();
    const load = vi.fn().mockReturnValue(gate.promise);

    const a = cache.getOrLoad("k", load);
    const b = cache.getOrLoad("k", load);
    gate.reject(new Error("boom"));

    await expect(a).rejects.toThrow("boom");
    await expect(b).rejects.toThrow("boom");
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe("LiveCache", () => {
  it("always attempts a live load rather than serving a cached value", async () => {
    const cache = new LiveCache<number>();
    let n = 0;
    const load = () => Promise.resolve(++n);

    expect(await cache.get("k", load)).toBe(1);
    expect(await cache.get("k", load)).toBe(2);
    expect(await cache.get("k", load)).toBe(3);
  });

  it("collapses concurrent callers on the same key into one load", async () => {
    const cache = new LiveCache<string>();
    const gate = deferred<string>();
    const load = vi.fn().mockReturnValue(gate.promise);

    const waiters = Promise.all([
      cache.get("k", load),
      cache.get("k", load),
      cache.get("k", load),
    ]);
    gate.resolve("shared");

    expect(await waiters).toEqual(["shared", "shared", "shared"]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("keeps different keys independent", async () => {
    const cache = new LiveCache<string>();
    const load = vi.fn(async (key: string) => `v:${key}`);

    const [a, b] = await Promise.all([
      cache.get("a", () => load("a")),
      cache.get("b", () => load("b")),
    ]);
    expect([a, b]).toEqual(["v:a", "v:b"]);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("falls back to the last successful result when a load fails", async () => {
    const cache = new LiveCache<string>();
    const load = vi
      .fn()
      .mockResolvedValueOnce("good")
      .mockRejectedValueOnce(new Error("upstream down"));

    expect(await cache.get("k", load)).toBe("good");
    expect(await cache.get("k", load)).toBe("good");
  });

  it("propagates the error when a load fails with no prior success to fall back to", async () => {
    const cache = new LiveCache<string>();
    const load = vi.fn().mockRejectedValue(new Error("upstream down"));

    await expect(cache.get("k", load)).rejects.toThrow("upstream down");
  });

  it("recovers once a later load succeeds after a failure", async () => {
    const cache = new LiveCache<string>();
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("upstream down"))
      .mockResolvedValueOnce("recovered");

    await expect(cache.get("k", load)).rejects.toThrow("upstream down");
    expect(await cache.get("k", load)).toBe("recovered");
  });
});
