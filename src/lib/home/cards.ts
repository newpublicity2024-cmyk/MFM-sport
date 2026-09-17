import { getArticleHeroUrl, getImageAlt } from "@/lib/utils";

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
