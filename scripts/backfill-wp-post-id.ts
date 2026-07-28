/**
 * Backfill `wpPostId` / `legacySlug` onto articles imported before those fields
 * existed.
 *
 * Why this must run before the archive import: the importer's resume checkpoint
 * IS the set of `wpPostId` values already in the database. The 398 articles from
 * the original 200-post REST migration predate the column and all carry NULL, so
 * the importer cannot see them. It would re-import every one, and `uniqueSlug()`
 * would land each copy at `<slug>-2`.
 *
 * The consequence is worse than wasted rows. The legacy redirect for those posts
 * already points at the ORIGINAL slug, so the duplicate gets no redirect — while
 * still being tier `archive-full` in a released year, hence indexable and listed
 * in the sitemap. That is 398 orphaned duplicate pages on a site being
 * remediated for exactly this.
 *
 * Matching runs in two passes, strongest signal first:
 *
 *   1. legacy path — normalizeLegacyPath(item.link) matched against the existing
 *      `redirects.from`, whose `to` names the article. Unambiguous: it is the
 *      same URL the redirect was built from.
 *   2. slug — decodeSlug(item.slug) matched against the article's `ar` slug, for
 *      articles that never got a redirect row.
 *
 * Usage:
 *   pnpm backfill:wp-ids --dry-run
 *   pnpm backfill:wp-ids
 */

// Must precede the @payload-config import — see normalize-redirects.ts.
import "dotenv/config";
import fs from "node:fs";
import readline from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPayload } from "payload";
import config from "@payload-config";
import { decodeSlug } from "../src/lib/payload/slug";
import { legacyPathFromLink } from "../src/lib/seo/wpArchive";
import { normalizeLegacyPath } from "../src/lib/seo/legacyPath";

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes("--dry-run");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const XML_PATH =
  argv.find((a) => a.startsWith("--file="))?.split("=")[1] ??
  path.resolve(__dirname, "..", "mfmsport.WordPress.2026-04-24.xml");

function readTag(line: string, tag: string): string | null {
  const m = line.match(
    new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`),
  );
  return m ? m[1] : null;
}

async function main() {
  const payload = await getPayload({ config });

  console.log(`\n=== Backfill wpPostId onto pre-existing articles ===`);
  console.log(`mode: ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE"}\n`);

  // Existing articles missing the field.
  const articles: { id: number; slug: string }[] = [];
  let page = 1;
  for (;;) {
    const res = await payload.find({
      collection: "articles",
      where: { wpPostId: { exists: false } },
      locale: "ar",
      limit: 500,
      page,
      depth: 0,
      pagination: true,
      select: { slug: true },
    });
    articles.push(...(res.docs as { id: number; slug: string }[]));
    if (!res.hasNextPage) break;
    page++;
  }
  console.log(`articles without wpPostId: ${articles.length}`);

  const bySlug = new Map<string, number>();
  for (const a of articles) if (a.slug) bySlug.set(decodeSlug(a.slug), a.id);

  // Redirect map: normalized legacy path -> article slug.
  const redirects: { from: string; to: string }[] = [];
  page = 1;
  for (;;) {
    const res = await payload.find({
      collection: "redirects",
      limit: 500,
      page,
      depth: 0,
      pagination: true,
    });
    redirects.push(...(res.docs as { from: string; to: string }[]));
    if (!res.hasNextPage) break;
    page++;
  }
  const byLegacyPath = new Map<string, number>();
  for (const r of redirects) {
    const slug = decodeSlug(String(r.to).replace("/ar/articles/", ""));
    const id = bySlug.get(slug);
    if (id !== undefined) byLegacyPath.set(r.from, id);
  }
  console.log(`redirect rows resolving to one of them: ${byLegacyPath.size}\n`);

  // Stream the export, matching each post against the two indexes.
  const matches = new Map<number, { wpPostId: number; legacySlug: string; via: string }>();
  const rl = readline.createInterface({
    input: fs.createReadStream(XML_PATH, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  let inItem = false;
  let wpPostId: number | null = null;
  let slug = "", link = "", type = "", status = "";
  let scanned = 0;

  for await (const line of rl) {
    if (line.includes("<item>")) {
      inItem = true;
      wpPostId = null; slug = ""; link = ""; type = ""; status = "";
      continue;
    }
    if (!inItem) continue;

    if (line.includes("</item>")) {
      inItem = false;
      scanned++;
      if (type === "post" && status === "publish" && wpPostId !== null) {
        const rawFrom = legacyPathFromLink(link);
        const from = rawFrom ? normalizeLegacyPath(rawFrom) : null;

        let id = from ? byLegacyPath.get(from) : undefined;
        let via = "legacy-path";
        if (id === undefined) {
          id = bySlug.get(decodeSlug(slug));
          via = "slug";
        }
        if (id !== undefined && !matches.has(id)) {
          matches.set(id, { wpPostId, legacySlug: decodeSlug(slug), via });
        }
      }
      continue;
    }

    if (wpPostId === null && line.includes("<wp:post_id>")) {
      const v = readTag(line, "wp:post_id");
      wpPostId = v ? Number(v) : null;
    }
    if (!type && line.includes("<wp:post_type>")) type = readTag(line, "wp:post_type") ?? "";
    if (!status && line.includes("<wp:status>")) status = readTag(line, "wp:status") ?? "";
    if (!slug && line.includes("<wp:post_name>")) slug = readTag(line, "wp:post_name") ?? "";
    if (!link && line.includes("<link>")) link = readTag(line, "link") ?? "";
  }
  rl.close();

  const viaPath = [...matches.values()].filter((m) => m.via === "legacy-path").length;
  const viaSlug = [...matches.values()].filter((m) => m.via === "slug").length;

  console.log(`items scanned:     ${scanned}`);
  console.log(`matched:           ${matches.size} / ${articles.length}`);
  console.log(`  via legacy path: ${viaPath}`);
  console.log(`  via slug:        ${viaSlug}`);
  console.log(`UNMATCHED:         ${articles.length - matches.size}`);

  if (articles.length - matches.size > 0) {
    const matchedIds = new Set(matches.keys());
    const missing = articles.filter((a) => !matchedIds.has(a.id)).slice(0, 15);
    console.log(`\n  first unmatched articles (these would be duplicated by the import):`);
    for (const a of missing) console.log(`    #${a.id} ${a.slug}`);
  }

  if (DRY_RUN) {
    console.log(`\nDRY RUN — nothing written.`);
    process.exit(0);
  }

  let written = 0;
  for (const [id, m] of matches) {
    await payload.update({
      collection: "articles",
      id,
      data: { wpPostId: m.wpPostId, legacySlug: m.legacySlug },
      context: { disableRevalidate: true },
    });
    written++;
  }
  console.log(`\nwritten: ${written}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
