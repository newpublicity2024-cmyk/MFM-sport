import { getPayload } from "payload";
import configPromise from "@payload-config";
import type { Article, Config } from "@/payload-types";
import { decodeSlug } from "./slug";

type Locale = Config["locale"];

export async function getPayloadClient() {
  return getPayload({ config: configPromise });
}

export async function getArticles(options: {
  locale: Locale;
  page?: number;
  limit?: number;
  sort?: string;
}) {
  const payload = await getPayloadClient();
  return payload.find({
    collection: "articles",
    where: {
      status: { equals: "published" },
    },
    locale: options.locale,
    page: options.page || 1,
    limit: options.limit || 12,
    sort: options.sort || "-publishedAt",
    depth: 2,
  });
}

type ArticleResolution = {
  article: Article | null;
  /** When set, the inbound slug didn't match the current locale; 301 here. */
  redirectToSlug: string | null;
};

/**
 * Resolve an article by slug for a display locale.
 *  1. Match the slug in the CURRENT locale (happy path).
 *  2. Fall back to matching it in ANY locale (old Arabic links). If found,
 *     surface the current locale's own slug so the caller can 301.
 */
export async function resolveArticleBySlug(
  slug: string,
  locale: Locale,
): Promise<ArticleResolution> {
  const payload = await getPayloadClient();
  const decoded = decodeSlug(slug);

  const primary = await payload.find({
    collection: "articles",
    where: { slug: { equals: decoded }, status: { equals: "published" } },
    locale,
    limit: 1,
    depth: 2,
  });
  if (primary.docs[0]) return { article: primary.docs[0], redirectToSlug: null };

  // locale:'all' matches the slug in ANY locale and returns slug as {ar,fr,en}.
  const fallback = await payload.find({
    collection: "articles",
    where: { slug: { equals: decoded }, status: { equals: "published" } },
    locale: "all",
    limit: 1,
    depth: 0,
  });
  const hit = fallback.docs[0];
  if (!hit) return { article: null, redirectToSlug: null };

  const slugByLocale = hit.slug as unknown as Partial<Record<Locale, string>>;
  const targetSlug = slugByLocale[locale];
  if (targetSlug && targetSlug !== decoded) {
    return { article: null, redirectToSlug: targetSlug };
  }

  const byId = await payload.findByID({
    collection: "articles",
    id: hit.id,
    locale,
    depth: 2,
  });
  return { article: byId, redirectToSlug: null };
}

/** Back-compat single-doc lookup (used by generateMetadata; ignores redirects). */
export async function getArticleBySlug(slug: string, locale: Locale) {
  const { article, redirectToSlug } = await resolveArticleBySlug(slug, locale);
  if (article) return article;
  if (redirectToSlug) {
    const payload = await getPayloadClient();
    const r = await payload.find({
      collection: "articles",
      where: { slug: { equals: redirectToSlug }, status: { equals: "published" } },
      locale,
      limit: 1,
      depth: 2,
    });
    return r.docs[0] || null;
  }
  return null;
}

export async function getArticlesByCategory(
  categoryId: string | number,
  locale: Locale,
  page: number = 1,
  limit: number = 12,
) {
  const payload = await getPayloadClient();
  return payload.find({
    collection: "articles",
    where: {
      categories: { equals: categoryId },
      status: { equals: "published" },
    },
    locale,
    page,
    limit,
    sort: "-publishedAt",
    depth: 2,
  });
}

export async function getArticlesByTag(
  tagId: string | number,
  locale: Locale,
  page: number = 1,
  limit: number = 12,
) {
  const payload = await getPayloadClient();
  return payload.find({
    collection: "articles",
    where: {
      tags: { equals: tagId },
      status: { equals: "published" },
    },
    locale,
    page,
    limit,
    sort: "-publishedAt",
    depth: 2,
  });
}

export async function getArticlesByAuthor(
  authorId: string | number,
  locale: Locale,
  page: number = 1,
  limit: number = 12,
) {
  const payload = await getPayloadClient();
  return payload.find({
    collection: "articles",
    where: {
      author: { equals: authorId },
      status: { equals: "published" },
    },
    locale,
    page,
    limit,
    sort: "-publishedAt",
    depth: 2,
  });
}

export async function getRelatedArticles(
  articleId: string | number,
  categoryIds: (string | number)[],
  locale: Locale,
  limit: number = 4,
) {
  const payload = await getPayloadClient();
  return payload.find({
    collection: "articles",
    where: {
      id: { not_equals: articleId },
      categories: { in: categoryIds.map(String) },
      status: { equals: "published" },
    },
    locale,
    limit,
    sort: "-publishedAt",
    depth: 2,
  });
}

