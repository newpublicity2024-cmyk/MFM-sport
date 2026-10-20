// src/lib/cache.ts
//
// Shared cache for hot external API calls (API-Football). Three tiers, cheapest
// first:
//
//   1. a per-instance memo (always on, no configuration, no network)
//   2. Upstash Redis, when credentials exist and the store is answering
//   3. the fetcher itself
//
// `ttlSeconds` is the READER's maximum acceptable age, not a writer-side expiry.
// Two callers may share one key and ask for different freshness: the competition
// page accepts hour-old standings while `/api/standings` (polled during a live
// match) demands a minute. Both read and write the same entry; the stricter
// reader simply refreshes it sooner.
//
// Graceful by design: with no credentials, or with a store that has stopped
// answering, every path still resolves through the fetcher. The cache can never
// break a request.
import { Redis } from "@upstash/redis";

export const PREFIX = "af:";

/**
 * Upstash credentials, under either of the two names they arrive as.
 *
 * Vercel's Upstash integration provisions `KV_REST_API_URL` / `KV_REST_API_TOKEN`;
 * Upstash's own docs and `Redis.fromEnv()` use `UPSTASH_REDIS_REST_*`. This
 * codebase only ever checked the second pair, so on a Vercel deployment the
 * shared cache was off from the day it was written — every `cachedJson` call
 * fell through to a bare fetch, which is how a 75,000/day API-Football quota
 * came to be exhausted daily (measured 19 October 2026). Accept both.
 */
export function upstashCredentials(): { url: string; token: string } | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";
  return url && token ? { url, token } : null;
}

