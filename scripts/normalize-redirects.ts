/**
 * One-off repair: rewrite `redirects.from` into the canonical form.
 *
 * Why this is needed: the redirect map was matched as an exact string, but the
 * stored values never matched what middleware actually receives. WordPress wrote
 * permalinks percent-encoded in lowercase hex with a trailing slash, and the
 * platform 308-normalises incoming requests to uppercase hex without one. So
 * every Arabic legacy URL — effectively the whole map — looked up as "no
 * redirect" and fell through to a 404. Verified against production: a URL
 * present in the map resolved 308 → 307 → 200 soft-404, never touching its
 * redirect.
 *
 * This rewrites existing rows through normalizeLegacyPath so they match. The
 * importer now stores the canonical form directly, so this only has to be run
 * once for rows created before that change.
 *
 * `from` is UNIQUE, so collisions are possible where two raw values normalise to
 * the same path. Duplicates are reported and removed, keeping the oldest row.
 *
 * Usage:
 *   pnpm redirects:normalize:dry
 *   pnpm redirects:normalize
 */

// Must precede the @payload-config import: payload.config.ts throws at module
// load if PAYLOAD_SECRET/DATABASE_URI are absent, and a bare `tsx` run does not
// read .env the way `next` does.
import "dotenv/config";
import { getPayload } from "payload";
import config from "@payload-config";
import { normalizeLegacyPath } from "../src/lib/seo/legacyPath";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const payload = await getPayload({ config });

  console.log(`\n=== Normalise redirect map ===`);
  console.log(`mode: ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE"}\n`);

  const all: { id: string | number; from: string; to: string; createdAt?: string }[] = [];
  let page = 1;
  for (;;) {
    const res = await payload.find({
      collection: "redirects",
      limit: 500,
      page,
      depth: 0,
      pagination: true,
      sort: "createdAt",
    });
    all.push(...(res.docs as typeof all));
    if (!res.hasNextPage) break;
    page++;
  }
  console.log(`loaded ${all.length} redirects`);

  const seen = new Map<string, (typeof all)[number]>();
  const toUpdate: { id: string | number; from: string; next: string }[] = [];
  const toDelete: { id: string | number; from: string; keptFrom: string }[] = [];

  for (const row of all) {
    const next = normalizeLegacyPath(row.from);
    const winner = seen.get(next);
    if (winner) {
      // Two raw spellings of the same URL. Keep the oldest (sorted above).
      toDelete.push({ id: row.id, from: row.from, keptFrom: winner.from });
      continue;
    }
    seen.set(next, row);
    if (next !== row.from) toUpdate.push({ id: row.id, from: row.from, next });
  }

  console.log(`  unchanged:  ${all.length - toUpdate.length - toDelete.length}`);
  console.log(`  to rewrite: ${toUpdate.length}`);
  console.log(`  duplicates: ${toDelete.length}\n`);

  for (const d of toDelete.slice(0, 10)) {
    console.log(`  [dup] ${d.from.slice(0, 60)}  (keeping ${d.keptFrom.slice(0, 40)})`);
  }
  for (const u of toUpdate.slice(0, 5)) {
    console.log(`  [rewrite] ${u.from.slice(0, 52)}\n         -> ${u.next.slice(0, 52)}`);
  }

  if (DRY_RUN) {
    console.log(`\nDRY RUN — nothing written.`);
    return;
  }

  // Delete duplicates first, so rewrites cannot collide with a row that is
  // about to be removed.
  let deleted = 0;
  for (const d of toDelete) {
    await payload.delete({ collection: "redirects", id: d.id });
    deleted++;
  }

  let updated = 0;
  for (const u of toUpdate) {
    try {
      await payload.update({
        collection: "redirects",
        id: u.id,
        data: { from: u.next },
        context: { disableRevalidate: true },
      });
      updated++;
    } catch (err: unknown) {
      console.error(`  [fail] ${u.from.slice(0, 50)}: ${(err as Error).message}`);
    }
  }

  console.log(`\n=== Done ===`);
  console.log(`  deleted duplicates: ${deleted}`);
  console.log(`  rewritten:          ${updated}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
