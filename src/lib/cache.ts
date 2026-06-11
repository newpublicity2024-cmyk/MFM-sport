// src/lib/cache.ts
//
// Shared, cross-instance cache for hot external API calls (API-Football),
// backed by the same Upstash Redis already used for rate-limiting. On
// autoscaled Vercel the per-instance Next.js fetch cache doesn't dedupe across
// instances; this collapses all instances + users to ~one upstream call per TTL.
//
// Graceful by design: if the Upstash env vars are absent, `cachedJson` simply
// calls the fetcher (today's behavior). Any Redis error is caught and falls
// back to the fetcher — the cache can never break a request.
import { Redis } from "@upstash/redis";

export const PREFIX = "af:";

export function hasUpstash(): boolean {
  return (
    !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

// The minimal slice of the Upstash client we use — lets tests inject a fake.
export interface CacheRedis {
  get(key: string): Promise<unknown>;
  set(
    key: string,
    value: unknown,
    opts?: { ex?: number; nx?: boolean; px?: number },
  ): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

let _redis: CacheRedis | null | undefined;
function defaultRedis(): CacheRedis | null {
  if (_redis !== undefined) return _redis;
  _redis = hasUpstash() ? (Redis.fromEnv() as unknown as CacheRedis) : null;
  return _redis;
}

export type CacheOpts = { ttlSeconds: number; staleSeconds?: number };

type Envelope<T> = { v: T; t: number };

// Upstash 1.x may return the stored value already-parsed (object) OR as a raw
// JSON string depending on how it was written. Handle both, and ignore anything
// that doesn't look like our envelope.
function parseEnvelope<T>(raw: unknown): Envelope<T> | null {
  if (raw == null) return null;
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (obj && typeof obj === "object" && "v" in obj && "t" in obj) {
    return obj as Envelope<T>;
  }
  return null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Build a cachedJson bound to a specific redis client (or null = no cache).
// Exported so tests can exercise every path with a fake client.
export function makeCachedJson(redis: CacheRedis | null) {
  async function store<T>(
    dataKey: string,
    opts: CacheOpts,
    value: T,
  ): Promise<void> {
    const ex = opts.ttlSeconds + (opts.staleSeconds ?? 0);
    try {
      await redis!.set(dataKey, { v: value, t: Date.now() }, { ex });
    } catch {
      /* ignore write failures */
    }
  }

  // Background refresh used for stale-while-revalidate: only the instance that
  // wins the lock refreshes; everyone else skips (they already served stale).
  async function refresh<T>(
    key: string,
    dataKey: string,
    opts: CacheOpts,
    fetcher: () => Promise<T>,
  ): Promise<void> {
    const lockKey = `${PREFIX}lock:${key}`;
    try {
      const res = await redis!.set(lockKey, 1, { nx: true, px: 3000 });
      if (res !== "OK" && res !== true) return;
    } catch {
      return;
    }
    try {
      await store(dataKey, opts, await fetcher());
    } catch {
      /* ignore */
    } finally {
      try {
        await redis!.del(lockKey);
      } catch {
        /* ignore */
      }
    }
  }

  // Miss path: best-effort single-flight so a TTL expiry under load doesn't
  // stampede the upstream API. The lock loser briefly waits for the winner to
  // populate the key, then falls back to a direct fetch (never blocks).
  async function fetchAndStore<T>(
    key: string,
    dataKey: string,
    opts: CacheOpts,
    fetcher: () => Promise<T>,
  ): Promise<T> {
    const lockKey = `${PREFIX}lock:${key}`;
    let gotLock = true;
    try {
      const res = await redis!.set(lockKey, 1, { nx: true, px: 3000 });
      gotLock = res === "OK" || res === true;
    } catch {
      gotLock = true; // lock unavailable → just fetch
    }

    if (gotLock) {
      try {
        const value = await fetcher();
        await store(dataKey, opts, value);
        return value;
      } finally {
        try {
          await redis!.del(lockKey);
        } catch {
          /* ignore */
        }
      }
    }

    for (let i = 0; i < 6; i++) {
      await sleep(250);
      try {
        const env = parseEnvelope<T>(await redis!.get(dataKey));
        if (env) return env.v;
      } catch {
        break;
      }
    }
    return fetcher();
  }

  return async function cachedJson<T>(
    key: string,
    opts: CacheOpts,
    fetcher: () => Promise<T>,
  ): Promise<T> {
    if (!redis) return fetcher();

    const dataKey = PREFIX + key;
    const stale = opts.staleSeconds ?? 0;

    try {
      const env = parseEnvelope<T>(await redis.get(dataKey));
      if (env) {
        const ageSec = (Date.now() - env.t) / 1000;
        if (ageSec < opts.ttlSeconds) return env.v;
        if (stale > 0 && ageSec < opts.ttlSeconds + stale) {
          void refresh(key, dataKey, opts, fetcher);
          return env.v;
        }
      }
    } catch {
      /* read failure → fall through to fetch */
    }

    return fetchAndStore(key, dataKey, opts, fetcher);
  };
}

// Default instance bound to the real (lazily-created) Upstash client.
export const cachedJson = <T>(
  key: string,
  opts: CacheOpts,
  fetcher: () => Promise<T>,
): Promise<T> => makeCachedJson(defaultRedis())<T>(key, opts, fetcher);
