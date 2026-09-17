import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { normalizeLegacyPath } from "./lib/seo/legacyPath";
import { isUnsafeIsrPath } from "./lib/seo/isr";

const intlMiddleware = createIntlMiddleware(routing);

const KNOWN_PREFIXES = ["/ar", "/fr", "/en", "/admin", "/api", "/_next", "/_vercel"];

// The top-level sections that exist under /ar — the directories of
// src/app/(frontend)/[locale]/(site). An unprefixed request whose first segment
// is one of these ("/videos", "/matches") is a real page missing its locale
// and is 308'd to it below. Anything else that also misses the redirect map is
// an old WordPress URL with no destination, and gets the 404 directly.
const SITE_SECTIONS = new Set([
  "about",
  "articles",
  "author",
  "category",
  "club",
  "competition",
  "contact",
  "legal",
  "matches",
  "newsletter",
  "privacy",
  "search",
  "tag",
  "unsubscribe",
  "videos",
]);

/** Rewrite to a path no route owns, so global-not-found answers with a real 404. */
function notFoundResponse(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/ar/__not-found";
  return NextResponse.rewrite(url);
}

function isLegacyCandidate(pathname: string): boolean {
  if (KNOWN_PREFIXES.some((p) => pathname.startsWith(p))) return false;
  if (pathname.includes(".")) return false;
  if (pathname === "/") return false;
  return true;
}

// Retired locales: the site is Arabic-only now, but /fr and /en URLs still exist
// in the wild (Google, social). 301 them to the same path under /ar so visitors
// and link equity land on the Arabic equivalent instead of a 404.
const RETIRED_LOCALES = ["fr", "en"];

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/admin") || pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // A non-ASCII path on an ISR route would be written into the
  // `x-next-cache-tags` response header and 500 on Vercel (lib/seo/isr.ts).
  // No real slug on those routes is non-ASCII, so answer with the site's plain
  // 404 instead: rewriting to a path no route owns renders global-not-found
  // dynamically — a real 404 status, no ads, nothing in a cache-tags header.
  if (isUnsafeIsrPath(pathname)) {
    return notFoundResponse(request);
  }

  // /fr, /fr/..., /en, /en/... -> /ar(/...), preserving the query string.
  const firstSegment = pathname.split("/")[1];
  if (RETIRED_LOCALES.includes(firstSegment)) {
    const rest = pathname.slice(firstSegment.length + 1); // drop the "/fr" | "/en"
    const url = request.nextUrl.clone();
    url.pathname = `/ar${rest}`;
    return NextResponse.redirect(url, 301);
  }

  if (isLegacyCandidate(pathname)) {
    try {
      // Look up the canonical form, not the raw pathname. WordPress stored these
      // paths percent-encoded in lowercase with a trailing slash; the platform
      // 308-normalises incoming requests to uppercase hex without one, so an
      // exact match on the raw value missed every Arabic URL in the map. See
      // lib/seo/legacyPath. Normalising also collapses the encoding variants
      // onto one CDN cache key.
      const lookupUrl = new URL(
        `/api/redirects?from=${encodeURIComponent(normalizeLegacyPath(pathname))}`,
        request.url,
      );
      // Cache lookups (incl. misses) for a day so repeated legacy hits don't
      // re-invoke the /api/redirects function on every request.
      const res = await fetch(lookupUrl, { next: { revalidate: 86400 } });

      if (res.ok) {
        const data = await res.json();
        if (data.to) {
          return NextResponse.redirect(
            new URL(data.to, request.url),
            parseInt(data.statusCode) || 301,
          );
        }
      }
    } catch {
      // Lookup failed: treat as a miss and fall through.
    }

    // No redirect for this legacy path. It used to fall through to next-intl,
    // which 308'd it to /ar/<same path> — and that 404'd, so every dead
    // WordPress URL cost a redirect hop before its 404 (308s were 23% of all
    // requests in the 30 days to 17 September, ~200K of them this chain).
    // A 308 → 404 also tells Google the page moved, when it is simply gone.
    // Answer 404 in one response; the archive import restores these URLs by
    // adding redirect rows, not by anything here.
    if (!SITE_SECTIONS.has(firstSegment)) {
      return notFoundResponse(request);
    }
  }

  // Normal next-intl locale routing.
  // next-intl issues its locale redirects as 307 (temporary), which asks Google
  // to keep the old URL and re-check it every crawl. "/" -> "/ar" is permanent,
  // so upgrade any redirect it produces to 308 (the method-preserving permanent
  // equivalent of 301). Non-redirect responses pass through untouched.
  const response = intlMiddleware(request);
  if (response.status === 307) {
    const location = response.headers.get("location");
    if (location) {
      return NextResponse.redirect(new URL(location, request.url), 308);
    }
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next|_vercel|admin|api|.*\\..*).*)"],
};
