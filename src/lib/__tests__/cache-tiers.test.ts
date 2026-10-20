// src/lib/__tests__/cache-tiers.test.ts
//
// The two tiers added in front of Redis, and the credential names that decide
// whether Redis is reachable at all. Each of these guards a defect that was
// live on production: the wrong env-var names (so the cache never ran), an
// archived store still named by those vars (so every request paid timeouts),
// and nothing retaining a value between renders (so a 6-hour TTL was fetched
// four times a minute).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  makeMemoizedJson,
  makeCachedJson,
  withBreaker,
  hasUpstash,
  upstashCredentials,
  REDIS_BREAKER_FAILURE_THRESHOLD,
  REDIS_BREAKER_COOLDOWN_MS,
  type CacheRedis,
  type CachedJson,
} from "@/lib/cache";

const REDIS_VARS = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
] as const;

describe("upstashCredentials / hasUpstash", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of REDIS_VARS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of REDIS_VARS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("is false with no credentials", () => {
    expect(hasUpstash()).toBe(false);
    expect(upstashCredentials()).toBeNull();
  });

  it("is false for half a pair", () => {
    process.env.KV_REST_API_URL = "https://kv.example.upstash.io";
    expect(hasUpstash()).toBe(false);
    process.env.KV_REST_API_TOKEN = "t";
    delete process.env.KV_REST_API_URL;
    expect(hasUpstash()).toBe(false);
  });

  // The whole reason the shared cache was dead on this project: Vercel's
  // Upstash integration provisions KV_REST_API_*, and only UPSTASH_REDIS_REST_*
  // was ever checked.
  it("accepts Vercel's KV_REST_API_* pair", () => {
    process.env.KV_REST_API_URL = "https://kv.example.upstash.io";
    process.env.KV_REST_API_TOKEN = "kv-token";
    expect(hasUpstash()).toBe(true);
    expect(upstashCredentials()).toEqual({
      url: "https://kv.example.upstash.io",
      token: "kv-token",
    });
  });

  it("still accepts Upstash's own UPSTASH_REDIS_REST_* pair, and prefers it", () => {
    process.env.KV_REST_API_URL = "https://kv.example.upstash.io";
    process.env.KV_REST_API_TOKEN = "kv-token";
    process.env.UPSTASH_REDIS_REST_URL = "https://native.example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "native-token";
    expect(upstashCredentials()?.url).toBe("https://native.example.upstash.io");
  });
});