export function hasUpstash(): boolean {
  return upstashCredentials() !== null;
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

/**
 * One Redis command may not hold a request longer than this. Upstash normally
 * answers in tens of milliseconds; the point is the failure mode. The client's
 * defaults are 5 retries with `Math.exp(n) * 50` ms backoff — about 11.7 s per
 * failing command before any request timeout — and `cachedJson` issues two to
 * four commands per call, so one Upstash blip held a page for 35–95 s
 * (measured on production, 17 September 2026). Every path below already treats
 * a Redis error as a miss, so failing fast costs one upstream call, not a page.
 */
export const REDIS_COMMAND_TIMEOUT_MS = 1500;

/**
 * After this many consecutive failures the breaker opens and Redis is skipped
 * entirely until the cooldown elapses.
 *
 * Without it, a *dead* store is worse than no store at all: the env vars still
 * exist, so `hasUpstash()` is true, and every request pays the full retry and
 * timeout budget before falling through to the same fetcher it would have
 * called anyway. That is the exact state this project was left in — the Vercel
 * store `upstash-kv-chestnut-envelope` reads `status: uninstalled`
 * ("Archived due to inactivity") while its `KV_*` variables are still set.
 * An open breaker makes that state cost one probe per cooldown instead of two
 * to four timeouts per request.
 */
export const REDIS_BREAKER_FAILURE_THRESHOLD = 3;
export const REDIS_BREAKER_COOLDOWN_MS = 60_000;

export type BreakerDeps = { now?: () => number };

export type BreakerState = {
  /** Consecutive failures since the last success. */
  failures: number;
  /** Epoch ms at which the breaker reopens for one probe, or 0 when closed. */
  openedUntil: number;
};

export class RedisBreakerOpenError extends Error {
  constructor() {
    super("Redis breaker open — skipping command");
    this.name = "RedisBreakerOpenError";
  }
}

/**
 * Wraps a client so a persistently failing store stops being consulted.
 *
 * Every `cachedJson` path already treats a rejection as a cache miss, so an
 * open breaker degrades to "no cache" rather than to an error.
 */
export function withBreaker(
  redis: CacheRedis,
  deps: BreakerDeps = {},
): CacheRedis & { breaker: BreakerState } {
  const now = deps.now ?? (() => Date.now());
  const breaker: BreakerState = { failures: 0, openedUntil: 0 };

  async function guard<T>(run: () => Promise<T>): Promise<T> {
    if (breaker.openedUntil > now()) throw new RedisBreakerOpenError();
    try {
      const out = await run();
      // A success closes the breaker, whatever happened before it.
      breaker.failures = 0;
      breaker.openedUntil = 0;
      return out;
    } catch (error) {
      breaker.failures += 1;
      if (breaker.failures >= REDIS_BREAKER_FAILURE_THRESHOLD) {
        breaker.openedUntil = now() + REDIS_BREAKER_COOLDOWN_MS;
      }
      throw error;
    }
  }

  return {
    breaker,
    get: (key) => guard(() => redis.get(key)),
    set: (key, value, opts) => guard(() => redis.set(key, value, opts)),
    del: (key) => guard(() => redis.del(key)),
  };
}

let _redis: (CacheRedis & { breaker: BreakerState }) | null | undefined;
function defaultRedis(): CacheRedis | null {
  if (_redis !== undefined) return _redis;
  const creds = upstashCredentials();
  _redis = creds
    ? withBreaker(
        new Redis({
          url: creds.url,
          token: creds.token,
          retry: { retries: 1, backoff: () => 200 },
          // A factory, so each command gets its own fresh timer.
          signal: () => AbortSignal.timeout(REDIS_COMMAND_TIMEOUT_MS),
        }) as unknown as CacheRedis,
      )
    : null;
  return _redis;
}

export type CacheOpts = {
  ttlSeconds: number;
  staleSeconds?: number;
  /**
   * Called with the age, in seconds, of the value being returned — 0 when it
   * was fetched fresh.
   *
   * This exists so the memo tier can stamp an entry with when its value was
   * *produced* rather than when the memo happened to see it. Without it,
   * stale-while-revalidate staleness compounds: Redis hands back a value that
   * is already past `ttlSeconds` (legitimately, inside the stale window), the
   * memo records it as brand new, and it is then served for another full TTL.
   * Standings would have gone up to two hours old against a declared hour.
   * Latent until Redis is actually live, which is exactly when it would have
   * started happening.
   */
  onAgeSeconds?: (ageSeconds: number) => void;
};

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
        opts.onAgeSeconds?.(0);
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
        if (env) {
          opts.onAgeSeconds?.((Date.now() - env.t) / 1000);
          return env.v;
        }
      } catch {
        break;
      }
    }
    const fetched = await fetcher();
    opts.onAgeSeconds?.(0);
    return fetched;
  }

  return async function cachedJson<T>(
    key: string,
    opts: CacheOpts,
    fetcher: () => Promise<T>,
  ): Promise<T> {
    if (!redis) {
      const value = await fetcher();
      opts.onAgeSeconds?.(0);
      return value;
    }

    const dataKey = PREFIX + key;
    const stale = opts.staleSeconds ?? 0;

    try {
      const env = parseEnvelope<T>(await redis.get(dataKey));
      if (env) {
        const ageSec = (Date.now() - env.t) / 1000;
        if (ageSec < opts.ttlSeconds) {
          opts.onAgeSeconds?.(ageSec);
          return env.v;
        }
        if (stale > 0 && ageSec < opts.ttlSeconds + stale) {
          // Serve stale, refresh behind. The age reported is the real one, so
          // a memo in front of this cannot reset the clock on it.
          void refresh(key, dataKey, opts, fetcher);
          opts.onAgeSeconds?.(ageSec);
          return env.v;
        }
      }
    } catch {
      /* read failure → fall through to fetch */
    }

    return fetchAndStore(key, dataKey, opts, fetcher);
  };
}

/** Signature shared by every tier, so they compose. */
export type CachedJson = <T>(
  key: string,
  opts: CacheOpts,
  fetcher: () => Promise<T>,
) => Promise<T>;

