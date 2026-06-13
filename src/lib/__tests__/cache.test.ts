// src/lib/__tests__/cache.test.ts
import { describe, it, expect, vi } from "vitest";
import { makeCachedJson, PREFIX, type CacheRedis } from "@/lib/cache";

// A tiny in-memory fake of the Upstash Redis methods we use.
function fakeRedis(initial: Record<string, unknown> = {}) {
  const store = new Map<string, unknown>(Object.entries(initial));
  const redis: CacheRedis & { store: Map<string, unknown> } = {
    store,
    get: vi.fn(async (k: string) => (store.has(k) ? store.get(k) : null)),
    set: vi.fn(async (k: string, v: unknown, opts?: { nx?: boolean }) => {
      if (opts?.nx && store.has(k)) return null;
      store.set(k, v);
      return "OK";
    }),
    del: vi.fn(async (k: string) => {
      store.delete(k);
      return 1;
    }),
  };
  return redis;
}

describe("cachedJson", () => {
  it("with no redis, calls the fetcher directly and returns its value", async () => {
    const cachedJson = makeCachedJson(null);
    const fetcher = vi.fn(async () => [1, 2, 3]);
    const out = await cachedJson("k", { ttlSeconds: 60 }, fetcher);
    expect(out).toEqual([1, 2, 3]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("returns a fresh cached value without calling the fetcher", async () => {
    const redis = fakeRedis({ [`${PREFIX}k`]: { v: [9], t: Date.now() } });
    const cachedJson = makeCachedJson(redis);
    const fetcher = vi.fn(async () => [0]);
    const out = await cachedJson("k", { ttlSeconds: 60 }, fetcher);
    expect(out).toEqual([9]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("on a miss, fetches once and stores the value under the prefixed key", async () => {
    const redis = fakeRedis();
    const cachedJson = makeCachedJson(redis);
    const fetcher = vi.fn(async () => [42]);
    const out = await cachedJson("k", { ttlSeconds: 60 }, fetcher);
    expect(out).toEqual([42]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const stored = redis.store.get(`${PREFIX}k`) as { v: unknown };
    expect(stored.v).toEqual([42]);
  });

  it("treats an expired entry (older than ttl, no SWR) as a miss and refetches", async () => {
    const old = Date.now() - 120_000; // 120s old
    const redis = fakeRedis({ [`${PREFIX}k`]: { v: ["stale"], t: old } });
    const cachedJson = makeCachedJson(redis);
    const fetcher = vi.fn(async () => ["fresh"]);
    const out = await cachedJson("k", { ttlSeconds: 60 }, fetcher);
    expect(out).toEqual(["fresh"]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("parses a JSON-string envelope (Upstash may return a raw string)", async () => {
    const redis = fakeRedis({
      [`${PREFIX}k`]: JSON.stringify({ v: ["str"], t: Date.now() }),
    });
    const cachedJson = makeCachedJson(redis);
    const fetcher = vi.fn(async () => ["x"]);
    const out = await cachedJson("k", { ttlSeconds: 60 }, fetcher);
    expect(out).toEqual(["str"]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("falls back to the fetcher when redis reads throw (never breaks a request)", async () => {
    const redis = fakeRedis();
    redis.get = vi.fn(async () => {
      throw new Error("redis down");
    });
    redis.set = vi.fn(async () => {
      throw new Error("redis down");
    });
    const cachedJson = makeCachedJson(redis);
    const fetcher = vi.fn(async () => ["ok"]);
    const out = await cachedJson("k", { ttlSeconds: 60 }, fetcher);
    expect(out).toEqual(["ok"]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
