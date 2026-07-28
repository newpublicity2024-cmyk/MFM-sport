/**
 * Staged indexation policy for the WordPress archive backfill.
 *
 * The backfill adds ~37,000 articles to a site that currently has ~400. Flipping
 * all of them indexable at once would be a 90× index expansion overnight — the
 * kind of step change that invites a sitewide quality reassessment, on a domain
 * whose quality signals are already the problem.
 *
 * So indexation is released in batches. Everything is imported and every legacy
 * URL 301s from day one — link equity does not require indexation, only that the
 * URL resolves. What is staged is purely whether Google is invited to index the
 * page.
 *
 * Releasing a batch means editing RELEASED_ARCHIVE_YEARS below and deploying.
 * It is deliberately a config change and never a re-import or a bulk DB write:
 * `seoTier` and `publishedAt` are stored on the row, and indexability is derived
 * from them at render time by `isIndexable()`.
 */

export type SeoTier = "editorial" | "archive-full" | "archive-brief";

/**
 * Publish years whose `archive-full` articles are currently invited into the
 * index. Widen this as Search Console impressions confirm each batch is landing
 * without dragging sitewide quality signals down.
 *
 * Rollout plan:
 *   Stage 1 (now)  → 2024, 2025, 2026   ~8,600 articles
 *   Stage 2        → + 2023             ~6,600 more
 *   Stage 3        → + 2022             ~9,900 more
 *   Stage 4        → + 2021 and earlier ~11,900 more
 */
export const RELEASED_ARCHIVE_YEARS: ReadonlySet<number> = new Set([2024, 2025, 2026]);

/**
 * `archive-brief` is everything under 500 characters of body text — roughly
 * 10,000 posts, a headline and a sentence or two. These are held back
 * indefinitely rather than staged: they will not rank for anything, and in bulk
 * they are exactly the thin-content dilution the fixture pages already inflict.
 *
 * They remain fully reachable and keep their 301s. Flip this to true only if
 * Search Console shows them earning impressions on their own.
 */
export const RELEASE_ARCHIVE_BRIEF = false;

type IndexableInput = {
  seoTier?: SeoTier | null;
  publishedAt?: string | Date | null;
};

/**
 * Whether this article should be advertised to search engines — governs both the
 * `robots` meta tag and inclusion in the sitemap. The two must agree: listing a
 * noindex URL in a sitemap is a contradictory signal.
 */
export function isIndexable(article: IndexableInput): boolean {
  const tier = article.seoTier ?? "editorial";

  // Anything written in the CMS is always indexable — the staging applies only
  // to the imported archive.
  if (tier === "editorial") return true;

  if (tier === "archive-brief") return RELEASE_ARCHIVE_BRIEF;

  if (tier === "archive-full") {
    const year = publishYear(article.publishedAt);
    return year !== null && RELEASED_ARCHIVE_YEARS.has(year);
  }

  return false;
}

function publishYear(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getUTCFullYear();
  return Number.isFinite(year) ? year : null;
}

/**
 * The `robots` value for a page's metadata. Held-back archive articles are
 * `noindex, follow`: kept out of the index, but their internal links are still
 * crawled so they pass authority to the club and category hubs they mention.
 */
export function robotsFor(article: IndexableInput) {
  return isIndexable(article) ? undefined : { index: false, follow: true };
}
