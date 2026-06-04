import { TEAMS_AR_GENERATED } from "./teams.generated.ar";
import { TEAMS_AR_OVERRIDES } from "./teams.overrides.ar";

/**
 * Arabic team names keyed by api-football team id. The generated layer (sourced
 * from Wikidata via scripts/build-ar-dictionaries.ts) is merged first; the
 * hand-curated overrides win on conflict. `localizeTeam` falls back to the
 * Latin name for any id not present here.
 */
export const TEAMS_AR: Record<number, string> = {
  ...TEAMS_AR_GENERATED,
  ...TEAMS_AR_OVERRIDES,
};
