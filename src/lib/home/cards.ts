import { getArticleHeroUrl, getImageAlt } from "@/lib/utils";
import { competitionLogoUrl, sortByDisplayOrder } from "@/lib/home/competitionOrder";

// A league tab/pill with an ALREADY-LOCALIZED name (derived from the
// Competitions collection via getCompetitions(locale)), so the UI renders it
// directly without a locale lookup.
export type LeagueLite = {
  id: string;
  name: string;
  logoUrl: string;
  apiFootballId: number;
};

// A single (already-localized) competition doc → a filter pill, its CMS crest
// applied. Used for the admin-configured news filter (order preserved).
function competitionToLeague(c: CompetitionLike): LeagueLite {
  return {
    id: c.slug,
    name: c.name,
    logoUrl: competitionLogoUrl(c.apiFootballId, c.logoUrl),
    apiFootballId: c.apiFootballId,
  };
}

// Relationship value → its id, whether populated (object) or a raw id.
function relationId(v: unknown): number | string | undefined {
  if (v == null) return undefined;
  if (typeof v === "object") return (v as { id?: number | string }).id;
  return v as number | string;
}

// A resolved Homepage Settings news-filter row: the pill plus the ids used to
// source its articles (tag first, the competition's category as fallback).
export type NewsFilterResolved = {
  league: LeagueLite;
  tagId?: number | string;
  categoryId?: number | string;
};

// Map Homepage Settings `newsFilters` rows (depth-2 populated) into resolved
// rows, preserving the admin's order. Rows without a populated competition are
// skipped (can't render a pill without a crest/name).
export function resolveNewsFilters(rows: unknown[]): NewsFilterResolved[] {
  const out: NewsFilterResolved[] = [];
  for (const row of rows ?? []) {
    const r = row as { competition?: unknown; tag?: unknown };
    const comp = r?.competition;
    if (!comp || typeof comp !== "object") continue;
    const c = comp as CompetitionLike & { category?: unknown };
    if (typeof c.apiFootballId !== "number" || !c.slug) continue;
    out.push({
      league: competitionToLeague(c),
      tagId: relationId(r.tag),
      categoryId: relationId(c.category),
    });
  }
  return out;
}

type CompetitionLike = {
  slug: string;
  name: string;
  logoUrl?: string | null;
  apiFootballId: number;
  displayOrder?: number | null;
};

// Single source of truth for the homepage league lists: maps Competitions docs
// (already localized) into LeagueLite, ordered by the collection's displayOrder
// so the tabs and the carousel agree. Shares competitionLogoUrl with the
// carousel so both show identical crests.
export function competitionsToLeagues(docs: CompetitionLike[]): LeagueLite[] {
  return sortByDisplayOrder(docs).map((c) => ({
    id: c.slug,
    name: c.name,
    logoUrl: competitionLogoUrl(c.apiFootballId, c.logoUrl),
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
