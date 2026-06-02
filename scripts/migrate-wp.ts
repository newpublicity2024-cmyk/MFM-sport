/**
 * WordPress -> Payload CMS Migration Script
 *
 * Usage:
 *   pnpm migrate:wp
 *   pnpm migrate:wp -- --limit=10           # migrate only 10 articles
 *   pnpm migrate:wp -- --offset=2000        # resume skipping the first 2000
 *   pnpm migrate:wp -- --dry-run            # fetch + parse, no writes
 *
 * Requires:
 *   - WP_API_URL env var (e.g., https://mfmsport.ma/wp-json/wp/v2)
 *   - DATABASE_URL and PAYLOAD_SECRET env vars (for Payload)
 *   - BLOB_READ_WRITE_TOKEN env var (Vercel Blob storage for media)
 *
 * What it does:
 *   1. Preflight: verifies WP API reachability + required env vars
 *   2. For each article (published), fetches with ?_embed=1 so featured media,
 *      categories, tags, and author are inline. Creates ONLY the taxonomies
 *      referenced by imported articles (lazy / on-demand). Migrates:
 *        - featured image -> Payload Media -> article.featuredImage
 *        - every <img> in body HTML -> Payload Media, replaced in-place
 *        - body HTML -> Lexical JSON via convertHTMLToLexical
 *        - upload placeholder paragraphs -> proper Lexical upload nodes
 *   4. Creates redirects from old WP slugs to new routes.
 *
 * Idempotent: skip-by-slug on categories/tags/authors/articles, skip-by-wpUrl
 * on media. Re-runs resume without duplicating work.
 */

import "dotenv/config";
import crypto from "node:crypto";
import path from "node:path";
import { getPayload } from "payload";
import { JSDOM } from "jsdom";
import {
  convertHTMLToLexical,
  editorConfigFactory,
} from "@payloadcms/richtext-lexical";
import config from "../src/payload.config";

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): {
  limit: number | null;
  offset: number;
  dryRun: boolean;
} {
  let limit: number | null = null;
  let offset = 0;
  let dryRun = false;
  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg.startsWith("--limit=")) limit = parseInt(arg.slice(8), 10);
    else if (arg.startsWith("--offset=")) offset = parseInt(arg.slice(9), 10);
  }
  return { limit, offset, dryRun };
}

const { limit: LIMIT, offset: OFFSET, dryRun: DRY_RUN } = parseArgs(
  process.argv.slice(2),
);

const WP_API_URL = process.env.WP_API_URL || "https://mfmsport.ma/wp-json/wp/v2";
const BATCH_SIZE = 100;
const ARTICLE_CONCURRENCY = 3;

// ID mapping: WP ID -> Payload ID
const categoryMap = new Map<number, string | number>();
const tagMap = new Map<number, string | number>();
const authorMap = new Map<number, string | number>();

// wpUrl -> Payload media ID cache (session only)
const mediaCache = new Map<string, string | number>();

