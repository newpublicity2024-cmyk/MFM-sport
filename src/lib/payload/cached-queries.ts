import { unstable_cache } from "next/cache";
import type { Config } from "@/payload-types";
import {
  resolveArticleBySlug,
  getRelatedArticles,
  getArticles,
  getTagBySlug,
  getArticlesByTag,
  getCategoryBySlug,
  getArticlesByCategory,
  findHomepageSettings,
  getCompetitions,
} from "./queries";
import { getAds, getAdHeadCodes } from "./ads";
import { ARTICLES_TAG, ADS_TAG, SETTINGS_TAG, TAXONOMY_TAG, articleTag } from "./cache-tags";
import { decodeSlug } from "./slug";

type Locale = Config["locale"];

/**
 * Data-cache layer for the (intentionally dynamic) article detail route.
 *
 * The article page is rendered dynamically — it must NOT use ISR/SSG because
 * non-ASCII (Arabic) slugs crash Vercel's SSG serving layer (see the article
 * route's own note + commit 99a3c35). To still avoid a Neon round-trip on
 * every view, we wrap the hot reads in `unstable_cache` (Vercel Data Cache).
 * Repeat views within REVALIDATE_SECONDS are served from the regional data
 * cache instead of the database. (The DB is in Frankfurt, like the functions —
 * an earlier version of this note said US-East, which was a different project.)
 *
 * Freshness: a short TTL bounds staleness, and the Payload afterChange/
 * afterDelete hooks call `revalidateTag` (see revalidate.ts) so published edits
 * appear immediately rather than waiting out the TTL.
 *
 * Cache-safety: every wrapped function is a pure Payload read — none of them
 * touch `cookies()`/`headers()`, which `unstable_cache` forbids. Returns are
 * plain JSON-serializable Payload docs.
 */
const REVALIDATE_SECONDS = 300; // 5 min ceiling for lists; tag invalidation makes edits instant.

/**
 * An article's own document changes only when it is saved, and a save busts
 * its own tag — so the entry can live much longer than a list. Lists (latest,
 * related, by tag/category) keep the short ceiling: they change whenever any
 * article is published, and a scheduled publish would not fire a hook.
 */
const ARTICLE_REVALIDATE_SECONDS = 3600;

export function cachedResolveArticleBySlug(slug: string, locale: Locale) {
  // Tagged by its own canonical slug (busted on that article's save) and by
  // the taxonomy tag (busted when a category or tag is renamed, since the doc
  // carries their names) — NOT by the global articles tag, so another
  // article's publish leaves this one warm.
  return unstable_cache(
    (s: string, l: Locale) => resolveArticleBySlug(s, l),
    ["resolve-article-by-slug"],
    {
      tags: [articleTag(decodeSlug(slug)), TAXONOMY_TAG],
      revalidate: ARTICLE_REVALIDATE_SECONDS,
    },
  )(slug, locale);
}

export function cachedGetRelatedArticles(
  articleId: string | number,
  categoryIds: (string | number)[],
  locale: Locale,
  limit = 4,
) {
  return unstable_cache(
    (
      id: string | number,
      cats: (string | number)[],
      l: Locale,
      lim: number,
    ) => getRelatedArticles(id, cats, l, lim),
    ["get-related-articles"],
    { tags: [ARTICLES_TAG], revalidate: REVALIDATE_SECONDS },
  )(articleId, categoryIds, locale, limit);
}

export function cachedGetArticles(options: {
  locale: Locale;
  page?: number;
  limit?: number;
  sort?: string;
}) {
  return unstable_cache(
    (opts: typeof options) => getArticles(opts),
    ["get-articles"],
    { tags: [ARTICLES_TAG], revalidate: REVALIDATE_SECONDS },
  )(options);
}

/**
 * Tag and category pages. Their slugs are Arabic, so they cannot go through
 * ISR (see lib/seo/isr.ts) and render on every request like the article page;
 * these wrappers give them the same data cache the article page has. Tagged
 * ARTICLES_TAG: a publish or a category save busts them, so a new article
 * appears on its tag and category listings at once rather than after the TTL.
 */
export function cachedGetTagBySlug(slug: string, locale: Locale) {
  return unstable_cache(
    (s: string, l: Locale) => getTagBySlug(s, l),
    ["get-tag-by-slug"],
    { tags: [ARTICLES_TAG], revalidate: REVALIDATE_SECONDS },
  )(slug, locale);
}

export function cachedGetArticlesByTag(tagId: string | number, locale: Locale, page: number) {
  return unstable_cache(
    (id: string | number, l: Locale, p: number) => getArticlesByTag(id, l, p),
    ["get-articles-by-tag"],
    { tags: [ARTICLES_TAG], revalidate: REVALIDATE_SECONDS },
  )(tagId, locale, page);
}

export function cachedGetCategoryBySlug(slug: string, locale: Locale) {
  return unstable_cache(
    (s: string, l: Locale) => getCategoryBySlug(s, l),
    ["get-category-by-slug"],
    { tags: [ARTICLES_TAG], revalidate: REVALIDATE_SECONDS },
  )(slug, locale);
}

export function cachedGetArticlesByCategory(
  categoryId: string | number,
  locale: Locale,
  page: number,
) {
  return unstable_cache(
    (id: string | number, l: Locale, p: number) => getArticlesByCategory(id, l, p),
    ["get-articles-by-category"],
    { tags: [ARTICLES_TAG], revalidate: REVALIDATE_SECONDS },
  )(categoryId, locale, page);
}

export function cachedGetAds(locale: Locale) {
  return unstable_cache((l: Locale) => getAds(l), ["get-ads"], {
    tags: [ADS_TAG],
    revalidate: REVALIDATE_SECONDS,
  })(locale);
}

/**
 * The ad-network head snippets the root layout injects on every page.
 *
 * The root layout renders on every dynamic request and every ISR regeneration
 * site-wide, so an uncached read here was one Neon round-trip per page view
 * regardless of route — the only query on the site that no page could avoid.
 * Tagged ADS_TAG, so saving an ad in the admin still takes effect at once.
 */
export function cachedGetAdHeadCodes() {
  return unstable_cache(() => getAdHeadCodes(), ["get-ad-head-codes"], {
    tags: [ADS_TAG],
    revalidate: REVALIDATE_SECONDS,
  })();
}

/**
 * Homepage Settings + Competitions, for the article route's matches sidebar.
 *
 * The article page is dynamic, so without this every article view would hit the
 * Neon DB twice more just to learn which competition to show. Both are tagged
 * SETTINGS_TAG, which the Homepage global and the Competitions collection bust
 * on write — so changing the featured league shows up immediately rather than
 * after the TTL.
 */
export function cachedFindHomepageSettings(locale: Locale) {
  return unstable_cache(
    (l: Locale) => findHomepageSettings(l),
    ["find-homepage-settings"],
    { tags: [SETTINGS_TAG], revalidate: REVALIDATE_SECONDS },
  )(locale);
}

export function cachedGetCompetitions(locale: Locale) {
  return unstable_cache((l: Locale) => getCompetitions(l), ["get-competitions"], {
    tags: [SETTINGS_TAG],
    revalidate: REVALIDATE_SECONDS,
  })(locale);
}
