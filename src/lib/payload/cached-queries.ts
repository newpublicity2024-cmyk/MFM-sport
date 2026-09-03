import { unstable_cache } from "next/cache";
import type { Config } from "@/payload-types";
import {
  resolveArticleBySlug,
  getArticleBySlug,
  getArticleLocalizedSlugs,
  getRelatedArticles,
  getArticles,
  findHomepageSettings,
  getCompetitions,
} from "./queries";
import { getAds } from "./ads";
import { ARTICLES_TAG, ADS_TAG, SETTINGS_TAG } from "./cache-tags";

type Locale = Config["locale"];

/**
 * Data-cache layer for the (intentionally dynamic) article detail route.
 *
 * The article page is rendered dynamically — it must NOT use ISR/SSG because
 * non-ASCII (Arabic) slugs crash Vercel's SSG serving layer (see the article
 * route's own note + commit 99a3c35). To still avoid a round-trip to the
 * US-East Neon DB from the EU functions on every view, we wrap the hot reads in
 * `unstable_cache` (Vercel Data Cache). Repeat views within REVALIDATE_SECONDS
 * are served from the regional data cache instead of the database.
 *
 * Freshness: a short TTL bounds staleness, and the Payload afterChange/
 * afterDelete hooks call `revalidateTag` (see revalidate.ts) so published edits
 * appear immediately rather than waiting out the TTL.
 *
 * Cache-safety: every wrapped function is a pure Payload read — none of them
 * touch `cookies()`/`headers()`, which `unstable_cache` forbids. Returns are
 * plain JSON-serializable Payload docs.
 */
const REVALIDATE_SECONDS = 300; // 5 min ceiling; tag invalidation makes edits instant.

export function cachedResolveArticleBySlug(slug: string, locale: Locale) {
  return unstable_cache(
    (s: string, l: Locale) => resolveArticleBySlug(s, l),
    ["resolve-article-by-slug"],
    { tags: [ARTICLES_TAG], revalidate: REVALIDATE_SECONDS },
  )(slug, locale);
}

export function cachedGetArticleBySlug(slug: string, locale: Locale) {
  return unstable_cache(
    (s: string, l: Locale) => getArticleBySlug(s, l),
    ["get-article-by-slug"],
    { tags: [ARTICLES_TAG], revalidate: REVALIDATE_SECONDS },
  )(slug, locale);
}

export function cachedGetArticleLocalizedSlugs(slug: string, locale: Locale) {
  return unstable_cache(
    (s: string, l: Locale) => getArticleLocalizedSlugs(s, l),
    ["get-article-localized-slugs"],
    { tags: [ARTICLES_TAG], revalidate: REVALIDATE_SECONDS },
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

export function cachedGetAds(locale: Locale) {
  return unstable_cache((l: Locale) => getAds(l), ["get-ads"], {
    tags: [ADS_TAG],
    revalidate: REVALIDATE_SECONDS,
  })(locale);
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
