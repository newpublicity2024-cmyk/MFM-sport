import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string, locale: string): string {
  return new Date(date).toLocaleDateString(
    locale === "ar" ? "ar-MA" : locale === "fr" ? "fr-FR" : "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  );
}

export function formatTime(date: string, locale: string): string {
  return new Date(date).toLocaleTimeString(
    locale === "ar" ? "ar-MA" : locale === "fr" ? "fr-FR" : "en-US",
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  );
}

export function getImageUrl(
  image: any,
  size: "thumbnail" | "card" | "hero" = "card",
): string | null {
  if (!image || typeof image === "string") return null;
  return image.sizes?.[size]?.url || image.url || null;
}

export function getImageAlt(image: any): string {
  if (!image || typeof image === "string") return "";
  return image.alt || "";
}

type WithLogo = { logo?: unknown; logoUrl?: string | null };

export function getEntityLogoUrl(entity: WithLogo | null | undefined): string | null {
  if (!entity) return null;
  const logo = entity.logo;
  if (logo && typeof logo === "object" && "url" in logo && typeof (logo as { url: unknown }).url === "string") {
    return (logo as { url: string }).url;
  }
  if (typeof entity.logoUrl === "string" && entity.logoUrl.length > 0) {
    return entity.logoUrl;
  }
  return null;
}

type WithHero = { featuredImage?: unknown; featuredImageUrl?: string | null };

export function getArticleHeroUrl(article: WithHero | null | undefined, size: "thumbnail" | "card" | "hero" = "hero"): string | null {
  if (!article) return null;
  const upload = article.featuredImage;
  if (upload && typeof upload === "object") {
    const u = upload as { url?: string; sizes?: Record<string, { url?: string }> };
    const sized = u.sizes?.[size]?.url;
    if (sized) return sized;
    if (u.url) return u.url;
  }
  if (typeof article.featuredImageUrl === "string" && article.featuredImageUrl.length > 0) {
    return article.featuredImageUrl;
  }
  return null;
}
