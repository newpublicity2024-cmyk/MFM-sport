/**
 * One-off fix: decode percent-encoded article slugs left by the WordPress
 * migration, and align redirect targets.
 *
 * Why: WP returns Arabic post slugs percent-encoded ("%d8%a7..."). Stored
 * literally, they 404 because Next.js decodes the route param before our
 * `slug equals` lookup, so the decoded Arabic never matches the stored "%xx".
 * Decoding the stored slug makes the URL round-trip correctly.
 *
 * Idempotent: only rewrites values that change under decodeURIComponent.
 *
 * Usage:
 *   pnpm tsx scripts/normalize-slugs.ts            # apply
 *   pnpm tsx scripts/normalize-slugs.ts --dry-run  # report only
 */
import "dotenv/config";
import { getPayload } from "payload";
import config from "../src/payload.config";

const DRY = process.argv.includes("--dry-run");

function decode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

const p = await getPayload({ config });

// --- Articles: decode slug ---
let aChecked = 0;
let aUpdated = 0;
let page = 1;
for (;;) {
  const res = await p.find({
    collection: "articles",
    limit: 100,
    page,
    depth: 0,
    pagination: true,
  });
  for (const doc of res.docs as Array<{ id: string | number; slug: string }>) {
    aChecked++;
    const next = decode(doc.slug);
    if (next !== doc.slug) {
      aUpdated++;
      if (!DRY) {
        await p.update({
          collection: "articles",
          id: doc.id,
          data: { slug: next },
        });
      }
    }
  }
  if (!res.hasNextPage) break;
  page++;
}

// --- Redirects: decode the `to` target (leave `from` as the raw WP path) ---
let rChecked = 0;
let rUpdated = 0;
page = 1;
for (;;) {
  const res = await p.find({
    collection: "redirects",
    limit: 100,
    page,
    depth: 0,
    pagination: true,
  });
  for (const doc of res.docs as Array<{ id: string | number; to: string }>) {
    rChecked++;
    const next = decode(doc.to);
    if (next !== doc.to) {
      rUpdated++;
      if (!DRY) {
        await p.update({
          collection: "redirects",
          id: doc.id,
          data: { to: next },
        });
      }
    }
  }
  if (!res.hasNextPage) break;
  page++;
}

console.log(`MODE: ${DRY ? "DRY RUN" : "APPLY"}`);
console.log(`ARTICLES checked=${aChecked} updated=${aUpdated}`);
console.log(`REDIRECTS checked=${rChecked} updated=${rUpdated}`);
process.exit(0);
