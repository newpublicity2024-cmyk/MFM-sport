export type LocaleString = { en: string; ar: string; fr: string };

export type League = {
  id: string;
  name: LocaleString;
  /** api-sports league crest. */
  logoUrl: string;
  /** api-football league id (used for /matches?league= links). */
  apiFootballId: number;
};

/**
 * Leagues surfaced in the homepage "news by league" section. Real league
 * metadata (names + crests); the articles attributed to each are wired up in
 * `cards.ts` / the homepage. For the launch demo every league is filled with a
 * distinct slice of our real (Botola) articles — see buildLeagueArticles.
 */
export const LEAGUES: League[] = [
  {
    id: "botola-pro",
    name: { en: "Botola Pro", ar: "البطولة الاحترافية", fr: "Botola Pro" },
    logoUrl: "https://media.api-sports.io/football/leagues/200.png",
    apiFootballId: 200,
  },
  {
    id: "champions-league",
    name: { en: "Champions League", ar: "دوري أبطال أوروبا", fr: "Ligue des champions" },
    logoUrl: "https://media.api-sports.io/football/leagues/2.png",
    apiFootballId: 2,
  },
  {
    id: "premier-league",
    name: { en: "Premier League", ar: "الدوري الإنجليزي", fr: "Premier League" },
    logoUrl: "https://media.api-sports.io/football/leagues/39.png",
    apiFootballId: 39,
  },
  {
    id: "la-liga",
    name: { en: "La Liga", ar: "الدوري الإسباني", fr: "La Liga" },
    logoUrl: "https://media.api-sports.io/football/leagues/140.png",
    apiFootballId: 140,
  },
  {
    id: "serie-a",
    name: { en: "Serie A", ar: "الدوري الإيطالي", fr: "Serie A" },
    logoUrl: "https://media.api-sports.io/football/leagues/135.png",
    apiFootballId: 135,
  },
  {
    id: "ligue-1",
    name: { en: "Ligue 1", ar: "الدوري الفرنسي", fr: "Ligue 1" },
    logoUrl: "https://media.api-sports.io/football/leagues/61.png",
    apiFootballId: 61,
  },
];

export function leagueName(league: League, locale: string): string {
  if (locale === "ar") return league.name.ar;
  if (locale === "fr") return league.name.fr;
  return league.name.en;
}
