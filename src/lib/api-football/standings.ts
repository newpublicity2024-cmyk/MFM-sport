import { cache } from "react";
import type { ApiStandingsResponse, ApiStandingRow } from "./types";
import { fetchApi } from "./client";
import { cachedJson, hasUpstash } from "@/lib/cache";

/**
 * Every group of a competition's table — one array per group, in API order.
 *
 * A league has exactly one group; AFCON, the CAF Champions League and the
 * World Cup have several, and a match page must pick the group its two teams
 * sit in rather than assume the first. One upstream call, cached for an hour,
 * shared by every page that reads any group of the same league.
 */
export const getStandingsGroups = cache(
  async (leagueId: number, season: number): Promise<ApiStandingRow[][]> => {
    const params = { league: leagueId, season };
    const response = hasUpstash()
      ? await cachedJson(
          `stand:${leagueId}:${season}`,
          { ttlSeconds: 3600, staleSeconds: 3600 },
          () =>
            fetchApi<ApiStandingsResponse>("/standings", params, {
              cache: "no-store",
            }),
        )
      : await fetchApi<ApiStandingsResponse>("/standings", params, 60);

    return response[0]?.league?.standings ?? [];
  },
);

/** The first (for a league: the only) group — what the competition page renders. */
export const getStandings = cache(
  async (leagueId: number, season: number): Promise<ApiStandingRow[]> => {
    const groups = await getStandingsGroups(leagueId, season);
    return groups[0] ?? [];
  },
);
