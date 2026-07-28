import type { MetadataRoute } from "next";
import { getPayload } from "payload";
import configPromise from "@payload-config";
import { SITE_URL } from "@/lib/seo/siteUrl";
import { isIndexable, type SeoTier } from "@/lib/seo/indexation";

// Arabic-only front end: only advertise /ar URLs (fr/en are 301'd to /ar).
const LOCALES = ["ar"];

// Sitemap pulls every article/category/tag/author/competition/club from Payload —
// expensive. Cache it for a day instead of rebuilding on every crawler hit.
export const revalidate = 86400;

/**
 * Deliberately a SINGLE sitemap at /sitemap.xml, not sharded.
 *
 * An earlier version of this file used Next's `generateSitemaps()` to shard at
 * 10,000 URLs. That was a mistake on two counts, both caught by fetching the
 * output rather than reading the code:
 *
 *  1. It moves the sitemap to /sitemap/0.xml and makes /sitemap.xml return 404 —
 *     the URL robots.txt advertises and the one Google already has on file.
 *  2. Next passes the shard id in a form that arithmetic turns into NaN, and
 *     `entries.slice(NaN, NaN)` is empty, so every shard served zero URLs. The
 *     build reported success and the file was valid XML with no <url> in it.
 *
 * Sharding is also simply not needed at this site's size. Even with the whole
 * WordPress archive released into the index, the projection is ~28,000 URLs
 * against a 50,000-per-file protocol limit. Match pages are not listed here at
 * all. If the count ever approaches ~45,000, add a real sitemap index as
 * explicit routes (/sitemap.xml listing /sitemaps/*.xml) rather than reaching
 * for generateSitemaps, so the canonical URL keeps working.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const payload = await getPayload({ config: configPromise });
  const entries: MetadataRoute.Sitemap = [];

  // Static pages per locale
  for (const locale of LOCALES) {
    entries.push(
      { url: `${SITE_URL}/${locale}`, lastModified: new Date(), changeFrequency: "hourly", priority: 1.0 },
      { url: `${SITE_URL}/${locale}/articles`, changeFrequency: "hourly", priority: 0.9 },
      { url: `${SITE_URL}/${locale}/matches`, changeFrequency: "hourly", priority: 0.9 },
      { url: `${SITE_URL}/${locale}/videos`, changeFrequency: "daily", priority: 0.7 },
      { url: `${SITE_URL}/${locale}/search`, changeFrequency: "weekly", priority: 0.3 },
      { url: `${SITE_URL}/${locale}/about`, changeFrequency: "monthly", priority: 0.4 },
      { url: `${SITE_URL}/${locale}/contact`, changeFrequency: "monthly", priority: 0.4 },
      { url: `${SITE_URL}/${locale}/legal`, changeFrequency: "monthly", priority: 0.2 },
      { url: `${SITE_URL}/${locale}/privacy`, changeFrequency: "monthly", priority: 0.2 },
    );
  }

  // Articles — one all-locale query returns slug as a {ar,fr,en} map WITHOUT
  // fallback. Emit a locale's URL only if that locale has its OWN slug, so an
  // untranslated article is not listed under /fr|/en with the Arabic fallback
  // slug (which would be indexed as duplicate content). fr/en appear here
  // automatically as each gets translated.
  const articles = await payload.find({
    collection: "articles",
    where: { status: { equals: "published" } },
    locale: "all",
    limit: 50000,
    depth: 0,
    select: { slug: true, updatedAt: true, seoTier: true, publishedAt: true },
    sort: "-publishedAt",
  });

  for (const article of articles.docs) {
    // A sitemap must not advertise a URL that serves `noindex` — the two are
    // contradictory signals. Archive articles still held back by the staged
    // release (lib/seo/indexation) are therefore omitted here, and appear
    // automatically as each batch is released.
    if (!isIndexable(article as { seoTier?: SeoTier; publishedAt?: string })) continue;

    const raw = (article as { slug?: Partial<Record<string, string>> | string }).slug;
    const slugMap: Partial<Record<string, string>> =
      raw && typeof raw === "object" ? raw : { ar: typeof raw === "string" ? raw : undefined };
    const updatedAt = (article as { updatedAt?: string }).updatedAt;
    for (const locale of LOCALES) {
      const slug = slugMap[locale];
      if (!slug) continue;
      entries.push({
        url: `${SITE_URL}/${locale}/articles/${encodeURIComponent(slug)}`,
        lastModified: updatedAt ? new Date(updatedAt) : new Date(),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  }

  // Categories
  const categories = await payload.find({
    collection: "categories",
    limit: 500,
    select: { slug: true },
  });

  for (const category of categories.docs) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${SITE_URL}/${locale}/category/${category.slug}`,
        changeFrequency: "daily",
        priority: 0.6,
      });
    }
  }

  // Tags
  const tags = await payload.find({
    collection: "tags",
    limit: 1000,
    select: { slug: true },
  });

  for (const tag of tags.docs) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${SITE_URL}/${locale}/tag/${tag.slug}`,
        changeFrequency: "daily",
        priority: 0.5,
      });
    }
  }

  // Authors
  const authors = await payload.find({
    collection: "authors",
    limit: 100,
    select: { slug: true },
  });

  for (const author of authors.docs) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${SITE_URL}/${locale}/author/${author.slug}`,
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
  }

  // Competitions
  const competitions = await payload.find({
    collection: "competitions",
    limit: 50,
    select: { slug: true },
  });

  for (const comp of competitions.docs) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${SITE_URL}/${locale}/competition/${comp.slug}`,
        changeFrequency: "daily",
        priority: 0.7,
      });
    }
  }

  // Clubs
  const clubs = await payload.find({
    collection: "clubs",
    limit: 200,
    select: { slug: true },
  });

  for (const club of clubs.docs) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${SITE_URL}/${locale}/club/${club.slug}`,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  }

  // Slice this shard's window out of the full, deterministically-ordered list.
  // Every shard builds the same list and takes its slice: simpler and less
  // error-prone than per-shard queries with offsets, and the ordering is stable
  // so a URL cannot silently fall between two shards. The cost is bounded — a
  // handful of shards, each regenerated at most once a day.
  return entries;
}
