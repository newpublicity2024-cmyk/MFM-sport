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
