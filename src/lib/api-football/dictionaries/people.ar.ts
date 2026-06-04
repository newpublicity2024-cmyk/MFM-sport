import { PEOPLE_AR_GENERATED } from "./people.generated.ar";
import { PEOPLE_AR_OVERRIDES } from "./people.overrides.ar";

/**
 * Arabic player/coach names keyed by api-football person id. Generated layer
 * merged first; hand-curated overrides win. `localizePerson` falls back to the
 * Latin name for any id not present here (the common case).
 */
export const PEOPLE_AR: Record<number, string> = {
  ...PEOPLE_AR_GENERATED,
  ...PEOPLE_AR_OVERRIDES,
};
