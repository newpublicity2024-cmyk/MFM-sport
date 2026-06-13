import { getArticleHeroUrl, getImageAlt } from "@/lib/utils";

// A league tab/pill with an ALREADY-LOCALIZED name (derived from the
// Competitions collection via getCompetitions(locale)), so the UI renders it
// directly without a locale lookup.
export type LeagueLite = {
  id: string;
  name: string;
  logoUrl: string;
  apiFootballId: number;
};

type CompetitionLike = {
  slug: string;
  name: string;
  logoUrl?: string | null;
  apiFootballId: number;
};

// Single source of truth for the homepage league lists: maps Competitions docs
// (already localized) into LeagueLite, Botola (200) first to match the carousel.
// Replicates the carousel's logoUrl fallback so tabs and carousel show identical crests.
export function competitionsToLeagues(docs: CompetitionLike[]): LeagueLite[] {
  return docs
    .slice()
    .sort((a, b) => (a.apiFootballId === 200 ? -1 : b.apiFootballId === 200 ? 1 : 0))
    .map((c) => ({
      id: c.slug,
      name: c.name,
      logoUrl:
        c.logoUrl || `https://media.api-sports.io/football/leagues/${c.apiFootballId}.png`,
      apiFootballId: c.apiFootballId,
    }));
}

/**
 * Slim, already-localized article shapes for the homepage. We map Payload docs
 * to these on the server so the client bundle never ships heavy lexical bodies.
 * (`getArticles` is locale-aware, so `title` / `category.name` are plain strings
 * in the active locale.)
 */
export type HeroSlide = {
  id: string;
  title: string;
  slug: string;
  heroUrl: string | null;
  alt: string;
  categoryName?: string;
  categorySlug?: string;
  publishedAt?: string;
};

export type LeagueCardArticle = {
  id: string;
  title: string;
  slug: string;
  heroUrl: string | null;
  categoryName?: string;
  publishedAt?: string;
};

function firstCategory(a: any): { name?: string; slug?: string } {
  const cat = a?.categories?.[0];
  if (cat && typeof cat === "object") return { name: cat.name, slug: cat.slug };
  return {};
}

export function toHeroSlide(a: any): HeroSlide {
  const cat = firstCategory(a);
  return {
    id: String(a.id),
    title: a.title,
    slug: a.slug,
    heroUrl: getArticleHeroUrl(a, "hero"),
    alt: getImageAlt(a.featuredImage),
    categoryName: cat.name,
    categorySlug: cat.slug,
    publishedAt: a.publishedAt ?? undefined,
  };
}

export function toLeagueCard(a: any): LeagueCardArticle {
  const cat = firstCategory(a);
  return {
    id: String(a.id),
    title: a.title,
    slug: a.slug,
    heroUrl: getArticleHeroUrl(a, "card"),
    categoryName: cat.name,
    publishedAt: a.publishedAt ?? undefined,
  };
}

/**
 * Distributes a flat list of real articles into a distinct chunk per league so
 * each tab shows different content. Placeholder attribution for the launch demo
 * (we only have Botola articles today); real per-league sourcing comes later.
 */
export function buildLeagueArticles(
  articles: any[],
  leagues: LeagueLite[],
  perLeague = 4,
): Record<string, LeagueCardArticle[]> {
  const out: Record<string, LeagueCardArticle[]> = {};
  leagues.forEach((league, i) => {
    out[league.id] = articles
      .slice(i * perLeague, i * perLeague + perLeague)
      .map(toLeagueCard);
  });
  return out;
}