export async function getCategoryBySlug(slug: string, locale: Locale) {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "categories",
    where: { slug: { equals: decodeSlug(slug) } },
    locale,
    limit: 1,
  });
  return result.docs[0] || null;
}

export async function getTagBySlug(slug: string, locale: Locale) {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "tags",
    where: { slug: { equals: decodeSlug(slug) } },
    locale,
    limit: 1,
  });
  return result.docs[0] || null;
}

export async function getAuthorBySlug(slug: string, locale: Locale) {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "authors",
    where: { slug: { equals: decodeSlug(slug) } },
    locale,
    limit: 1,
    depth: 1,
  });
  return result.docs[0] || null;
}

export async function searchArticles(
  query: string,
  locale: Locale,
  page: number = 1,
  limit: number = 12,
) {
  const payload = await getPayloadClient();
  return payload.find({
    collection: "articles",
    where: {
      or: [
        { title: { like: query } },
        { excerpt: { like: query } },
      ],
      status: { equals: "published" },
    },
    locale,
    page,
    limit,
    sort: "-publishedAt",
    depth: 2,
  });
}

export async function getCompetitions(locale: Locale) {
  const payload = await getPayloadClient();
  return payload.find({
    collection: "competitions",
    locale,
    limit: 50,
    sort: "slug",
    depth: 1,
  });
}

export async function getClubs(locale: Locale) {
  const payload = await getPayloadClient();
  return payload.find({
    collection: "clubs",
    locale,
    limit: 50,
    sort: "slug",
    depth: 1,
  });
}

export async function getCompetitionBySlug(slug: string, locale: Locale) {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "competitions",
    where: { slug: { equals: decodeSlug(slug) } },
    locale,
    limit: 1,
    depth: 1,
  });
  return result.docs[0] || null;
}

export async function getClubBySlug(slug: string, locale: Locale) {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "clubs",
    where: { slug: { equals: decodeSlug(slug) } },
    locale,
    limit: 1,
    depth: 1,
  });
  return result.docs[0] || null;
}

export async function getArticlesByCompetition(
  competitionCategoryId: string | number,
  locale: Locale,
  limit: number = 6,
) {
  const payload = await getPayloadClient();
  return payload.find({
    collection: "articles",
    where: {
      categories: { equals: competitionCategoryId },
      status: { equals: "published" },
    },
    locale,
    limit,
    sort: "-publishedAt",
    depth: 2,
  });
}

export async function getVideoArticles(
  locale: Locale,
  page: number = 1,
  limit: number = 12,
) {
  const payload = await getPayloadClient();
  return payload.find({
    collection: "articles",
    where: {
      isVideo: { equals: true },
      status: { equals: "published" },
    },
    locale,
    page,
    limit,
    sort: "-publishedAt",
    depth: 2,
  });
}

export async function getPageBySlug(slug: string, locale: Locale) {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "pages",
    where: { slug: { equals: decodeSlug(slug) } },
    locale,
    limit: 1,
  });
  return result.docs[0] || null;
}

type LocalizedSlugs = Record<Locale, string>;

/**
 * Resolve the per-locale slugs for the article matching `slug` in `locale`.
 * Used by hreflang/canonical. Falls back to the Arabic slug for any locale whose
 * slug is empty (matches fallback:true). One id-resolving find + one all-locale find.
 */
export async function getArticleLocalizedSlugs(
  slug: string,
  locale: Locale,
): Promise<{ id: number | string; slugs: LocalizedSlugs } | null> {
  const payload = await getPayloadClient();
  const matched = await payload.find({
    collection: "articles",
    where: { slug: { equals: decodeSlug(slug) }, status: { equals: "published" } },
    locale,
    limit: 1,
    depth: 0,
    select: { slug: true },
  });
  const doc = matched.docs[0];
  if (!doc) return null;

  const allLocales = await payload.find({
    collection: "articles",
    where: { id: { equals: doc.id } },
    locale: "all",
    limit: 1,
    depth: 0,
    select: { slug: true },
  });
  const raw = (allLocales.docs[0] as { slug?: Partial<Record<Locale, string>> | string } | undefined)?.slug;
  const map: Partial<Record<Locale, string>> =
    raw && typeof raw === "object" ? raw : { ar: typeof raw === "string" ? raw : undefined };
  const arSlug = map.ar || (typeof raw === "string" ? raw : "") || decodeSlug(slug);

  return {
    id: doc.id,
    slugs: { ar: map.ar || arSlug, fr: map.fr || arSlug, en: map.en || arSlug },
  };
}
