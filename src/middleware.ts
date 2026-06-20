import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

const KNOWN_PREFIXES = ["/ar", "/fr", "/en", "/admin", "/api", "/_next", "/_vercel"];

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
      const lookupUrl = new URL(
        `/api/redirects?from=${encodeURIComponent(pathname)}`,
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
      // Silently fall through to normal routing
    }
  }

  // Normal next-intl locale routing
  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!_next|_vercel|admin|api|.*\\..*).*)"],
};
