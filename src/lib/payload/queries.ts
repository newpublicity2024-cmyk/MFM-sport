import { cache } from "react";
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
    // Listing results render as cards — never the body. Excluding the heavy
    // Lexical `body` field slashes the bytes read from Neon (over its data-transfer
    // quota) and the size of each ISR payload. Detail pages use getArticleBySlug,
    // which keeps body.
    select: { body: false },
  });
}

/** All published article slugs across every locale — for generateStaticParams. */
export async function getAllArticleSlugs(): Promise<
  Array<{ locale: Locale; slug: string }>
> {
  const payload = await getPayloadClient();
  const res = await payload.find({
    collection: "articles",
    where: { status: { equals: "published" } },
    locale: "all",
    depth: 0,
    pagination: false,
    limit: 0,
  });
  const out: Array<{ locale: Locale; slug: string }> = [];
  for (const doc of res.docs) {
    const slugByLocale = doc.slug as unknown as Partial<Record<Locale, string>>;
    for (const locale of ["ar", "fr", "en"] as const) {
      const slug = slugByLocale[locale];
      if (slug) out.push({ locale, slug });
    }
  }
  return out;
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
    select: { body: false }, // cards only — drop heavy body (Neon egress)
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
    select: { body: false }, // cards only — drop heavy body (Neon egress)
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
    select: { body: false }, // cards only — drop heavy body (Neon egress)
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
    select: { body: false }, // related cards — drop heavy body (Neon egress)
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
    select: { body: false }, // search result cards — drop heavy body (Neon egress)
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

// The API-Football league IDs the site actually lists (Competitions section).
// Used to scope live/date fixture data so we never show — or wait on — leagues
// we don't cover. React-cached for per-request dedupe (cheap DB read).
export const getOurLeagueIds = cache(async (): Promise<number[]> => {
  try {
    const payload = await getPayloadClient();
    const res = await payload.find({
      collection: "competitions",
      limit: 100,
      depth: 0,
      pagination: false,
    });
    return res.docs
      .map((c) => c.apiFootballId)
      .filter((n): n is number => typeof n === "number");
  } catch (error) {
    // Fail open: a DB hiccup (or quota block) must not crash the build / ISR
    // prerender of routes that scope by league. Downstream helpers already treat
    // an empty league list as "don't filter", so the page/endpoint still renders.
    console.error("[queries] getOurLeagueIds failed, returning []:", error);
    return [];
  }
});

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
    select: { body: false }, // cards only — drop heavy body (Neon egress)
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
    select: { body: false }, // cards only — drop heavy body (Neon egress)
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
  const decoded = decodeSlug(slug);
  // Match the slug in ANY locale (locale:'all' returns slug as {ar,fr,en}), so an
  // inbound cross-locale slug — e.g. a legacy Arabic slug requested under /fr —
  // still resolves to the right article and yields correct per-locale canonical
  // and hreflang URLs, not a self-referential fallback. (`locale` is unused now
  // but kept for call-site symmetry with resolveArticleBySlug.)
  void locale;
  const matched = await payload.find({
    collection: "articles",
    where: { slug: { equals: decoded }, status: { equals: "published" } },
    locale: "all",
    limit: 1,
    depth: 0,
    select: { slug: true },
  });
  const doc = matched.docs[0];
  if (!doc) return null;

  const raw = (doc as { slug?: Partial<Record<Locale, string>> | string }).slug;
  const map: Partial<Record<Locale, string>> =
    raw && typeof raw === "object" ? raw : { ar: typeof raw === "string" ? raw : undefined };
  const arSlug = map.ar || (typeof raw === "string" ? raw : "") || decoded;

  return {
    id: doc.id,
    slugs: { ar: map.ar || arSlug, fr: map.fr || arSlug, en: map.en || arSlug },
  };
}
