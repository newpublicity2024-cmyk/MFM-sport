/**
 * Shared locale-string type.
 *
 * The league-news mock data that used to live here was removed once the
 * homepage "news by league" section was wired to real articles
 * (see `src/lib/home/leagues.ts` + `src/lib/home/cards.ts`). This type is
 * retained because the Videos section mock (`mockVideos.ts`) still imports it;
 * that section is being replaced separately by the YouTube sync work.
 */
export type MockLocaleString = { en: string; ar: string; fr: string };
