import { cache } from "react";
import type { ApiFixture } from "./types";
import { fetchApi } from "./client";
import { cachedJson, hasUpstash } from "@/lib/cache";

// Route a /fixtures call through the shared Redis cache when Upstash is
// configured, else fall back to Next.js fetch-cache (today's exact behavior).
// The public getters below are additionally wrapped in React cache() for
// per-request dedupe (e.g. getFixtureById is called twice while rendering a
// match page — once in generateMetadata, once in the body).
function fixturesCached(
  key: string,
  opts: { ttlSeconds: number; staleSeconds?: number },
  revalidate: number,
  params: Record<string, string | number>,
): Promise<ApiFixture[]> {
  if (hasUpstash()) {
    return cachedJson(key, opts, () =>
      fetchApi<ApiFixture>("/fixtures", params, { cache: "no-store" }),
    );
  }
  return fetchApi<ApiFixture>("/fixtures", params, revalidate);
}

function isTodayUtc(date: string): boolean {
  return date === new Date().toISOString().slice(0, 10);
}

export const getFixturesByDate = cache((date: string): Promise<ApiFixture[]> => {
  // Today: short TTL (live scores overlay this via the live endpoint). Past/
  // future dates: schedules and results barely move → cache much longer.
  const opts = isTodayUtc(date)
    ? { ttlSeconds: 60, staleSeconds: 120 }
    : { ttlSeconds: 1800, staleSeconds: 3600 };
  return fixturesCached(`date:${date}`, opts, 60, { date });
});

export const getFixtureById = cache(
  async (id: number): Promise<ApiFixture | null> => {
    const fixtures = await fixturesCached(`fx:${id}`, { ttlSeconds: 30 }, 30, {
      id,
    });
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
      { ttlSeconds: 900, staleSeconds: 1800 },
      60,
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
      { ttlSeconds: 900, staleSeconds: 1800 },
      60,
      params,
    );
  },
);

export const getLiveFixtures = cache(
  (): Promise<ApiFixture[]> =>
    fixturesCached("live:all", { ttlSeconds: 30 }, 30, { live: "all" }),
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
