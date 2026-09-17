/**
 * Why every ISR route with a dynamic segment must export generateStaticParams,
 * even when it has nothing to list.
 *
 * Next.js (16.2.4, `next/dist/build/static-paths/app.js`) only produces a
 * prerender entry for a dynamic route when its LAST dynamic segment has a
 * `generateStaticParams` — otherwise `prerenderedRoutes` is undefined and
 * `build/index.js` never sets `isSSG`, so the route is built as `ƒ` (dynamic)
 * and `export const revalidate = N` is silently ignored. `[locale]/layout.tsx`
 * has one, which is why `/ar/articles` and `/ar/club` are cached, while
 * `/ar/club/[slug]`, `/ar/articles/page/[n]` and every other slug route were
 * served `Cache-Control: private, no-cache, no-store` on every hit — 0 % cached
 * in Observability for a month, with a `revalidate` export sitting right there.
 *
 * Returning `[]` is the documented "generate everything on demand" form: the
 * first request renders and caches the page, later ones are HITs until
 * `revalidate` elapses.
 *
 * Only for routes whose PATHNAME is ASCII. On Vercel, an ISR response carries
 * `x-next-cache-tags` with the implicit tag `_N_T_<pathname>`
 * (`build/templates/app-page.js`), and Node rejects a header containing Arabic
 * with `TypeError: Invalid character in header content` — the 500 that took
 * newly published articles down in June (commit 99a3c35). Articles, tags and
 * categories have Arabic slugs and therefore stay dynamic; the middleware
 * keeps non-ASCII paths off the routes matched by ISR_ROUTE_PATTERNS.
 */
export function onDemandOnly(): never[] {
  return [];
}

/**
 * The exact shapes of every route rendered through ISR. Middleware rewrites a
 * request matching one of these whose path contains non-ASCII characters to a
 * plain (dynamic) 404, so it can never reach the ISR layer and trip the header
 * bug above. Real slugs on these routes are all ASCII (club / competition /
 * author slugs, page numbers, fixture ids). Deliberately NOT here: the article,
 * tag and category slug routes — Arabic, and dynamic for that reason.
 */
export const ISR_ROUTE_PATTERNS: readonly RegExp[] = [
  /^\/ar\/(club|competition|author|matches)\/[^/]+$/,
  /^\/ar\/author\/[^/]+\/page\/[^/]+$/,
  /^\/ar\/articles\/page\/[^/]+$/,
];

/** True when the decoded path holds any character outside printable ASCII. */
export function hasNonAscii(path: string): boolean {
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    // Malformed escapes: treat the raw path as the signal.
  }
  return /[^\x20-\x7e]/.test(decoded);
}

/** An ISR-rendered path that would put non-ASCII into `x-next-cache-tags`. */
export function isUnsafeIsrPath(pathname: string): boolean {
  return ISR_ROUTE_PATTERNS.some((re) => re.test(pathname)) && hasNonAscii(pathname);
}
