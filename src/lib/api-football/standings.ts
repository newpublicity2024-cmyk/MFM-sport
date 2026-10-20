import { cache } from "react";
import type { ApiStandingsResponse, ApiStandingRow } from "./types";
import { fetchApi } from "./client";
import { cachedJson } from "@/lib/cache";
import { TTL, STALE } from "./ttl";

/** How fresh the caller needs the table to be. See `./ttl`. */
export type StandingsFreshness = { maxAgeSeconds?: number };

/**
 * Every group of a competition's table — one array per group, in API order.
 *
 * A league has exactly one group; AFCON, the CAF Champions League and the
 * World Cup have several, and a match page must pick the group its two teams
 * sit in rather than assume the first. One upstream call, shared by every page
 * that reads any group of the same league.
 *
 * `maxAgeSeconds` is the reader's tolerance, not a stored expiry. The
 * competition page accepts an hour (`TTL.STANDINGS`); `/api/standings`, which
 * `LiveStandings` polls while a match in the league is in play, asks for a
 * minute (`TTL.STANDINGS_LIVE`). Both share one cache entry — the stricter
 * reader just refreshes it sooner. Before this existed the two were reconciled
 * by accident: the Redis tier said an hour, the fetch said a minute, and only
 * the fetch ran.
 */
export const getStandingsGroups = cache(
  async (
    leagueId: number,
    season: number,
    freshness: StandingsFreshness = {},
  ): Promise<ApiStandingRow[][]> => {
    const params = { league: leagueId, season };
    const ttlSeconds = freshness.maxAgeSeconds ?? TTL.STANDINGS;
    const response = await cachedJson(
      `stand:${leagueId}:${season}`,
      { ttlSeconds, staleSeconds: STALE.STANDINGS },
      () =>
        fetchApi<ApiStandingsResponse>("/standings", params, {
          revalidate: ttlSeconds,
        }),
    );

    return response[0]?.league?.standings ?? [];
  },
);

/** The first (for a league: the only) group — what the competition page renders. */
export const getStandings = cache(
  async (
    leagueId: number,
    season: number,
    freshness: StandingsFreshness = {},
  ): Promise<ApiStandingRow[]> => {
    const groups = await getStandingsGroups(leagueId, season, freshness);
    return groups[0] ?? [];
  },
);
