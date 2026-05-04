import type { ApiFixture } from "./types";
import { fetchApi } from "./client";

export async function getFixturesByDate(date: string): Promise<ApiFixture[]> {
  return fetchApi<ApiFixture>("/fixtures", { date }, 60);
}

export async function getFixtureById(id: number): Promise<ApiFixture | null> {
  const fixtures = await fetchApi<ApiFixture>("/fixtures", { id }, 60);
  return fixtures[0] || null;
}

export async function getFixturesByLeague(
  leagueId: number,
  season: number,
  options?: { from?: string; to?: string; last?: number; next?: number },
): Promise<ApiFixture[]> {
  const params: Record<string, string | number> = { league: leagueId, season };
  if (options?.from) params.from = options.from;
  if (options?.to) params.to = options.to;
  if (options?.last) params.last = options.last;
  if (options?.next) params.next = options.next;
  return fetchApi<ApiFixture>("/fixtures", params, 60);
}

export async function getFixturesByTeam(
  teamId: number,
  season: number,
  options?: { last?: number; next?: number },
): Promise<ApiFixture[]> {
  const params: Record<string, string | number> = { team: teamId, season };
  if (options?.last) params.last = options.last;
  if (options?.next) params.next = options.next;
  return fetchApi<ApiFixture>("/fixtures", params, 60);
}

export async function getLiveFixtures(): Promise<ApiFixture[]> {
  return fetchApi<ApiFixture>("/fixtures", { live: "all" }, 30);
}