describe("makeMemoizedJson", () => {
  /** A pass-through inner tier, so the memo is the only thing caching. */
  const passthrough: CachedJson = <T>(
    _key: string,
    _opts: { ttlSeconds: number },
    fetcher: () => Promise<T>,
  ) => fetcher();

  it("serves a second read of one key without calling the fetcher", async () => {
    const memo = makeMemoizedJson(passthrough);
    const fetcher = vi.fn(async () => ["v"]);
    expect(await memo("k", { ttlSeconds: 60 }, fetcher)).toEqual(["v"]);
    expect(await memo("k", { ttlSeconds: 60 }, fetcher)).toEqual(["v"]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("refetches once the reader's ttl has elapsed", async () => {
    let now = 1_000_000;
    const memo = makeMemoizedJson(passthrough, { now: () => now });
    const fetcher = vi.fn(async () => ["v"]);
    await memo("k", { ttlSeconds: 60 }, fetcher);
    now += 59_000;
    await memo("k", { ttlSeconds: 60 }, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    now += 2_000; // now 61s old
    await memo("k", { ttlSeconds: 60 }, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  // `ttlSeconds` is the reader's tolerance, not a stored expiry: a stricter
  // reader of the same key refreshes it sooner. This is what lets the polled
  // /api/standings route share one entry with the competition page.
  it("lets a stricter reader of the same key refresh it sooner", async () => {
    let now = 1_000_000;
    const memo = makeMemoizedJson(passthrough, { now: () => now });
    const fetcher = vi.fn(async () => ["v"]);
    await memo("stand:39", { ttlSeconds: 3600 }, fetcher);
    now += 120_000; // two minutes later
    await memo("stand:39", { ttlSeconds: 3600 }, fetcher); // tolerant reader: hit
    expect(fetcher).toHaveBeenCalledTimes(1);
    await memo("stand:39", { ttlSeconds: 60 }, fetcher); // strict reader: miss
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  // Regression: without age reporting the memo stamped a value with when it
  // saw it, so a stale-while-revalidate hit from Redis had its clock reset and
  // was then served for another full TTL. Standings would reach two hours
  // against a declared hour. Latent until Redis is live — i.e. it would have
  // appeared the moment the store was provisioned.
  it("does not reset the clock on a value that arrived already stale", async () => {
    let now = 1_000_000;
    // An inner tier that answers with a value already 50s old.
    const agedInner: CachedJson = async <T>(
      _key: string,
      opts: { ttlSeconds: number; onAgeSeconds?: (n: number) => void },
      fetcher: () => Promise<T>,
    ) => {
      const value = await fetcher();
      opts.onAgeSeconds?.(50);
      return value;
    };
    const memo = makeMemoizedJson(agedInner, { now: () => now });
    const fetcher = vi.fn(async () => ["v"]);

    await memo("k", { ttlSeconds: 60 }, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);

    now += 9_000; // value is now 59s old overall — still inside the 60s ttl
    await memo("k", { ttlSeconds: 60 }, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);

    now += 2_000; // 61s old overall → must refresh, not serve for 60s more
    await memo("k", { ttlSeconds: 60 }, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("passes the observed age through to its own caller", async () => {
    const agedInner: CachedJson = async <T>(
      _key: string,
      opts: { ttlSeconds: number; onAgeSeconds?: (n: number) => void },
      fetcher: () => Promise<T>,
    ) => {
      const value = await fetcher();
      opts.onAgeSeconds?.(42);
      return value;
    };
    const seen: number[] = [];
    const memo = makeMemoizedJson(agedInner);
    await memo("k", { ttlSeconds: 600, onAgeSeconds: (a) => seen.push(a) }, async () => ["v"]);
    expect(seen).toEqual([42]);
  });

  it("single-flights concurrent readers of a cold key", async () => {
    const memo = makeMemoizedJson(passthrough);
    let resolve!: (v: string[]) => void;
    const fetcher = vi.fn(() => new Promise<string[]>((r) => (resolve = r)));
    const all = Promise.all([
      memo("k", { ttlSeconds: 60 }, fetcher),
      memo("k", { ttlSeconds: 60 }, fetcher),
      memo("k", { ttlSeconds: 60 }, fetcher),
    ]);
    resolve(["v"]);
    expect(await all).toEqual([["v"], ["v"], ["v"]]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("never remembers a rejection", async () => {
    const memo = makeMemoizedJson(passthrough);
    const fetcher = vi
      .fn<() => Promise<string[]>>()
      .mockRejectedValueOnce(new Error("quota"))
      .mockResolvedValueOnce(["v"]);
    await expect(memo("k", { ttlSeconds: 60 }, fetcher)).rejects.toThrow("quota");
    // A cached failure would pin an empty section in place for the whole TTL.
    expect(await memo("k", { ttlSeconds: 60 }, fetcher)).toEqual(["v"]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  // A crawler walking /ar/matches/<id> or ?date=<any day> would otherwise grow
  // the table without bound.
  it("evicts the oldest write past its entry cap", async () => {
    const memo = makeMemoizedJson(passthrough, { maxEntries: 3 });
    const fetcher = vi.fn(async () => ["v"]);
    for (const k of ["a", "b", "c", "d"]) {
      await memo(k, { ttlSeconds: 600 }, fetcher);
    }
    expect(fetcher).toHaveBeenCalledTimes(4);
    await memo("d", { ttlSeconds: 600 }, fetcher); // newest: still held
    expect(fetcher).toHaveBeenCalledTimes(4);
    await memo("a", { ttlSeconds: 600 }, fetcher); // oldest: evicted
    expect(fetcher).toHaveBeenCalledTimes(5);
  });
});

describe("withBreaker", () => {
  function deadRedis() {
    let calls = 0;
    const redis: CacheRedis = {
      get: async () => {
        calls += 1;
        throw new Error("ENOTFOUND");
      },
      set: async () => {
        calls += 1;
        throw new Error("ENOTFOUND");
      },
      del: async () => {
        calls += 1;
        throw new Error("ENOTFOUND");
      },
    };
    return { redis, count: () => calls };
  }

  it("stops consulting a store that keeps failing", async () => {
    const { redis, count } = deadRedis();
    const now = () => 1_000_000;
    const breakered = withBreaker(redis, { now });
    for (let i = 0; i < 10; i++) {
      await expect(breakered.get(`k${i}`)).rejects.toThrow();
    }
    expect(count()).toBe(REDIS_BREAKER_FAILURE_THRESHOLD);
    expect(breakered.breaker.openedUntil).toBeGreaterThan(now());
  });

  it("probes again after the cooldown rather than giving up for good", async () => {
    const { redis, count } = deadRedis();
    let now = 1_000_000;
    const breakered = withBreaker(redis, { now: () => now });
    for (let i = 0; i < 5; i++) {
      await expect(breakered.get(`k${i}`)).rejects.toThrow();
    }
    const settled = count();
    now += REDIS_BREAKER_COOLDOWN_MS + 1;
    await expect(breakered.get("after")).rejects.toThrow();
    expect(count()).toBe(settled + 1);
  });

  it("a success closes the breaker again", async () => {
    let fail = true;
    let calls = 0;
    const redis: CacheRedis = {
      get: async () => {
        calls += 1;
        if (fail) throw new Error("ENOTFOUND");
        return null;
      },
      set: async () => null,
      del: async () => 1,
    };
    const breakered = withBreaker(redis, { now: () => 1_000_000 });
    await expect(breakered.get("a")).rejects.toThrow();
    await expect(breakered.get("b")).rejects.toThrow();
    fail = false;
    await breakered.get("c");
    expect(breakered.breaker.failures).toBe(0);
    expect(breakered.breaker.openedUntil).toBe(0);
    fail = true;
    // The counter restarted, so it takes a full threshold again to reopen.
    for (let i = 0; i < REDIS_BREAKER_FAILURE_THRESHOLD - 1; i++) {
      await expect(breakered.get(`d${i}`)).rejects.toThrow();
    }
    expect(breakered.breaker.openedUntil).toBe(0);
    expect(calls).toBeGreaterThan(0);
  });

  // The behaviour that matters at the call site: an unreachable store degrades
  // to "no cache", never to a failed request.
  it("leaves cachedJson still returning the fetcher's value", async () => {
    const { redis } = deadRedis();
    const cachedJson = makeCachedJson(withBreaker(redis, { now: () => 1_000_000 }));
    const fetcher = vi.fn(async () => ["value"]);
    for (let i = 0; i < 5; i++) {
      expect(await cachedJson(`k${i}`, { ttlSeconds: 60 }, fetcher)).toEqual(["value"]);
    }
    expect(fetcher).toHaveBeenCalledTimes(5);
  });
});
