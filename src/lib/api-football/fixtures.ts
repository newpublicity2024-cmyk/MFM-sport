import { cache } from "react";
import type { ApiFixture } from "./types";
import { fetchApi } from "./client";
import { cachedJson, type CacheOpts } from "@/lib/cache";
import { TTL, STALE } from "./ttl";

/**
 * Route a `/fixtures` call through the shared cache.
 *
 * Two things changed here and both matter for quota:
 *
 * 1. This no longer branches on `hasUpstash()`. It used to call `cachedJson`
 *    only when Redis credentials were present and otherwise hand the request
 *    straight to `fetchApi` — which meant that on a deployment without those
 *    exact variable names (i.e. every Vercel deployment this project has ever
 *    had) nothing between the getter and the network retained anything. The
 *    cache now always runs; Redis is one optional tier inside it.
 * 2. `revalidate` is derived from `opts.ttlSeconds` rather than passed
 *    separately, so the Next-level and cache-level ages cannot drift apart
 *    the way they had (see `./ttl`).
 *
 * `next.revalidate` is kept rather than `cache: "no-store"` even when Redis is
 * live: `no-store` would opt the calling route out of static rendering, and
 * these getters are read from ISR pages whose caching is doing real work.
 * Several tiers holding the same bounded-age value is harmless; losing ISR is
 * not.
 *
 * The public getters stay wrapped in React `cache()` for per-request dedupe,
 * but note that it only spans one render pass — `generateMetadata` and the page
 * body are separate passes, which is why the match page used to issue two
 * identical `/fixtures?id=` requests. The memo tier is what collapses those.
 */
function fixturesCached(
  key: string,
  opts: CacheOpts,
  params: Record<string, string | number>,
  { throwOnFailure = false }: { throwOnFailure?: boolean } = {},
): Promise<ApiFixture[]> {
  return cachedJson(key, opts, () =>
    fetchApi<ApiFixture>("/fixtures", params, {
      revalidate: opts.ttlSeconds,
      throwOnFailure,
    }),
  );
}

function isTodayUtc(date: string): boolean {
  return date === new Date().toISOString().slice(0, 10);
}

export const getFixturesByDate = cache((date: string): Promise<ApiFixture[]> => {
  // Today: short TTL (live scores overlay this via the live endpoint). Past/
  // future dates: schedules and results barely move → cache much longer.
  const opts = isTodayUtc(date)
    ? { ttlSeconds: TTL.DATE_TODAY, staleSeconds: STALE.DATE_TODAY }
    : { ttlSeconds: TTL.DATE_OTHER, staleSeconds: STALE.DATE_OTHER };
  return fixturesCached(`date:${date}`, opts, { date });
});

/**
 * A single fixture, for the match page.
 *
 * Unlike the list getters this one THROWS when upstream is unavailable rather
 * than degrading to null. The match page turns null into `notFound()`, so with
 * the old behaviour an exhausted daily quota made every real fixture page serve
 * a 404 — telling Google to drop pages that exist. A thrown error surfaces as
 * 5xx instead, which crawlers treat as "temporary, retry" and which costs no
 * indexing. Returning null stays reserved for its true meaning: the fixture id
 * does not exist.
 */
export const getFixtureById = cache(
  async (id: number): Promise<ApiFixture | null> => {
    const fixtures = await fixturesCached(
      `fx:${id}`,
      { ttlSeconds: TTL.FIXTURE_BY_ID },
      { id },
      { throwOnFailure: true },
    );
    return fixtures[0] || null;
  },
);

export const getFixturesByLeague = cache(
  (
    leagueId: number,
    season: number,
    options?: { from?: string; to?: string; last?: number; next?: number },
  ): Promise<ApiFixture[]> => {
    const params: Record<string, string | number> = { league: leagueId, season };
    if (options?.from) params.from = options.from;
    if (options?.to) params.to = options.to;
    if (options?.last) params.last = options.last;
    if (options?.next) params.next = options.next;
    const tag = options?.last
      ? `last:${options.last}`
      : options?.next
        ? `next:${options.next}`
        : options?.from
          ? `from:${options.from}-${options.to ?? ""}`
          : "all";
    return fixturesCached(
      `lg:${leagueId}:${season}:${tag}`,
      { ttlSeconds: TTL.LEAGUE_SEASON, staleSeconds: STALE.LEAGUE_SEASON },
      params,
    );
  },
);

export const getFixturesByTeam = cache(
  (
    teamId: number,
    season: number,
    options?: { last?: number; next?: number },
  ): Promise<ApiFixture[]> => {
    const params: Record<string, string | number> = { team: teamId, season };
    if (options?.last) params.last = options.last;
    if (options?.next) params.next = options.next;
    const tag = options?.last
      ? `last:${options.last}`
      : options?.next
        ? `next:${options.next}`
        : "all";
    return fixturesCached(
      `tm:${teamId}:${season}:${tag}`,
      { ttlSeconds: TTL.TEAM_FIXTURES, staleSeconds: STALE.TEAM_FIXTURES },
      params,
    );
  },
);

/**
 * A team's last `last` played fixtures regardless of season — the form a
 * match page shows. Season-bound reads (`getFixturesByTeam`) go empty for
 * the first weeks of a campaign; API-Football's `team` + `last` without a
 * season keeps counting back into the previous one.
 */
export const getTeamRecentFixtures = cache(
  (teamId: number, last: number): Promise<ApiFixture[]> =>
    fixturesCached(
      `tm:${teamId}:last:${last}`,
      { ttlSeconds: TTL.TEAM_FIXTURES, staleSeconds: STALE.TEAM_FIXTURES },
      { team: teamId, last },
    ),
);

export const getLiveFixtures = cache(
  (): Promise<ApiFixture[]> =>
    fixturesCached("live:all", { ttlSeconds: TTL.LIVE_ALL }, { live: "all" }),
);

// --- League scoping (Part B) ------------------------------------------------

// Live fixtures restricted to the leagues the site actually lists (Competitions
// collection). One upstream request (live=all is cached), filtered server-side.
// Fail-open: an empty league list returns everything rather than blanking.
export async function getLiveFixturesForLeagues(
  leagueIds: number[],
): Promise<ApiFixture[]> {
  const all = await getLiveFixtures();
  if (leagueIds.length === 0) return all;
  const set = new Set(leagueIds);
  return all.filter((f) => set.has(f.league.id));
}

// Today's (or any date's) fixtures restricted to our leagues. The upstream
// /fixtures?date= call returns all leagues in one request; filtering is free.
export async function getFixturesByDateForLeagues(
  date: string,
  leagueIds: number[],
): Promise<ApiFixture[]> {
  const all = await getFixturesByDate(date);
  if (leagueIds.length === 0) {
    console.warn(
      "[API-Football] getFixturesByDateForLeagues: no league ids — returning unfiltered",
    );
    return all;
  }
  const set = new Set(leagueIds);
  return all.filter((f) => set.has(f.league.id));
}
