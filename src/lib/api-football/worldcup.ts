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

// Every World Cup 2026 fixture across all statuses (finished, live, upcoming).
// Passing no `next`/`last` returns the full season, so the hero matches panel's
// finished/live/scheduled tabs all stay populated with World Cup matches only.
export async function getAllWorldCupFixtures(): Promise<ApiFixture[]> {
  return getFixturesByLeague(WORLD_CUP_LEAGUE_ID, WORLD_CUP_SEASON);
}
