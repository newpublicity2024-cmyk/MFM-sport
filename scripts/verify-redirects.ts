/**
 * Verify the redirect map against what the site actually serves.
 *
 * The redirect map sat broken for months behind a row count: 200 rows existed,
 * so "a 301 map exists" was reported, and none of them had ever fired. This
 * script asserts on the artefact instead of the table — see
 * docs/verification-principles.md.
 *
 * It probes `/api/redirects?from=<normalized>` for every row, which is the exact
 * request middleware makes. Deliberately NOT the full legacy-URL chain: that
 * would fetch all 200 article URLs and consume the untouched sample someone may
 * want for an independent spot-check. Use --chain on a single row for that.
 *
 * Note the lookup endpoint is CDN-cached for 24h and caches MISSES as
 * aggressively as hits, so a key probed while the map was still broken can hold
 * a stale `{to: null}`. Those show up here as `stale-null`, distinguished from a
 * genuine miss by the row existing in the database.
 *
 * Usage:
 *   pnpm redirects:verify
 *   pnpm redirects:verify --origin=https://www.mfmsport.ma
 */

// Must precede the @payload-config import — see normalize-redirects.ts.
import "dotenv/config";
import { getPayload } from "payload";
import config from "@payload-config";

const ORIGIN =
  process.argv.find((a) => a.startsWith("--origin="))?.split("=")[1] ??
  "https://www.mfmsport.ma";

type Row = { id: string | number; from: string; to: string };

async function main() {
  const payload = await getPayload({ config });

  const rows: Row[] = [];
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
    rows.push(...(res.docs as Row[]));
    if (!res.hasNextPage) break;
    page++;
  }

  console.log(`\n=== Verify redirect map against ${ORIGIN} ===`);
  console.log(`rows: ${rows.length}\n`);

  let resolved = 0;
  let staleNull = 0;
  let wrongTarget = 0;
  let errored = 0;
  const problems: string[] = [];

  for (const row of rows) {
    const url = `${ORIGIN}/api/redirects?from=${encodeURIComponent(row.from)}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      const cache = res.headers.get("x-vercel-cache") ?? "?";
      const body = (await res.json()) as { to?: string | null };

      if (!body.to) {
        // The row exists in the database, so a null answer is the CDN serving a
        // negative cached before the repair — not a missing redirect.
        staleNull++;
        problems.push(`stale-null [${cache}] ${row.from}`);
      } else if (body.to !== row.to) {
        wrongTarget++;
        problems.push(`wrong-target ${row.from} -> ${body.to} (expected ${row.to})`);
      } else {
        resolved++;
      }
    } catch (err) {
      errored++;
      problems.push(`error ${row.from}: ${(err as Error).message}`);
    }
  }

  console.log(`  resolves correctly: ${resolved}`);
  console.log(`  stale null (CDN):   ${staleNull}`);
  console.log(`  wrong target:       ${wrongTarget}`);
  console.log(`  errored:            ${errored}`);

  if (problems.length) {
    console.log(`\n  first ${Math.min(15, problems.length)} problems:`);
    for (const p of problems.slice(0, 15)) console.log(`    ${p}`);
  }

  console.log(
    `\n${resolved === rows.length ? "OK — every row resolves." : "INCOMPLETE — see above."}\n`,
  );
  process.exit(resolved === rows.length ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
