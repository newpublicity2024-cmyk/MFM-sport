import { getFixturesByLeague } from "./fixtures";
import type { ApiFixture } from "./types";

// API-Football: league id 1 is the FIFA World Cup; season 2026 = the 2026 edition.
export const WORLD_CUP_LEAGUE_ID = 1;
export const WORLD_CUP_SEASON = 2026;

// Upcoming ("to be played") World Cup 2026 fixtures. `next` returns the soonest
// not-yet-played matches; we pull a generous window so the slider can scroll.
export async function getWorldCupFixtures(): Promise<ApiFixture[]> {
  return getFixturesByLeague(WORLD_CUP_LEAGUE_ID, WORLD_CUP_SEASON, { next: 50 });
}
