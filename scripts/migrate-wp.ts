/**
 * WordPress -> Payload CMS Migration Script
 *
 * Usage:
 *   npx tsx scripts/migrate-wp.ts
 *
 * Requires:
 *   - WP_API_URL env var (e.g., https://mfmsport.ma/wp-json/wp/v2)
 *   - DATABASE_URL and PAYLOAD_SECRET env vars (for Payload)
 *
 * What it does:
 *   1. Fetches all categories, tags, authors from WordPress
 *   2. Creates them in Payload
 *   3. Fetches all published articles (paginated)
 *   4. For each article: maps relationships, creates in Payload, creates redirect
 */

import "dotenv/config";
import { getPayload } from "payload";
import config from "../src/payload.config";

const WP_API_URL = process.env.WP_API_URL || "https://mfmsport.ma/wp-json/wp/v2";
const BATCH_SIZE = 100;

// ID mapping: WP ID -> Payload ID
const categoryMap = new Map<number, string>();
const tagMap = new Map<number, string>();
const authorMap = new Map<number, string>();

async function fetchWpPages<T>(endpoint: string): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `${WP_API_URL}/${endpoint}?per_page=${BATCH_SIZE}&page=${page}`;
    console.log(`  Fetching ${url}`);

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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

async function migrateCategories(payload: any) {
  console.log("\n--- Migrating Categories ---");
  const wpCategories = await fetchWpPages<any>("categories");
  console.log(`Found ${wpCategories.length} WP categories`);

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
        console.log(`  [skip] Category "${wpCat.name}" already exists`);
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
      console.log(`  [created] Category "${wpCat.name}" -> ${created.id}`);
    } catch (error: any) {
      console.error(`  [error] Category "${wpCat.name}": ${error.message}`);
    }
  }
}

async function migrateTags(payload: any) {
  console.log("\n--- Migrating Tags ---");
  const wpTags = await fetchWpPages<any>("tags");
  console.log(`Found ${wpTags.length} WP tags`);

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

      const created = await payload.create({
        collection: "tags",
        data: { name: wpTag.name, slug },
        locale: "ar",
      });

      tagMap.set(wpTag.id, created.id);
      console.log(`  [created] Tag "${wpTag.name}"`);
    } catch (error: any) {
      console.error(`  [error] Tag "${wpTag.name}": ${error.message}`);
    }
  }
}

async function migrateAuthors(payload: any) {
  console.log("\n--- Migrating Authors ---");
  const wpUsers = await fetchWpPages<any>("users");
  console.log(`Found ${wpUsers.length} WP users`);

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
      console.log(`  [created] Author "${wpUser.name}"`);
    } catch (error: any) {
      console.error(`  [error] Author "${wpUser.name}": ${error.message}`);
    }
  }
}

async function migrateArticles(payload: any) {
  console.log("\n--- Migrating Articles ---");
  let page = 1;
  let hasMore = true;
  let total = 0;

  while (hasMore) {
    const url = `${WP_API_URL}/posts?per_page=${BATCH_SIZE}&page=${page}&status=publish`;
    console.log(`  Fetching page ${page}...`);

    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 400) break;
      throw new Error(`WP API error: ${res.status}`);
    }

    const wpPosts: any[] = await res.json();
    const totalPages = parseInt(res.headers.get("x-wp-totalpages") || "1", 10);

    for (const wpPost of wpPosts) {
      const newSlug = wpPost.slug || slugify(wpPost.title.rendered);

      try {
        const existing = await payload.find({
          collection: "articles",
          where: { slug: { equals: newSlug } },
          limit: 1,
        });

        if (existing.docs[0]) {
          total++;
          continue;
        }

        const categoryIds = (wpPost.categories || [])
          .map((id: number) => categoryMap.get(id))
          .filter(Boolean);

        const tagIds = (wpPost.tags || [])
          .map((id: number) => tagMap.get(id))
          .filter(Boolean);

        const authorId = authorMap.get(wpPost.author);

        if (!authorId) {
          console.error(`  [skip] No author mapping for WP author ID ${wpPost.author}`);
          continue;
        }

        const article = await payload.create({
          collection: "articles",
          data: {
            title: wpPost.title.rendered.replace(/&#8211;/g, "-").replace(/&amp;/g, "&"),
            slug: newSlug,
            excerpt: wpPost.excerpt.rendered.replace(/<[^>]*>/g, "").trim(),
            author: authorId,
            categories: categoryIds,
            tags: tagIds,
            status: "published",
            publishedAt: wpPost.date,
          },
          locale: "ar",
        });

        // Create redirect from old WP path
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
          // Redirect may already exist
        }

        total++;
        if (total % 100 === 0) {
          console.log(`  Migrated ${total} articles...`);
        }
      } catch (error: any) {
        console.error(`  [error] Article "${wpPost.title?.rendered}": ${error.message}`);
      }
    }

    hasMore = page < totalPages;
    page++;
  }

  console.log(`\nTotal articles migrated: ${total}`);
}

async function main() {
  console.log("=== MFM Sport WordPress Migration ===");
  console.log(`WP API: ${WP_API_URL}`);

  const payload = await getPayload({ config });

  await migrateCategories(payload);
  await migrateTags(payload);
  await migrateAuthors(payload);
  await migrateArticles(payload);

  console.log("\n=== Migration Complete ===");
  console.log(`Categories: ${categoryMap.size}`);
  console.log(`Tags: ${tagMap.size}`);
  console.log(`Authors: ${authorMap.size}`);
  console.log(`\nNote: Article bodies were skipped (HTML -> Lexical conversion needed).`);
  console.log(`Use Payload admin to manually edit article bodies, or implement HTML-to-Lexical conversion.`);

  process.exit(0);
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
