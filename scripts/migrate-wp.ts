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
 *   2. Migrates categories, tags, authors from WordPress
 *   3. For each article (published), fetches with ?_embed=1 so featured media
 *      is inline. Migrates:
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

function log(msg: string): void {
  console.log(msg);
}

async function fetchWpPages<T>(endpoint: string): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `${WP_API_URL}/${endpoint}?per_page=${BATCH_SIZE}&page=${page}`;
    log(`  Fetching ${url}`);

    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 400) break;
      throw new Error(`WP API error: ${res.status} for ${url}`);
    }

    const data: T[] = await res.json();
    all.push(...data);

    const totalPages = parseInt(res.headers.get("x-wp-totalpages") || "1", 10);
    hasMore = page < totalPages;
    page++;
  }

  return all;
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
// Taxonomy migration (unchanged logic, updated to use stats)
// ---------------------------------------------------------------------------

async function migrateCategories(payload: any) {
  log("\n--- Migrating Categories ---");
  const wpCategories = await fetchWpPages<any>("categories");
  log(`Found ${wpCategories.length} WP categories`);

  for (const wpCat of wpCategories) {
    const slug = wpCat.slug || slugify(wpCat.name);
    try {
      const existing = await payload.find({
        collection: "categories",
        where: { slug: { equals: slug } },
        limit: 1,
      });

      if (existing.docs[0]) {
        categoryMap.set(wpCat.id, existing.docs[0].id);
        continue;
      }

      if (DRY_RUN) {
        categoryMap.set(wpCat.id, `dry-cat-${wpCat.id}`);
        log(`  [dry-create] Category "${wpCat.name}"`);
        continue;
      }

      const created = await payload.create({
        collection: "categories",
        data: {
          name: wpCat.name,
          slug,
          description: wpCat.description || undefined,
        },
        locale: "ar",
      });

      categoryMap.set(wpCat.id, created.id);
      log(`  [created] Category "${wpCat.name}" -> ${created.id}`);
    } catch (error: any) {
      console.error(`  [error] Category "${wpCat.name}": ${error.message}`);
    }
  }
}

async function migrateTags(payload: any) {
  log("\n--- Migrating Tags ---");
  const wpTags = await fetchWpPages<any>("tags");
  log(`Found ${wpTags.length} WP tags`);

  for (const wpTag of wpTags) {
    const slug = wpTag.slug || slugify(wpTag.name);
    try {
      const existing = await payload.find({
        collection: "tags",
        where: { slug: { equals: slug } },
        limit: 1,
      });

      if (existing.docs[0]) {
        tagMap.set(wpTag.id, existing.docs[0].id);
        continue;
      }

      if (DRY_RUN) {
        tagMap.set(wpTag.id, `dry-tag-${wpTag.id}`);
        continue;
      }

      const created = await payload.create({
        collection: "tags",
        data: { name: wpTag.name, slug },
        locale: "ar",
      });

      tagMap.set(wpTag.id, created.id);
    } catch (error: any) {
      console.error(`  [error] Tag "${wpTag.name}": ${error.message}`);
    }
  }
}

async function migrateAuthors(payload: any) {
  log("\n--- Migrating Authors ---");
  const wpUsers = await fetchWpPages<any>("users");
  log(`Found ${wpUsers.length} WP users`);

  for (const wpUser of wpUsers) {
    const slug = wpUser.slug || slugify(wpUser.name);
    try {
      const existing = await payload.find({
        collection: "authors",
        where: { slug: { equals: slug } },
        limit: 1,
      });

      if (existing.docs[0]) {
        authorMap.set(wpUser.id, existing.docs[0].id);
        continue;
      }

      if (DRY_RUN) {
        authorMap.set(wpUser.id, `dry-author-${wpUser.id}`);
        continue;
      }

      const created = await payload.create({
        collection: "authors",
        data: {
          name: wpUser.name,
          slug,
          bio: wpUser.description || undefined,
        },
        locale: "ar",
      });

      authorMap.set(wpUser.id, created.id);
    } catch (error: any) {
      console.error(`  [error] Author "${wpUser.name}": ${error.message}`);
    }
  }
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
  const newSlug = wpPost.slug || slugify(wpPost.title?.rendered ?? "");

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

    const categoryIds = (wpPost.categories || [])
      .map((id: number) => categoryMap.get(id))
      .filter(Boolean);
    const tagIds = (wpPost.tags || [])
      .map((id: number) => tagMap.get(id))
      .filter(Boolean);
    const authorId = authorMap.get(wpPost.author);

    if (!authorId) {
      stats.articleFailures++;
      console.error(
        `  [skip] No author mapping for WP author ID ${wpPost.author} (post ${wpPost.id})`,
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

  await migrateCategories(payload);
  await migrateTags(payload);
  await migrateAuthors(payload);
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