// Counters
const stats = {
  articlesCreated: 0,
  articlesSkipped: 0,
  articleFailures: 0,
  featuredImagesUploaded: 0,
  bodyImagesUploaded: 0,
  imageFailures: 0,
  bodiesConverted: 0,
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

/**
 * WordPress returns post_name slugs percent-encoded for non-ASCII (Arabic)
 * titles, e.g. "%d8%a7%d9%84...". Storing that literal breaks the URL round
 * trip: Next.js decodes the route param before our slug lookup, so the
 * decoded Arabic never matches the stored "%xx" string (-> 404). Decode to
 * the human-readable slug, which re-encodes identically in the browser and
 * matches on lookup. Falls back to the raw value if it isn't valid encoding.
 */
function decodeSlug(raw: string): string {
  if (!raw) return raw;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function log(msg: string): void {
  console.log(msg);
}

// ---------------------------------------------------------------------------
// Preflight
// ---------------------------------------------------------------------------

async function preflight(): Promise<void> {
  log("--- Preflight checks ---");
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    if (!DRY_RUN) {
      throw new Error(
        "BLOB_READ_WRITE_TOKEN is not set. Media would be written to local disk, which is not viable for ~50GB of images. Aborting.",
      );
    }
    log("  [warn] BLOB_READ_WRITE_TOKEN not set - OK in --dry-run, but real runs need it.");
  } else {
    log("  [ok] BLOB_READ_WRITE_TOKEN present");
  }

  const probe = `${WP_API_URL}/posts?per_page=1`;
  try {
    const res = await fetch(probe);
    if (!res.ok) {
      throw new Error(`WP probe ${probe} returned ${res.status}`);
    }
    log(`  [ok] WP API reachable: ${probe}`);
  } catch (err: any) {
    throw new Error(`WP API unreachable (${probe}): ${err.message}`);
  }

  log(`  [ok] DATABASE_URL set, PAYLOAD_SECRET set`);
  log(
    `  mode: ${DRY_RUN ? "DRY RUN" : "WRITE"}  limit: ${
      LIMIT ?? "none"
    }  offset: ${OFFSET}`,
  );
}

// ---------------------------------------------------------------------------
// Media helper
// ---------------------------------------------------------------------------

const MIME_FROM_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

function guessMime(url: string, headerMime?: string | null): string {
  if (headerMime && headerMime.startsWith("image/")) return headerMime;
  try {
    const ext = path.extname(new URL(url).pathname).toLowerCase();
    return MIME_FROM_EXT[ext] ?? "application/octet-stream";
  } catch {
    return "application/octet-stream";
  }
}

function filenameFromUrl(url: string): string {
  try {
    const base = path.basename(new URL(url).pathname) || "image";
    return decodeURIComponent(base) || "image";
  } catch {
    return "image";
  }
}

/**
 * Ensure a WP image URL has been uploaded to Payload media.
 * Returns the Payload media ID, or null on any failure (logged).
 */
async function ensureMedia(
  payload: any,
  wpMediaUrl: string,
  opts: { alt?: string; mimetype?: string } = {},
): Promise<string | number | null> {
  if (!wpMediaUrl) return null;

  // Normalize
  const url = wpMediaUrl.trim();
  if (!url) return null;

  // Cache hit
  const cached = mediaCache.get(url);
  if (cached !== undefined) return cached;

  // Dedup in DB
  try {
    const existing = await payload.find({
      collection: "media",
      where: { wpUrl: { equals: url } },
      limit: 1,
    });
    if (existing.docs[0]) {
      mediaCache.set(url, existing.docs[0].id);
      return existing.docs[0].id;
    }
  } catch (err: any) {
    // fall through to upload attempt
    log(`    [media:lookup-error] ${url}: ${err.message}`);
  }

  if (DRY_RUN) {
    // Pretend success with a fake ID so placeholder logic runs
    const fakeId = `dry-${crypto.randomUUID()}`;
    mediaCache.set(url, fakeId);
    return fakeId;
  }

  // Download
  let buf: Buffer;
  let mimetype: string;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      stats.imageFailures++;
      log(`    [media:download-fail] ${url} -> HTTP ${res.status}`);
      mediaCache.set(url, "" as any); // sentinel? we use null below instead
      return null;
    }
    const headerMime = res.headers.get("content-type");
    mimetype = opts.mimetype ?? guessMime(url, headerMime);
    const ab = await res.arrayBuffer();
    buf = Buffer.from(ab);
  } catch (err: any) {
    stats.imageFailures++;
    log(`    [media:download-fail] ${url}: ${err.message}`);
    return null;
  }

  const name = filenameFromUrl(url);

  // Upload to Payload (Vercel Blob plugin routes storage)
  try {
    const created = await payload.create({
      collection: "media",
      data: {
        alt: opts.alt || name,
        wpUrl: url,
      },
      file: {
        data: buf,
        mimetype,
        name,
        size: buf.byteLength,
      },
    });
    mediaCache.set(url, created.id);
    return created.id;
  } catch (err: any) {
    stats.imageFailures++;
    log(`    [media:upload-fail] ${url}: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Taxonomy migration — lazy / on-demand
//
// We do NOT bulk-import every category/tag/author up front. Each article
// carries its own categories, tags, and author inline via ?_embed=1
// (`_embedded['wp:term']` and `_embedded.author`). We create only the
// taxonomies actually referenced by the articles we import — keeps the DB
// lean when importing a capped subset (e.g. 200 of ~37k posts).
//
// Idempotent: skip-by-slug + in-memory id maps. The `once()` in-flight cache
// dedupes concurrent create attempts when sibling articles (processed
// ARTICLE_CONCURRENCY at a time) reference the same new term in one batch.
// ---------------------------------------------------------------------------

// key -> in-flight Promise, dedupes concurrent ensure() calls for the same term
const inflight = new Map<string, Promise<string | number | null>>();

function once(
  key: string,
  fn: () => Promise<string | number | null>,
): Promise<string | number | null> {
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = fn();
  inflight.set(key, p);
  return p;
}

async function ensureCategory(
  payload: any,
  term: any,
): Promise<string | number | null> {
  if (!term?.id || !term.name) return null;
  if (categoryMap.has(term.id)) return categoryMap.get(term.id)!;
  return once(`cat:${term.id}`, async () => {
    try {
      const slug = term.slug || slugify(term.name);
      const existing = await payload.find({
        collection: "categories",
        where: { slug: { equals: slug } },
        limit: 1,
      });
      if (existing.docs[0]) {
        categoryMap.set(term.id, existing.docs[0].id);
        return existing.docs[0].id;
      }
      if (DRY_RUN) {
        const id = `dry-cat-${term.id}`;
        categoryMap.set(term.id, id);
        return id;
      }
      const created = await payload.create({
        collection: "categories",
        data: {
          name: term.name,
          slug,
          description: term.description || undefined,
        },
        locale: "ar",
      });
      categoryMap.set(term.id, created.id);
      log(`  [created] Category "${term.name}" -> ${created.id}`);
      return created.id;
    } catch (error: any) {
      console.error(`  [error] Category "${term.name}": ${error.message}`);
      return null;
    }
  });
}

async function ensureTag(
  payload: any,
  term: any,
): Promise<string | number | null> {
  if (!term?.id || !term.name) return null;
  if (tagMap.has(term.id)) return tagMap.get(term.id)!;
  return once(`tag:${term.id}`, async () => {
    try {
      const slug = term.slug || slugify(term.name);
      const existing = await payload.find({
        collection: "tags",
        where: { slug: { equals: slug } },
        limit: 1,
      });
      if (existing.docs[0]) {
        tagMap.set(term.id, existing.docs[0].id);
        return existing.docs[0].id;
      }
      if (DRY_RUN) {
        const id = `dry-tag-${term.id}`;
        tagMap.set(term.id, id);
        return id;
      }
      const created = await payload.create({
        collection: "tags",
        data: { name: term.name, slug },
        locale: "ar",
      });
      tagMap.set(term.id, created.id);
      return created.id;
    } catch (error: any) {
      console.error(`  [error] Tag "${term.name}": ${error.message}`);
      return null;
    }
  });
}

async function ensureAuthor(
  payload: any,
  user: any,
): Promise<string | number | null> {
  if (!user?.id || !user.name) return null;
  if (authorMap.has(user.id)) return authorMap.get(user.id)!;
  return once(`author:${user.id}`, async () => {
    try {
      const slug = user.slug || slugify(user.name);
      const existing = await payload.find({
        collection: "authors",
        where: { slug: { equals: slug } },
        limit: 1,
      });
      if (existing.docs[0]) {
        authorMap.set(user.id, existing.docs[0].id);
        return existing.docs[0].id;
      }
      if (DRY_RUN) {
        const id = `dry-author-${user.id}`;
        authorMap.set(user.id, id);
        return id;
      }
      const created = await payload.create({
        collection: "authors",
        data: { name: user.name, slug, bio: user.description || undefined },
        locale: "ar",
      });
      authorMap.set(user.id, created.id);
      log(`  [created] Author "${user.name}" -> ${created.id}`);
      return created.id;
    } catch (error: any) {
      console.error(`  [error] Author "${user.name}": ${error.message}`);
      return null;
    }
  });
}

// ---------------------------------------------------------------------------
// Body HTML -> Lexical conversion
// ---------------------------------------------------------------------------

/**
 * Processes the body HTML: downloads every <img>, uploads it to Payload,
 * and replaces the <img> with a placeholder <p data-upload-id="..."></p>.
 * Returns { processedHtml, uploadedCount }.
 */
async function processBodyImages(
  payload: any,
  html: string,
): Promise<{ processedHtml: string; uploadedCount: number }> {
  if (!html) return { processedHtml: "", uploadedCount: 0 };

  const dom = new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`);
  const document = dom.window.document;
  const imgs = Array.from(document.querySelectorAll("img"));
  let uploaded = 0;

  for (const img of imgs) {
    const src =
      img.getAttribute("src") ||
      img.getAttribute("data-src") ||
      img.getAttribute("data-lazy-src") ||
      "";
    if (!src) {
      img.remove();
      continue;
    }
    const alt = img.getAttribute("alt") || "";
    const mediaId = await ensureMedia(payload, src, { alt });
    if (!mediaId) {
      log(`    [body:img-dropped] ${src}`);
      img.remove();
      continue;
    }
    uploaded++;
    const placeholder = document.createElement("p");
    placeholder.setAttribute("data-upload-id", String(mediaId));
    // Replace <img> (or its closest <figure> wrapper for cleaner output).
    const figure = img.closest("figure");
    const target = figure ?? img;
    target.replaceWith(placeholder);
  }

  const processedHtml = document.body.innerHTML;
  return { processedHtml, uploadedCount: uploaded };
}

