import type { ApiStandingsResponse, ApiStandingRow } from "./types";
import { fetchApi } from "./client";

export async function getStandings(
  leagueId: number,
  season: number,
): Promise<ApiStandingRow[]> {
  const response = await fetchApi<ApiStandingsResponse>(
    "/standings",
    { league: leagueId, season },
    60,
  );

  if (!response[0]?.league?.standings?.[0]) return [];
  return response[0].league.standings[0];
}
