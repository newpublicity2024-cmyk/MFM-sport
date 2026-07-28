/**
 * WordPress archive backfill — imports the full WXR export into Payload/Neon.
 *
 * Why this exists separately from scripts/migrate-wp.ts: that script pulls from
 * the live WordPress REST API, which is gone (mfmsport.ma/wp-json now serves the
 * Next.js app). The only surviving copy of the archive is the 646 MB XML export
 * in the repo root, holding 36,992 published posts against the ~400 previously
 * migrated.
 *
 * Design constraints, all load-bearing:
 *
 *  - STREAMING. 646 MB cannot be DOM-parsed or read into a string. Everything
 *    here is line-by-line via readline; exactly one <item> is held in memory at
 *    a time. This is also why it is a CLI script and not a route handler — it
 *    would not survive a serverless memory or timeout ceiling.
 *
 *  - RESUMABLE. A 37k-post run against Neon will not finish in one uninterrupted
 *    pass. `wpPostId` is unique and indexed, so resume state lives in the
 *    database rather than a checkpoint file: existing IDs are loaded once up
 *    front and skipped. Re-running after any interruption is safe and cheap.
 *
 *  - TIERED. Body length decides `seoTier`, which drives staged indexation via
 *    lib/seo/indexation.ts. Every post is imported and every legacy URL 301s
 *    from day one; only indexation is staged. Releasing a batch later is a
 *    config edit, never a re-import.
 *
 *  - NO IMAGES. Every attachment URL in the export points at mfmsport.ma
 *    /wp-content/uploads/..., which now 404s — the media is already gone, so
 *    <img> tags are stripped rather than imported as broken references. See
 *    docs/wp-corpus-analysis.md.
 *
 * Usage:
 *   pnpm import:wp --dry-run --limit=20     # inspect what would happen
 *   pnpm import:wp --limit=500              # a first real batch
 *   pnpm import:wp                          # the full run (resumable)
 *   pnpm import:wp --min-year=2024          # only recent years
 */

import fs from "node:fs";
import readline from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPayload } from "payload";
import { JSDOM } from "jsdom";
import { convertHTMLToLexical, editorConfigFactory } from "@payloadcms/richtext-lexical";
import config from "@payload-config";
import { decodeSlug } from "../src/lib/payload/slug";
import { slugify } from "../src/lib/payload/slugify";

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const value = (name: string, fallback?: string) =>
  argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;

const DRY_RUN = flag("dry-run");
const LIMIT = Number(value("limit", "0")) || Infinity;
const MIN_YEAR = Number(value("min-year", "0")) || 0;
const CONCURRENCY = Number(value("concurrency", "4"));
const PROGRESS_EVERY = Number(value("progress-every", "250"));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const XML_PATH =
  value("file") ?? path.resolve(__dirname, "..", "mfmsport.WordPress.2026-04-24.xml");

/** Below this many characters of body text an article is "brief" — a headline
 *  and a sentence. Confirmed with the site owner; see docs/wp-corpus-analysis.md. */
const BRIEF_THRESHOLD = 500;

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

type WpItem = {
  wpPostId: number | null;
  title: string;
  slug: string;
  link: string;
  date: string;
  type: string | null;
  status: string | null;
  creator: string | null;
  contentHtml: string;
  excerpt: string;
  acfText: string;
  categories: { nicename: string; name: string }[];
  tags: { nicename: string; name: string }[];
};

function newItem(): WpItem {
  return {
    wpPostId: null, title: "", slug: "", link: "", date: "",
    type: null, status: null, creator: null,
    contentHtml: "", excerpt: "", acfText: "",
    categories: [], tags: [],
  };
}