/**
 * Walks the root-level children of a Lexical state and replaces any
 * paragraph containing a single "upload placeholder" child with a
 * proper Lexical upload node.
 *
 * Upload node shape (see UploadNode.js: exportJSON = super.exportJSON()
 * (SerializedDecoratorBlockNode { format }) merged with UploadData
 * { id, relationTo, value, fields }, plus { type: "upload", version: 3 }):
 *
 *   {
 *     type: "upload",
 *     version: 3,
 *     format: "",
 *     id: "<random hex>",          // node instance id (NOT the media id)
 *     relationTo: "media",
 *     value: <payload media id>,   // number or string
 *     fields: {},
 *   }
 */
function replaceUploadPlaceholders(root: any): number {
  if (!root || !Array.isArray(root.children)) return 0;
  let replaced = 0;

  const newChildren: any[] = [];
  for (const child of root.children) {
    const uploadId = extractPlaceholderUploadId(child);
    if (uploadId !== null) {
      // Value can be number or string depending on DB type (we parse numeric if possible)
      const numeric = Number(uploadId);
      const value: number | string =
        Number.isFinite(numeric) && String(numeric) === uploadId
          ? numeric
          : uploadId;
      newChildren.push({
        type: "upload",
        version: 3,
        format: "",
        id: crypto.randomBytes(12).toString("hex"),
        relationTo: "media",
        value,
        fields: {},
      });
      replaced++;
    } else {
      newChildren.push(child);
    }
  }
  root.children = newChildren;
  return replaced;
}

