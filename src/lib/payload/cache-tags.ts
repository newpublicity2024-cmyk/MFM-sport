// Standalone (no other imports) so both the data-cache layer (cached-queries.ts)
// and the Payload revalidation hooks (revalidate.ts, loaded by collections) can
// share these tags without creating an import cycle through queries.ts /
// @payload-config.
export const ARTICLES_TAG = "articles";
export const ADS_TAG = "ads";
// Homepage Settings + the Competitions collection: which competition is
// featured, in what order, with which crest. Read on the article route (which
// is dynamic, so it needs the data cache) as well as the homepage.
export const SETTINGS_TAG = "settings";
// Category and tag names/slugs as they appear ON an article (badges, links).
// A rename must reach cached article docs without a publish having to bust
// every article — so article entries carry this tag as well as their own.
export const TAXONOMY_TAG = "taxonomy";

/**
 * One tag per article, keyed by its canonical (decoded) slug. Busting it on
 * that article's save leaves every other article's cache entry warm; before
 * this, every publish cleared the whole `articles` tag, so on a day with six
 * publishes every article page went cold six times.
 */
export function articleTag(slug: string): string {
  return `article:${slug}`;
}
