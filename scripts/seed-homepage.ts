/**
 * MFM Sport — Homepage Settings Seed
 *
 * Usage:
 *   pnpm seed:homepage
 *
 * Prereq: the homepage-global migration must be applied first
 * (`pnpm payload migrate`), otherwise the `homepage` table doesn't exist.
 *
 * - Ensures a "World Cup" tag (ar/fr/en) exists.
 * - Ensures a World Cup competition (API-Football league id 1) exists.
 * - Seeds the Homepage Settings global: news filter = [World Cup, …domestic
 *   leagues (Botola first) with the last one dropped], lower matches = today's
 *   fixtures across all leagues.
 *
 * Deliberately does NOT set `heroMatches`. Which league the site features is an
 * editor's choice now (Competitions → Display order, or an explicit pick in
 * Homepage Settings — see docs/featured-competition.md). This script used to
 * pin the hero panel to the World Cup, so a re-run would silently undo that
 * choice and put a finished tournament back on the homepage.
 *
 * Idempotent: re-running re-derives and overwrites the news filter and lower
 * matches; tag/competition are created only if missing.
 */

import "dotenv/config";
import { getPayload } from "payload";
import config from "../src/payload.config";

const WORLD_CUP_API_ID = 1;
const WORLD_CUP_SEASON = 2026;
const BOTOLA_API_ID = 200;

async function main() {
  const payload = await getPayload({ config });

  // 1) World Cup tag (localized).
  let wcTag = (
    await payload.find({ collection: "tags", where: { slug: { equals: "world-cup" } }, limit: 1 })
  ).docs[0];
  if (!wcTag) {
    wcTag = await payload.create({
      collection: "tags",
      locale: "ar",
      data: { name: "كأس العالم", slug: "world-cup" },
    });
    await payload.update({ collection: "tags", id: wcTag.id, locale: "fr", data: { name: "Coupe du monde" } });
    await payload.update({ collection: "tags", id: wcTag.id, locale: "en", data: { name: "World Cup" } });
    console.log(`created tag: world-cup (#${wcTag.id})`);
  } else {
    console.log(`skip (exists) tag: world-cup (#${wcTag.id})`);
  }

  // 2) Competitions.
  const comps = (
    await payload.find({ collection: "competitions", limit: 200, depth: 0, pagination: false })
  ).docs;

  let wc = comps.find((c) => c.apiFootballId === WORLD_CUP_API_ID);
  if (!wc) {
    wc = await payload.create({
      collection: "competitions",
      locale: "ar",
      data: {
        name: "كأس العالم",
        slug: "world-cup",
        type: "cup",
        apiFootballId: WORLD_CUP_API_ID,
        season: WORLD_CUP_SEASON,
        logoUrl: "/images/world-cup-2026.png",
        // Ranked behind the domestic leagues so a cup that runs once every four
        // years never becomes the site-wide default competition.
        displayOrder: 90,
      },
    });
    await payload.update({ collection: "competitions", id: wc.id, locale: "fr", data: { name: "Coupe du monde" } });
    await payload.update({ collection: "competitions", id: wc.id, locale: "en", data: { name: "World Cup" } });
    console.log(`created competition: world-cup (#${wc.id})`);
  } else {
    console.log(`skip (exists) competition: world-cup (#${wc.id})`);
  }

  // Domestic leagues, Botola first, drop the last one (per request).
  const leagues = comps
    .filter((c) => c.type === "league")
    .sort((a, b) => (a.apiFootballId === BOTOLA_API_ID ? -1 : b.apiFootballId === BOTOLA_API_ID ? 1 : 0));
  const leaguesKept = leagues.slice(0, Math.max(0, leagues.length - 1));
  if (leagues.length > 0) {
    console.log(
      `leagues: ${leagues.length} found, dropping last (${leagues[leagues.length - 1]?.slug}); keeping ${leaguesKept.length}`,
    );
  }

  // 3) News filter: World Cup (by tag) first, then leagues (category fallback).
  const newsFilters = [
    { competition: wc.id, tag: wcTag.id },
    ...leaguesKept.map((c) => ({ competition: c.id })),
  ];

  await payload.updateGlobal({
    slug: "homepage",
    data: {
      newsFilters,
      homeMatches: { mode: "today" },
    },
  });
  console.log(
    `seeded homepage global: ${newsFilters.length} filter rows, lower = today; hero left to the editor's choice`,
  );

  console.log("done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
