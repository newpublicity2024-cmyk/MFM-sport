/**
 * The one canonical origin for the site.
 *
 * Production serves on https://www.mfmsport.ma and the apex 308s to www, but
 * NEXT_PUBLIC_SITE_URL is configured as the apex. That made every canonical,
 * hreflang and sitemap URL point at a host that immediately redirects — a
 * sitewide "which host is authoritative?" ambiguity on a domain whose search
 * identity is already in doubt.
 *
 * So we normalise here rather than trusting the env var: force https, force the
 * www subdomain, drop any trailing slash. Localhost is left alone so dev and
 * tests keep working.
 */
function normalize(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");

  // Never rewrite local/dev origins — no www, and http is correct there.
  if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(trimmed)) {
    return trimmed;
  }

  return trimmed
    .replace(/^http:\/\//i, "https://")
    .replace(/^https:\/\/(?!www\.)/i, "https://www.");
}

export const SITE_URL = normalize(
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.mfmsport.ma",
);

/** Absolute URL for a site-relative path, e.g. absoluteUrl("/ar/articles"). */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