/** Read a simple <tag>value</tag> or <tag><![CDATA[value]]></tag> off one line. */
function readTag(line: string, tag: string): string | null {
  const m = line.match(
    new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`),
  );
  return m ? m[1] : null;
}

/**
 * Plain-text length of a body.
 *
 * The CDATA wrapper MUST be removed before stripping tags. `<![CDATA[` opens
 * with "<" and `]]>` closes with ">", so a naive /<[^>]+>/ swallows the entire
 * section as if it were a single tag and reports every plain-text article as
 * empty. That bug produced a fake "2,224 posts are empty" result during
 * analysis; the real figure is 4.
 */
export function bodyTextLength(raw: string): number {
  return stripToText(raw).length;
}

function stripToText(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\[[^\]]{0,80}\]/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-z]+;/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** ACF flexible-content fields carry body paragraphs alongside content:encoded.
 *  Ignoring them silently truncates articles. */
const ACF_BODY_KEY = /^content(_block)?_\d+(_content_\d+|_article)?$/;

/**
 * Strip <img>/<figure> whose source is the dead legacy CDN, and unwrap the
 * anchors around them, so bodies don't render broken images.
 */
export function stripDeadMedia(html: string): string {
  return html
    .replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, "")
    .replace(/<img[^>]*>/gi, "")
    .replace(/<a[^>]*>\s*<\/a>/gi, "")
    .replace(/<p>\s*<\/p>/gi, "");
}

export function tierFor(textLength: number): "archive-full" | "archive-brief" {
  return textLength >= BRIEF_THRESHOLD ? "archive-full" : "archive-brief";
}

/** The path a legacy URL should redirect FROM, normalised to what the middleware
 *  will actually receive. WordPress permalinks are percent-encoded for Arabic. */
export function legacyPathFromLink(link: string): string | null {
  try {
    const u = new URL(link);
    return u.pathname.endsWith("/") ? u.pathname : `${u.pathname}/`;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

const stats = {
  scanned: 0, eligible: 0, skippedExisting: 0, created: 0,
  redirects: 0, failed: 0, tierFull: 0, tierBrief: 0, empty: 0,
};

async function main() {
  if (!fs.existsSync(XML_PATH)) {
    console.error(`Export not found: ${XML_PATH}`);
    process.exit(1);
  }

  console.log(`\n=== WordPress archive import ===`);
  console.log(`file:        ${XML_PATH}`);
  console.log(`mode:        ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE"}`);
  console.log(`limit:       ${LIMIT === Infinity ? "none" : LIMIT}`);
  console.log(`min-year:    ${MIN_YEAR || "none"}`);
  console.log(`concurrency: ${CONCURRENCY}\n`);

  const payload = await getPayload({ config });
  const editorConfig = await editorConfigFactory.default({ config: payload.config });

  // Resume state lives in the DB, not a checkpoint file: wpPostId is unique, so
  // the set of already-imported IDs IS the checkpoint. One paged scan up front
  // beats a per-post existence query by ~37,000 round trips.
  console.log("Loading already-imported post IDs…");
  const seen = await loadImportedIds(payload);
  console.log(`  ${seen.size} already imported\n`);

  const taxonomy = new TaxonomyCache(payload);
  const queue: WpItem[] = [];
  let stop = false;

  const rl = readline.createInterface({
    input: fs.createReadStream(XML_PATH, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  let inItem = false, inContent = false, inExcerpt = false;
  let cur = newItem();
  let lastMetaKey: string | null = null;

  for await (const line of rl) {
    if (stop) break;

    if (line.includes("<item>")) { inItem = true; cur = newItem(); continue; }
    if (!inItem) continue;

    if (line.includes("</item>")) {
      inItem = false; inContent = false; inExcerpt = false;
      stats.scanned++;

      if (shouldImport(cur, seen)) {
        stats.eligible++;
        queue.push(cur);
        if (queue.length >= CONCURRENCY * 4) {
          await drain(queue, payload, editorConfig, taxonomy);
          if (stats.created >= LIMIT) stop = true;
        }
      }
      continue;
    }

    // Scalars — first occurrence wins (nested <item> children can repeat names).
    if (cur.wpPostId === null && line.includes("<wp:post_id>")) {
      const v = readTag(line, "wp:post_id");
      cur.wpPostId = v ? Number(v) : null;
    }
    if (!cur.type && line.includes("<wp:post_type>")) cur.type = readTag(line, "wp:post_type");
    if (!cur.status && line.includes("<wp:status>")) cur.status = readTag(line, "wp:status");
    if (!cur.date && line.includes("<wp:post_date>")) cur.date = readTag(line, "wp:post_date") ?? "";
    if (!cur.slug && line.includes("<wp:post_name>")) cur.slug = readTag(line, "wp:post_name") ?? "";
    if (!cur.title && line.includes("<title>")) cur.title = readTag(line, "title") ?? "";
    if (!cur.link && line.includes("<link>")) cur.link = readTag(line, "link") ?? "";
    if (!cur.creator && line.includes("<dc:creator>")) cur.creator = readTag(line, "dc:creator");

    // <category domain="category" nicename="slug"><![CDATA[Name]]></category>
    if (line.includes("<category")) {
      const domain = line.match(/domain="([^"]+)"/)?.[1];
      const nicename = line.match(/nicename="([^"]+)"/)?.[1];
      const name = line.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)?.[1];
      if (domain && nicename && name) {
        const entry = { nicename: decodeSlug(nicename), name };
        if (domain === "category") cur.categories.push(entry);
        else if (domain === "post_tag") cur.tags.push(entry);
      }
    }

    if (line.includes("<wp:meta_key>")) lastMetaKey = readTag(line, "wp:meta_key");
    if (line.includes("<wp:meta_value>") && lastMetaKey) {
      if (ACF_BODY_KEY.test(lastMetaKey)) {
        cur.acfText += " " + stripToText(readTag(line, "wp:meta_value") ?? "");
      }
      lastMetaKey = null;
    }

    if (line.includes("<content:encoded>")) inContent = true;
    if (inContent) cur.contentHtml += line + "\n";
    if (line.includes("</content:encoded>")) inContent = false;

    if (line.includes("<excerpt:encoded>")) inExcerpt = true;
    if (inExcerpt) cur.excerpt += line + "\n";
    if (line.includes("</excerpt:encoded>")) inExcerpt = false;
  }

  rl.close();
  await drain(queue, payload, editorConfig, taxonomy);
  report();
  process.exit(0);
}

function shouldImport(item: WpItem, seen: Set<number>): boolean {
  if (item.type !== "post" || item.status !== "publish") return false;
  if (item.wpPostId === null) return false;
  if (seen.has(item.wpPostId)) { stats.skippedExisting++; return false; }
  if (MIN_YEAR && Number(item.date.slice(0, 4)) < MIN_YEAR) return false;
  return true;
}

async function drain(
  queue: WpItem[],
  payload: any,
  editorConfig: any,
  taxonomy: TaxonomyCache,
) {
  while (queue.length) {
    if (stats.created >= LIMIT) { queue.length = 0; return; }
    const batch = queue.splice(0, CONCURRENCY);
    await Promise.all(batch.map((item) => importOne(item, payload, editorConfig, taxonomy)));
    if (stats.created && stats.created % PROGRESS_EVERY === 0) {
      console.log(`  … ${stats.created} created, ${stats.failed} failed`);
    }
  }
}

async function importOne(
  item: WpItem,
  payload: any,
  editorConfig: any,
  taxonomy: TaxonomyCache,
) {
  try {
    const textLen = bodyTextLength(item.contentHtml) + stripToText(item.acfText).length;
    if (textLen === 0) stats.empty++;
    const tier = tierFor(textLen);
    tier === "archive-full" ? stats.tierFull++ : stats.tierBrief++;

    const baseSlug = decodeSlug(item.slug) || slugify(item.title) || `post-${item.wpPostId}`;
    const cleanHtml = stripDeadMedia(
      item.contentHtml.replace(/<\/?content:encoded>/g, "").replace(/<!\[CDATA\[|\]\]>/g, ""),
    );

    if (DRY_RUN) {
      console.log(
        `  [dry] #${item.wpPostId} ${tier.padEnd(13)} ${String(textLen).padStart(5)}ch  ${baseSlug.slice(0, 60)}`,
      );
      stats.created++;
      return;
    }

    let lexical: any;
    try {
      lexical = convertHTMLToLexical({
        editorConfig,
        html: cleanHtml.trim() || "<p></p>",
        JSDOM: JSDOM as any,
      });
    } catch {
      lexical = convertHTMLToLexical({ editorConfig, html: "<p></p>", JSDOM: JSDOM as any });
    }

    const categoryIds = await Promise.all(item.categories.map((c) => taxonomy.category(c)));
    const tagIds = await Promise.all(item.tags.map((t) => taxonomy.tag(t)));
    const authorId = await taxonomy.author(item.creator);

    const slug = await uniqueSlug(payload, baseSlug);

    await payload.create({
      collection: "articles",
      data: {
        title: item.title || baseSlug,
        slug,
        excerpt: stripToText(item.excerpt).slice(0, 300) || stripToText(cleanHtml).slice(0, 200),
        body: lexical,
        author: authorId ?? undefined,
        categories: categoryIds.filter(Boolean),
        tags: tagIds.filter(Boolean),
        status: "published",
        publishedAt: new Date(item.date.replace(" ", "T") + "Z").toISOString(),
        wpPostId: item.wpPostId,
        legacySlug: item.slug,
        seoTier: tier,
      },
      locale: "ar",
    });
    stats.created++;

    // The redirect is the whole point of importing the long tail — it is what
    // carries a decade of link equity forward. Create it even for brief tiers.
    const from = legacyPathFromLink(item.link);
    if (from) {
      const existing = await payload.find({
        collection: "redirects",
        where: { from: { equals: from } },
        limit: 1,
      });
      if (!existing.docs[0]) {
        await payload.create({
          collection: "redirects",
          data: { from, to: `/ar/articles/${slug}`, statusCode: "301" },
        });
        stats.redirects++;
      }
    }
  } catch (err: any) {
    stats.failed++;
    console.error(`  [fail] #${item.wpPostId} ${item.slug?.slice(0, 40)}: ${err.message}`);
  }
}

/** Slug is unique per locale; the archive contains genuine duplicate titles. */
async function uniqueSlug(payload: any, base: string): Promise<string> {
  let candidate = base;
  for (let n = 2; n < 50; n++) {
    const hit = await payload.find({
      collection: "articles",
      where: { slug: { equals: candidate } },
      locale: "ar",
      limit: 1,
      depth: 0,
    });
    if (!hit.docs.length) return candidate;
    candidate = `${base}-${n}`;
  }
  return `${base}-${Date.now()}`;
}

async function loadImportedIds(payload: any): Promise<Set<number>> {
  const ids = new Set<number>();
  let page = 1;
  for (;;) {
    const res = await payload.find({
      collection: "articles",
      where: { wpPostId: { exists: true } },
      limit: 1000,
      page,
      depth: 0,
      select: { wpPostId: true },
      pagination: true,
    });
    for (const d of res.docs) if (d.wpPostId != null) ids.add(Number(d.wpPostId));
    if (!res.hasNextPage) break;
    page++;
  }
  return ids;
}

/** Creates taxonomy rows on demand, memoised — the archive references the same
 *  few hundred categories/tags across 37k posts. */
class TaxonomyCache {
  private categories = new Map<string, any>();
  private tags = new Map<string, any>();
  private authors = new Map<string, any>();
  constructor(private payload: any) {}

  category(c: { nicename: string; name: string }) {
    return this.ensure("categories", this.categories, c.nicename, { name: c.name, slug: c.nicename });
  }
  tag(t: { nicename: string; name: string }) {
    return this.ensure("tags", this.tags, t.nicename, { name: t.name, slug: t.nicename });
  }
  author(login: string | null) {
    if (!login) return Promise.resolve(null);
    const slug = slugify(login) || "mfm-sport";
    return this.ensure("authors", this.authors, slug, { name: login, slug });
  }

  private async ensure(collection: string, cache: Map<string, any>, key: string, data: any) {
    if (cache.has(key)) return cache.get(key);
    if (DRY_RUN) { cache.set(key, null); return null; }
    const found = await this.payload.find({
      collection, where: { slug: { equals: key } }, limit: 1, depth: 0,
    });
    let id = found.docs[0]?.id;
    if (!id) {
      try {
        id = (await this.payload.create({ collection, data, locale: "ar" })).id;
      } catch {
        const retry = await this.payload.find({
          collection, where: { slug: { equals: key } }, limit: 1, depth: 0,
        });
        id = retry.docs[0]?.id ?? null;
      }
    }
    cache.set(key, id);
    return id;
  }
}

function report() {
  console.log(`\n=== Import complete ===`);
  console.log(`  items scanned:      ${stats.scanned}`);
  console.log(`  eligible:           ${stats.eligible}`);
  console.log(`  skipped (existing): ${stats.skippedExisting}`);
  console.log(`  created:            ${stats.created}`);
  console.log(`    archive-full:     ${stats.tierFull}`);
  console.log(`    archive-brief:    ${stats.tierBrief}`);
  console.log(`    empty body:       ${stats.empty}`);
  console.log(`  redirects created:  ${stats.redirects}`);
  console.log(`  failed:             ${stats.failed}`);
  if (DRY_RUN) console.log(`\n  DRY RUN — nothing was written.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
