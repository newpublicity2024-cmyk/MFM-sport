import { getFixturesByLeague } from "./fixtures";
import { getCurrentSeason } from "./season";
import type { ApiFixture } from "./types";

/**
 * The slice of a Competitions doc the fixture helpers need.
 *
 * Every league the site features now travels as one of these, sourced from the
 * Competitions collection, rather than as a hardcoded id. This module replaces
 * the old `worldcup.ts`, whose league (1) and season (2026) were compile-time
 * constants — which meant the World Cup reappeared anywhere config was empty,
 * and outlived the tournament itself.
 */
export type CompetitionRef = {
  apiFootballId: number;
  /** Admin-configured season — the fallback only; see resolveSeason. */
  season: number;
};

/**
 * The season to query for a competition.
 *
 * API-Football flags exactly one season per league as `current`, so we ask it
 * instead of pinning a year: a league rolls into its new season on its own,
 * with no CMS edit and no deploy. The doc's `season` field is the fallback for
 * when upstream is unavailable (quota exhausted, outage), which is why it stays
 * a required field on the collection.
 */
export async function resolveSeason(comp: CompetitionRef): Promise<number> {
  const { season } = await getCurrentSeason(comp.apiFootballId, comp.season);
  return season;
}

/**
 * A competition's fixtures for its current season.
 *
 * With no options this returns the whole season across every status (finished,
 * live, upcoming) — what the hero panel's three tabs need. `next` / `last`
 * narrow it to upcoming / played, for the article-page sidebar calendar.
 */
export async function getCompetitionFixtures(
  comp: CompetitionRef,
  options?: { next?: number; last?: number },
): Promise<ApiFixture[]> {
  const season = await resolveSeason(comp);
  // Call through with the same arity as before when there are no options, so
  // getFixturesByLeague's React cache() dedupe still hits across callers.
  return options
    ? getFixturesByLeague(comp.apiFootballId, season, options)
    : getFixturesByLeague(comp.apiFootballId, season);
}
