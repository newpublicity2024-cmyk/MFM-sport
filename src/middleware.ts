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

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/admin") || pathname.startsWith("/api")) {
    return NextResponse.next();
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
