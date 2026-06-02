/**
 * Cleanup for a partial / failed WordPress import.
 *
 * The WP migration creates articles whose slug is the percent-encoded Arabic
 * WP slug (always starts with "%"). The hand-seeded demo articles use clean
 * Latin slugs. So "slug starts with %" reliably selects ONLY the WP-imported
 * articles and never the demo content.
 *
 * Usage:
 *   pnpm tsx scripts/cleanup-partial-import.ts            # DRY RUN: count only
 *   pnpm tsx scripts/cleanup-partial-import.ts --delete   # actually delete
 *
 * Deletes:
 *   - articles whose slug starts with "%"
 *   - redirects whose `from` starts with "/%" (the matching old-WP-URL redirects)
 *
 * Leaves categories/tags/authors in place (the migration reuses them
 * idempotently on the next run). Media is untouched (none uploaded in the
 * failed run anyway).
 */

import "dotenv/config";
import { getPayload } from "payload";
import config from "../src/payload.config";

const DELETE = process.argv.slice(2).includes("--delete");

async function main() {
  const payload = await getPayload({ config });

  // Fetch all articles (there are only a few hundred) and filter in JS.
  const allArticles = await payload.find({
    collection: "articles",
    limit: 10000,
    depth: 0,
    locale: "ar",
  });

  const imported = allArticles.docs.filter(
    (a: any) => typeof a.slug === "string" && a.slug.startsWith("%"),
  );
  const withImage = imported.filter((a: any) => a.featuredImage);
  const withoutImage = imported.length - withImage.length;

  const allRedirects = await payload.find({
    collection: "redirects",
    limit: 10000,
    depth: 0,
  });
  const importedRedirects = allRedirects.docs.filter(
    (r: any) => typeof r.from === "string" && r.from.startsWith("/%"),
  );

  console.log("=== Partial-import cleanup ===");
  console.log(`Total articles in DB:        ${allArticles.totalDocs}`);
  console.log(`WP-imported (slug ^%):       ${imported.length}`);
  console.log(`  - with featured image:     ${withImage.length}`);
  console.log(`  - WITHOUT featured image:  ${withoutImage}`);
  console.log(`WP-import redirects (^/%):    ${importedRedirects.length}`);
  console.log(`Demo/other articles (kept):  ${allArticles.totalDocs - imported.length}`);

  if (!DELETE) {
    console.log(
      "\n(DRY RUN — nothing deleted. Re-run with --delete to remove the above.)",
    );
    process.exit(0);
  }

  console.log("\nDeleting WP-imported articles...");
  let delA = 0;
  for (const a of imported) {
    try {
      await payload.delete({ collection: "articles", id: a.id });
      delA++;
    } catch (err: any) {
      console.error(`  [error] article ${a.id} (${a.slug}): ${err.message}`);
    }
  }

  console.log("Deleting WP-import redirects...");
  let delR = 0;
  for (const r of importedRedirects) {
    try {
      await payload.delete({ collection: "redirects", id: r.id });
      delR++;
    } catch (err: any) {
      console.error(`  [error] redirect ${r.id} (${r.from}): ${err.message}`);
    }
  }

  console.log(`\nDeleted ${delA} articles and ${delR} redirects.`);
  console.log("DB is now clean for a fresh `pnpm migrate:wp -- --limit=200`.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
