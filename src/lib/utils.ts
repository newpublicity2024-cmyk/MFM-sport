import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * The zone every date and time on the site is shown in.
 *
 * API-Football returns UTC instants and Vercel's functions run in UTC, so a
 * bare `toLocaleTimeString` rendered kickoffs an hour early on production
 * (fixture 1550109: 16:30Z shown as 16:30, real Casablanca kickoff 17:30 —
 * measured 21 September 2026). The IANA zone, not a fixed +1: Morocco drops to
 * UTC+0 for Ramadan every year, and tz 2026c moves the country to permanent
 * UTC+0 from 20 September 2026 — Vercel's Node 24 already carries that, a
 * hand-written offset would not. Pinning the zone also makes server and
 * browser agree, so the client components that call these helpers stop
 * patching the text on hydration. Note that a machine with older tz data
 * (Node 22.23 ships tz 2026a) converts post-switch dates differently from
 * production; assert on the served bytes, not on a local render.
 */
export const SITE_TIME_ZONE = "Africa/Casablanca";

function intlLocale(locale: string): string {
  return locale === "ar" ? "ar-MA" : locale === "fr" ? "fr-FR" : "en-US";
}

export function formatDate(date: string, locale: string): string {
  return new Date(date).toLocaleDateString(intlLocale(locale), {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: SITE_TIME_ZONE,
  });
}

export function formatTime(date: string, locale: string): string {
  return new Date(date).toLocaleTimeString(intlLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: SITE_TIME_ZONE,
  });
}

/** Weekday, date and kickoff in one string — the details card and meta description. */
export function formatKickoffDateTime(date: string, locale: string): string {
  return new Date(date).toLocaleString(intlLocale(locale), {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: SITE_TIME_ZONE,
  });
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
