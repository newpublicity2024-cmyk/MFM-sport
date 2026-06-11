/** Parse a page value from a URL segment/param. Returns a 1-based page, defaulting to 1. */
export function parsePageParam(raw: string | undefined): number {
  const n = parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Build a listing href: page 1 → base path, page N>1 → `${basePath}/page/${N}`. */
export function pageHref(basePath: string, page: number): string {
  return page <= 1 ? basePath : `${basePath}/page/${page}`;
}
