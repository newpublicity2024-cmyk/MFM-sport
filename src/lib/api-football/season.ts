import { cache } from "react";
import type { ApiLeagueInfo } from "./types";
import { fetchApi } from "./client";
import { cachedJson, hasUpstash } from "@/lib/cache";

export type SeasonInfo = { season: number; start: string | null; end: string | null };

// Pure selection logic, exported for testing. Prefer the season API-Football
// marks `current`; otherwise the latest year present; otherwise the fallback.
export function pickCurrentSeason(
  info: ApiLeagueInfo | undefined,
  fallback: number,
): SeasonInfo {
  const seasons = info?.seasons ?? [];
  if (seasons.length === 0) return { season: fallback, start: null, end: null };
  const current = seasons.find((s) => s.current);
  const chosen = current ?? seasons.reduce((a, b) => (b.year > a.year ? b : a));
  return { season: chosen.year, start: chosen.start ?? null, end: chosen.end ?? null };
}

export const getCurrentSeason = cache(
  async (leagueId: number, fallback: number): Promise<SeasonInfo> => {
    const params = { id: leagueId };
    const response = hasUpstash()
      ? await cachedJson(
          `cur-season:${leagueId}`,
          { ttlSeconds: 21600, staleSeconds: 21600 },
          () => fetchApi<ApiLeagueInfo>("/leagues", params, { cache: "no-store" }),
        )
      : await fetchApi<ApiLeagueInfo>("/leagues", params, 21600);
    return pickCurrentSeason(response[0], fallback);
  },
);
