/**
 * MFM Sport — Homepage Settings Seed
 *
 * Usage:
 *   pnpm seed:homepage
 *
 * Prereq: the homepage-global tables must exist (see
 * docs/archive-import-runbook.md for how DDL is applied on this database).
 *
 * - Seeds the hero matches panel with Europe's big four in this order:
 *   Premier League, La Liga, Serie A, Bundesliga — whichever of them exist in
 *   the Competitions collection (matched by API-Football league id).
 * - Sets the lower matches section to today's fixtures across all leagues.
 * - Leaves the latest-news tag chips EMPTY, so the section derives them from
 *   the tags the newest articles carry (see lib/home/latestNewsTags).
 *
 * Idempotent: re-running overwrites the hero list and lower matches mode. It
 * does not touch latestNewsTags, so an editor's chosen chips survive a re-run.
 */

import "dotenv/config";
import { getPayload } from "payload";
import config from "../src/payload.config";

/** API-Football league ids, in the order the hero panel should list them. */
const BIG_FOUR_API_IDS = [39, 140, 135, 78] as const; // PL, La Liga, Serie A, Bundesliga

async function main() {
  const payload = await getPayload({ config });

  const comps = (
    await payload.find({ collection: "competitions", limit: 200, depth: 0, pagination: false })
  ).docs;

  const leagues = BIG_FOUR_API_IDS.map((apiId) => comps.find((c) => c.apiFootballId === apiId))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => ({ competition: c.id }));

  const missing = BIG_FOUR_API_IDS.filter(
    (apiId) => !comps.some((c) => c.apiFootballId === apiId),
  );
  if (missing.length > 0) {
    console.warn(`big-four leagues missing from Competitions (API-Football ids): ${missing.join(", ")}`);
  }

  await payload.updateGlobal({
    slug: "homepage",
    data: {
      heroMatches: { leagues },
      homeMatches: { mode: "today" },
    },
  });
  console.log(
    `seeded homepage global: hero panel = ${leagues.length} leagues, lower = today; latest-news tags left to the editor`,
  );

  console.log("done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
