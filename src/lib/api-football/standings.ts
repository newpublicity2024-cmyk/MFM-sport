import { cache } from "react";
import type { ApiStandingsResponse, ApiStandingRow } from "./types";
import { fetchApi } from "./client";
import { cachedJson, hasUpstash } from "@/lib/cache";

export const getStandings = cache(
  async (leagueId: number, season: number): Promise<ApiStandingRow[]> => {
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

    if (!response[0]?.league?.standings?.[0]) return [];
    return response[0].league.standings[0];
  },
);
