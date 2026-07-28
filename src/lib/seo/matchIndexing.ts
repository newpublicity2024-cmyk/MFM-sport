import type { ApiFixture } from "@/lib/api-football/types";

/**
 * Which fixtures are worth putting in Google's index.
 *
 * The API-Football pipeline returns every fixture in every league worldwide, and
 * each one renders a crawlable /ar/matches/[id] page carrying ~25 words. Left
 * unrestricted that is tens of thousands of near-empty URLs competing with the
 * newsroom's actual journalism — and GA4 confirms it is not theoretical:
 * fixture pages are the only content pages in the site's top-viewed list, while
 * no article appears at all.
 *
 * So: a fixture earns indexation if it is one an MFM Sport reader would plausibly
 * search for. Everything else stays reachable (users deep-link to them, and they
 * are linked from the fixtures list) but is marked noindex.
 */

// API-Football league IDs. Mirrors the Arabic dictionary in
// lib/api-football/dictionaries/leagues.ar.ts, which is the set we can render
// properly localized names for.
export const INDEXABLE_LEAGUE_IDS = new Set<number>([
  1, // FIFA World Cup
  2, // UEFA Champions League
  3, // UEFA Europa League
  4, // Euro Championship
  5, // UEFA Nations League
  6, // Africa Cup of Nations
  12, // CAF Champions League
  20, // CAF Confederation Cup
  29, // World Cup qualification, Africa
  39, // Premier League
  61, // Ligue 1
  78, // Bundesliga
  135, // Serie A
  140, // La Liga
  200, // Botola Pro 1
  201, // Botola Pro 2
  202, // Coupe du Trône
]);

/** Any competition hosted in Morocco counts, whatever its league id. */
const MOROCCAN_COUNTRIES = new Set(["morocco", "maroc", "المغرب"]);

/** Morocco's national teams, so friendlies and one-off tournaments still qualify. */
function isMoroccanNationalTeam(name: string): boolean {
  return /^morocco(\s|$)|^maroc(\s|$)/i.test(name.trim());
}

export function isIndexableFixture(fixture: ApiFixture): boolean {
  if (INDEXABLE_LEAGUE_IDS.has(fixture.league.id)) return true;

  if (MOROCCAN_COUNTRIES.has(fixture.league.country?.trim().toLowerCase() ?? "")) {
    return true;
  }

  return (
    isMoroccanNationalTeam(fixture.teams.home.name) ||
    isMoroccanNationalTeam(fixture.teams.away.name)
  );
}
