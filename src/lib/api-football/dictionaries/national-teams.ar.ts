import { NATIONAL_TEAMS_AR_GENERATED } from "./national-teams.generated.ar";
import { NATIONAL_TEAMS_AR_OVERRIDES } from "./national-teams.overrides.ar";

/**
 * Proper Arabic country names for national teams, keyed by api-football team id.
 * National teams use the translated country name (e.g. "جنوب إفريقيا"), NOT a
 * transliteration of the English ("سوث أفريكا"). `localizeTeam` checks this
 * before the club dictionary / transliteration, so only national teams are
 * affected. Generated (Wikidata) merged first; hand-curated overrides win.
 */
export const NATIONAL_TEAMS_AR: Record<number, string> = {
  ...NATIONAL_TEAMS_AR_GENERATED,
  ...NATIONAL_TEAMS_AR_OVERRIDES,
};
