/**
 * One-off repair: fix tag and category slugs that cannot be reached.
 *
 * Why: the sitemap listed 1,000 tag URLs and 64 category URLs, and 251 of the
 * tags and 22 of the categories contained a raw space — 226 tags a TRAILING
 * space — because names had been pasted into the slug field. None of those
 * URLs resolve in any encoding (verified on production, 17 September 2026), so
 * a quarter of the sitemap was dead links, which is a trust signal Google
 * applies to the rest of the file — including the 8,167 articles the archive
 * release just added.
 *
 * Only broken slugs (whitespace or percent-encoding) are rewritten, through
 * `repairTaxonomySlug`; a slug that already resolves is never touched, so no
 * working URL changes. The collections' beforeValidate hook now applies the
 * same rule on save, so this runs once for existing rows.
 *
 * `slug` is UNIQUE. Where the repaired value already belongs to another row
 * (e.g. "x " and "x" both exist) the row is reported as a COLLISION and left
 * alone: merging tags is an editorial decision, not a script's.
 *
 * Run it against a Neon branch first, as the redirect normaliser was.
 *
 * Usage:
 *   pnpm slugs:normalize:dry
 *   pnpm slugs:normalize
 */

// Must precede the @payload-config import: payload.config.ts throws at module
// load if PAYLOAD_SECRET/DATABASE_URL are absent, and a bare `tsx` run does not
// read .env the way `next` does.
import "dotenv/config";
import { getPayload, type Payload } from "payload";
import config from "@payload-config";
import { repairTaxonomySlug } from "../src/lib/payload/slugFromTitle";

const DRY_RUN = process.argv.includes("--dry-run");
type Taxonomy = "tags" | "categories";

async function repairCollection(payload: Payload, collection: Taxonomy) {
  let checked = 0;
  let updated = 0;
  let collisions = 0;
  const taken = new Set<string>();

  // Load every slug first so collisions are checked against the final state,
  // not the state mid-way through the loop.
  const all: { id: string | number; slug: string }[] = [];
  for (let page = 1; ; page++) {
    const res = await payload.find({
      collection,
      limit: 500,
      page,
      depth: 0,
      pagination: true,
      select: { slug: true },
    });
    for (const doc of res.docs as { id: string | number; slug: string }[]) all.push(doc);
    if (!res.hasNextPage) break;
  }
  for (const doc of all) taken.add(doc.slug);

  for (const doc of all) {
    checked++;
    const next = repairTaxonomySlug(doc.slug);
    if (!next) continue;
    if (taken.has(next)) {
      collisions++;
      console.log(`  COLLISION ${collection}#${doc.id}: ${JSON.stringify(doc.slug)} → ${JSON.stringify(next)} (already taken)`);
      continue;
    }
    taken.add(next);
    console.log(`  ${collection}#${doc.id}: ${JSON.stringify(doc.slug)} → ${JSON.stringify(next)}`);
    if (!DRY_RUN) {
      await payload.update({ collection, id: doc.id, data: { slug: next } });
    }
    updated++;
  }

  return { checked, updated, collisions };
}

async function main() {
  const payload = await getPayload({ config });

  console.log(`\n=== Repair taxonomy slugs ===`);
  console.log(`mode: ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE"}\n`);

  const tags = await repairCollection(payload, "tags");
  const categories = await repairCollection(payload, "categories");

  console.log(`\nTAGS       checked=${tags.checked} updated=${tags.updated} collisions=${tags.collisions}`);
  console.log(`CATEGORIES checked=${categories.checked} updated=${categories.updated} collisions=${categories.collisions}`);
  if (tags.collisions + categories.collisions > 0) {
    console.log(`\nCollisions need an editor: merge the duplicate tag/category in the admin, then re-run.`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