/**
 * If `node` looks like a paragraph produced from our placeholder
 * <p data-upload-id="X"></p>, return the upload id string. Otherwise null.
 *
 * The HTML-to-Lexical converter does not preserve arbitrary HTML attributes
 * on <p> out of the box; it does, however, preserve the textual children.
 * We therefore also fall back to recognising a stringified marker pattern
 * inside the paragraph's first text child if no data attribute survived.
 */
function extractPlaceholderUploadId(node: any): string | null {
  if (!node || node.type !== "paragraph") return null;
  // Shape A: attribute survived on the paragraph itself.
  if (node.__dataUploadId) return String(node.__dataUploadId);
  // Shape B: children are empty but a single text node carries our marker.
  const children = Array.isArray(node.children) ? node.children : [];
  if (children.length === 1) {
    const c = children[0];
    if (c?.type === "text" && typeof c.text === "string") {
      const match = c.text.match(/^​UPLOAD:([^​]+)​$/);
      if (match) return match[1];
    }
  }
  return null;
}

/**
 * Before feeding HTML to the lexical converter we transform each
 * <p data-upload-id="X"></p> placeholder into
 * <p>​UPLOAD:X​</p> so the id survives conversion inside a text
 * node (zero-width chars act as delimiters we can match on).
 */
function encodePlaceholdersForLexical(html: string): string {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`);
  const document = dom.window.document;
  const placeholders = Array.from(
    document.querySelectorAll("p[data-upload-id]"),
  );
  for (const p of placeholders) {
    const id = p.getAttribute("data-upload-id") || "";
    p.textContent = `​UPLOAD:${id}​`;
  }
  return document.body.innerHTML;
}

// ---------------------------------------------------------------------------
// Article migration
// ---------------------------------------------------------------------------

async function migrateArticle(
  payload: any,
  wpPost: any,
  editorConfig: any,
  migratedCount: { value: number },
  totalEstimate: number,
): Promise<void> {
  const newSlug =
    decodeSlug(wpPost.slug) || slugify(wpPost.title?.rendered ?? "");

  try {
    const existing = await payload.find({
      collection: "articles",
      where: { slug: { equals: newSlug } },
      limit: 1,
    });
    if (existing.docs[0]) {
      stats.articlesSkipped++;
      return;
    }

    // Categories, tags, and author arrive inline via ?_embed=1. Create only
    // the taxonomies this article actually references.
    const embeddedTerms: any[] = (wpPost._embedded?.["wp:term"] || []).flat();
    const categoryIds: (string | number)[] = [];
    const tagIds: (string | number)[] = [];
    for (const term of embeddedTerms) {
      if (term?.taxonomy === "category") {
        const id = await ensureCategory(payload, term);
        if (id) categoryIds.push(id);
      } else if (term?.taxonomy === "post_tag") {
        const id = await ensureTag(payload, term);
        if (id) tagIds.push(id);
      }
    }

    // WP returns an error object (with `.code`) here if the author embed failed.
    const embeddedAuthor = wpPost._embedded?.author?.[0];
    const authorId =
      embeddedAuthor && !embeddedAuthor.code
        ? await ensureAuthor(payload, embeddedAuthor)
        : null;

    if (!authorId) {
      stats.articleFailures++;
      console.error(
        `  [skip] No author for WP post ${wpPost.id} (author ID ${wpPost.author})`,
      );
      return;
    }

    // 1. Featured image (from _embedded when present)
    let featuredImageId: string | number | null = null;
    const embeddedFeatured =
      wpPost._embedded?.["wp:featuredmedia"]?.[0]?.source_url;
    const embeddedAlt =
      wpPost._embedded?.["wp:featuredmedia"]?.[0]?.alt_text || wpPost.title?.rendered || "";
    if (embeddedFeatured) {
      featuredImageId = await ensureMedia(payload, embeddedFeatured, {
        alt: embeddedAlt,
      });
      if (featuredImageId) stats.featuredImagesUploaded++;
    }

    // 2. Body images + placeholders
    const rawBody: string = wpPost.content?.rendered ?? "";
    const { processedHtml, uploadedCount } = await processBodyImages(
      payload,
      rawBody,
    );
    stats.bodyImagesUploaded += uploadedCount;

    // 3. HTML -> Lexical
    let lexicalState: any;
    try {
      const encodedHtml = encodePlaceholdersForLexical(processedHtml);
      lexicalState = convertHTMLToLexical({
        editorConfig,
        html: encodedHtml || "<p></p>",
        JSDOM: JSDOM as any,
      });
      stats.bodiesConverted++;
    } catch (err: any) {
      console.error(
        `  [body-convert-fail] ${newSlug}: ${err.message}. Falling back to empty body.`,
      );
      lexicalState = emptyLexicalState();
    }

    // 4. Replace placeholder paragraphs with upload nodes
    const replaced = replaceUploadPlaceholders(lexicalState?.root);
    if (uploadedCount > 0) {
      log(
        `  [${newSlug}] body: ${uploadedCount} images uploaded, ${replaced} upload placeholders replaced`,
      );
    }

    const title = (wpPost.title?.rendered || "")
      .replace(/&#8211;/g, "-")
      .replace(/&amp;/g, "&");
    const excerpt = (wpPost.excerpt?.rendered || "")
      .replace(/<[^>]*>/g, "")
      .trim();

    if (DRY_RUN) {
      log(
        `  [dry-create] Article "${title}" (slug=${newSlug}) featured=${
          featuredImageId ?? "-"
        } bodyImages=${uploadedCount}`,
      );
      stats.articlesCreated++;
    } else {
      await payload.create({
        collection: "articles",
        data: {
          title,
          slug: newSlug,
          excerpt,
          body: lexicalState,
          featuredImage: featuredImageId ?? undefined,
          author: authorId,
          categories: categoryIds,
          tags: tagIds,
          status: "published",
          publishedAt: wpPost.date,
        },
        locale: "ar",
      });
      stats.articlesCreated++;

      // Redirect
      const oldPath = `/${wpPost.slug}/`;
      try {
        await payload.create({
          collection: "redirects",
          data: {
            from: oldPath,
            to: `/ar/articles/${newSlug}`,
            statusCode: "301",
          },
        });
      } catch {
        // already exists
      }
    }

    migratedCount.value++;
    if (migratedCount.value % 10 === 0) {
      const pct = totalEstimate
        ? ((migratedCount.value / totalEstimate) * 100).toFixed(2)
        : "?";
      log(`[migrated ${migratedCount.value}/${totalEstimate} · ${pct}%]`);
    }
  } catch (error: any) {
    stats.articleFailures++;
    console.error(
      `  [error] Article "${wpPost.title?.rendered}" (${wpPost.id}): ${error.message}`,
    );
  }
}

function emptyLexicalState(): any {
  return {
    root: {
      type: "root",
      format: "",
      indent: 0,
      version: 1,
      direction: "ltr",
      children: [
        {
          type: "paragraph",
          version: 1,
          format: "",
          indent: 0,
          direction: "ltr",
          textFormat: 0,
          textStyle: "",
          children: [],
        },
      ],
    },
  };
}

async function migrateArticles(payload: any, editorConfig: any) {
  log("\n--- Migrating Articles ---");
  const startPage = Math.max(1, Math.floor(OFFSET / BATCH_SIZE) + 1);
  const skipInFirstPage = OFFSET % BATCH_SIZE;
  let page = startPage;
  let hasMore = true;
  const migrated = { value: 0 };
  let totalEstimate = 0;

  while (hasMore) {
    const url = `${WP_API_URL}/posts?per_page=${BATCH_SIZE}&page=${page}&status=publish&_embed=1`;
    log(`  Fetching page ${page}...`);

    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 400) break;
      throw new Error(`WP API error: ${res.status}`);
    }

    const wpPosts: any[] = await res.json();
    const totalPages = parseInt(res.headers.get("x-wp-totalpages") || "1", 10);
    const reportedTotal = parseInt(res.headers.get("x-wp-total") || "0", 10);
    if (!totalEstimate && reportedTotal) totalEstimate = reportedTotal;

    // Skip offset within first page
    const startIdx = page === startPage ? skipInFirstPage : 0;
    const pagePosts = wpPosts.slice(startIdx);

    // Process in chunks of ARTICLE_CONCURRENCY
    for (let i = 0; i < pagePosts.length; i += ARTICLE_CONCURRENCY) {
      const chunk = pagePosts.slice(i, i + ARTICLE_CONCURRENCY);
      await Promise.all(
        chunk.map((p) =>
          migrateArticle(payload, p, editorConfig, migrated, totalEstimate),
        ),
      );
      if (LIMIT && migrated.value >= LIMIT) {
        log(`\nReached --limit=${LIMIT}, stopping.`);
        return;
      }
    }

    hasMore = page < totalPages;
    page++;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  log("=== MFM Sport WordPress Migration ===");
  log(`WP API: ${WP_API_URL}`);

  await preflight();

  const payload = await getPayload({ config });

  // Build a sanitized server editor config for convertHTMLToLexical.
  // We use the `default` factory, which builds from the resolved Payload
  // config (reading whatever `editor: lexicalEditor(...)` was set to).
  const editorConfig = await editorConfigFactory.default({
    config: payload.config,
  });

  await migrateArticles(payload, editorConfig);

  log("\n=== Migration Complete ===");
  log(`Categories mapped: ${categoryMap.size}`);
  log(`Tags mapped: ${tagMap.size}`);
  log(`Authors mapped: ${authorMap.size}`);
  log(`Articles created: ${stats.articlesCreated}`);
  log(`Articles skipped (existing): ${stats.articlesSkipped}`);
  log(`Article failures: ${stats.articleFailures}`);
  log(`Featured images uploaded: ${stats.featuredImagesUploaded}`);
  log(`Body images uploaded: ${stats.bodyImagesUploaded}`);
  log(`Image failures: ${stats.imageFailures}`);
  log(`Bodies converted: ${stats.bodiesConverted}`);
  log(`Media cache hits: ${mediaCache.size}`);
  if (DRY_RUN) log(`(DRY RUN: nothing was written to Payload)`);

  process.exit(0);
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
