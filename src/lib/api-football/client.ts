import type { ApiResponse } from "./types";

const API_BASE = "https://v3.football.api-sports.io";

// Either a plain revalidate (today's default) or an explicit cache mode. When a
// call is wrapped by the shared Redis cache, pass `{ cache: "no-store" }` so we
// don't double-cache (Redis is the source of truth there).
export type FetchOpts =
  | number
  | {
      revalidate?: number;
      cache?: "no-store" | "force-cache";
      /**
       * Surface upstream failure instead of degrading to an empty array.
       *
       * `fetchApi` returns `[]` for three very different situations — no API key,
       * an HTTP error, and an API-level error such as an exhausted daily quota —
       * and none of them are distinguishable from "the call succeeded and there
       * was nothing to return". For a list on the homepage that conflation is
       * fine and even desirable: an empty carousel beats a broken page.
       *
       * For a page whose existence depends on the answer it is actively harmful.
       * A match page reading `[]` as "no such fixture" calls `notFound()` and
       * serves a 404, so a quota outage tells Google that real, indexed fixtures
       * are gone. 5xx says "temporary, come back"; 404 says "delete this". Set
       * this wherever a missing result would become a 404.
       */
      throwOnFailure?: boolean;
      /**
       * Upper bound on one upstream round-trip, in milliseconds. Defaults to
       * UPSTREAM_TIMEOUT_MS. A timeout is reported exactly like an HTTP error:
       * `[]`, or ApiFootballUnavailableError under `throwOnFailure`.
       */
      timeoutMs?: number;
    };

/**
 * How long one API-Football call may hold a page open. The API normally answers
 * in well under a second; without a bound, a stalled upstream held article and
 * competition pages for 35–95 s (measured on production, 17 September 2026)
 * until Vercel's own function limit cut them off as 504s. Every caller already
 * degrades gracefully on `[]`, so a timed-out call costs a missing widget, not
 * a hung page.
 */
export const UPSTREAM_TIMEOUT_MS = 4000;

/** Upstream is unreachable or refusing — distinct from "no results". */
export class ApiFootballUnavailableError extends Error {
  constructor(reason: string) {
    super(`API-Football unavailable: ${reason}`);
    this.name = "ApiFootballUnavailableError";
  }
}

export async function fetchApi<T>(
  endpoint: string,
  params: Record<string, string | number>,
  opts: FetchOpts = 60,
): Promise<T[]> {
  const apiKey = process.env.API_FOOTBALL_KEY;
  const throwOnFailure =
    typeof opts === "object" && opts !== null && opts.throwOnFailure === true;

  if (!apiKey) {
    console.warn(`[API-Football] No API_FOOTBALL_KEY configured — returning empty for ${endpoint}`);
    if (throwOnFailure) throw new ApiFootballUnavailableError("no API key configured");
    return [] as T[];
  }

  const url = new URL(endpoint, API_BASE);
  Object.entries(params).forEach(([key, value]) =>
    url.searchParams.set(key, String(value)),
  );

  const normalized = typeof opts === "number" ? { revalidate: opts } : opts;
  const init: RequestInit & { next?: { revalidate: number } } = {
    headers: { "x-apisports-key": apiKey },
    signal: AbortSignal.timeout(normalized.timeoutMs ?? UPSTREAM_TIMEOUT_MS),
  };
  if (normalized.cache) {
    // "no-store" and "next.revalidate" are mutually exclusive in Next.js.
    init.cache = normalized.cache;
  } else {
    init.next = { revalidate: normalized.revalidate ?? 60 };
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), init);
  } catch (error) {
    // AbortSignal.timeout rejects with a DOMException named "TimeoutError";
    // a DNS/TLS failure lands here too. Both are "upstream unavailable".
    const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.error(`[API-Football] request failed for ${endpoint}: ${reason}`);
    if (throwOnFailure) throw new ApiFootballUnavailableError(reason);
    return [] as T[];
  }

  if (!res.ok) {
    console.error(`[API-Football] ${res.status} ${res.statusText} for ${endpoint}`);
    if (throwOnFailure) {
      throw new ApiFootballUnavailableError(`${res.status} ${res.statusText}`);
    }
    return [] as T[];
  }

  const data: ApiResponse<T[]> = await res.json();

  const errs = data.errors;
  const errEntries = Array.isArray(errs)
    ? errs
    : errs && typeof errs === "object"
      ? Object.entries(errs).filter(([, v]) => v != null && v !== "")
      : [];
  if (errEntries.length > 0) {
    console.error(
      `[API-Football] errors for ${endpoint} ${JSON.stringify(params)}: ${JSON.stringify(errs)}`,
    );
    // This is the branch a daily-quota exhaustion lands in: HTTP 200 with an
    // `errors` payload, which is exactly why it reads as an empty result.
    if (throwOnFailure) {
      throw new ApiFootballUnavailableError(JSON.stringify(errs));
    }
    return [] as T[];
  }

  return (data.response ?? []) as T[];
}