/**
 * How many distinct keys one instance remembers. Each entry is one upstream
 * JSON payload, and the largest of those is a league's whole season
 * (~380 fixtures). The cap is what stops a crawler walking an unbounded URL
 * space — `/ar/matches/<id>`, `?date=<any day>` — from growing the heap: past
 * the cap the oldest write is dropped.
 */
export const MEMO_MAX_ENTRIES = 400;

export type MemoDeps = { now?: () => number; maxEntries?: number };

/**
 * Tier 1 — a per-instance memo in front of `inner`.
 *
 * This is the tier that works with no configuration at all, and it is the one
 * that matters most here: it makes upstream volume a function of the TTLs
 * rather than of how often a page re-renders. Measured on production before
 * this change, `/leagues?id=39` declared a six-hour TTL and was fetched about
 * four times a minute, because nothing between the getter and the network was
 * actually retaining it.
 *
 * It also single-flights: concurrent readers of one key share one upstream
 * call instead of racing. A rejection is never remembered.
 *
 * Trade-off, deliberately: a memo hit does not consult Redis, so a warm
 * instance may serve a value up to `ttlSeconds` old without seeing a newer one
 * written by a sibling instance. That is the same staleness the reader already
 * declared acceptable.
 */
export function makeMemoizedJson(inner: CachedJson, deps: MemoDeps = {}): CachedJson {
  const now = deps.now ?? (() => Date.now());
  const maxEntries = deps.maxEntries ?? MEMO_MAX_ENTRIES;
  const store = new Map<string, { storedAt: number; value: unknown }>();
  const inflight = new Map<string, Promise<unknown>>();

  function remember(key: string, value: unknown, ageSeconds: number): void {
    // Map iterates in insertion order, so the first key is the oldest key.
    // Re-inserting on write makes this least-recently-written eviction.
    store.delete(key);
    while (store.size >= maxEntries) {
      const oldest = store.keys().next();
      if (oldest.done) break;
      store.delete(oldest.value);
    }
    // Backdate to when the value was produced, not to when we saw it, so a
    // stale-while-revalidate hit cannot have its clock reset here.
    store.set(key, { storedAt: now() - Math.max(0, ageSeconds) * 1000, value });
  }

  return function memoizedJson<T>(
    key: string,
    opts: CacheOpts,
    fetcher: () => Promise<T>,
  ): Promise<T> {
    const hit = store.get(key);
    if (hit && (now() - hit.storedAt) / 1000 < opts.ttlSeconds) {
      return Promise.resolve(hit.value as T);
    }

    const pending = inflight.get(key) as Promise<T> | undefined;
    if (pending) return pending;

    let observedAge = 0;
    const reportingOpts: CacheOpts = {
      ...opts,
      onAgeSeconds: (age) => {
        observedAge = age;
        opts.onAgeSeconds?.(age);
      },
    };
    const run = inner<T>(key, reportingOpts, fetcher).then(
      (value) => {
        inflight.delete(key);
        remember(key, value, observedAge);
        return value;
      },
      (error) => {
        inflight.delete(key);
        throw error;
      },
    );
    inflight.set(key, run);
    return run;
  };
}

let _cachedJson: CachedJson | undefined;
function defaultCachedJson(): CachedJson {
  if (!_cachedJson) {
    _cachedJson = makeMemoizedJson(makeCachedJson(defaultRedis()));
  }
  return _cachedJson;
}

/**
 * Drops the memoised client and memo table.
 *
 * For tests and for the budget verifier, which has to re-read the module under
 * different environments. Not for request code: the whole point of the tiers
 * is that they outlive a request.
 */
export function resetCacheTiers(): void {
  _redis = undefined;
  _cachedJson = undefined;
}

// Default instance: memo → Redis (when live) → fetcher.
export const cachedJson: CachedJson = <T>(
  key: string,
  opts: CacheOpts,
  fetcher: () => Promise<T>,
): Promise<T> => defaultCachedJson()<T>(key, opts, fetcher);
