/**
 * Canonical form for legacy-URL lookups.
 *
 * The redirect map is an exact string match on `from`, and that match was
 * silently failing for every Arabic URL — which is to say, effectively all of
 * them.
 *
 * WordPress permalinks percent-encode Arabic in LOWERCASE hex and end with a
 * trailing slash:
 *
 *     /%d8%b9%d9%84%d8%a7%d8%a1-...-%d9%8a/
 *
 * But before middleware ever sees the request, the platform 308-normalises it to
 * UPPERCASE hex with the trailing slash stripped:
 *
 *     /%D8%B9%D9%84%D8%A7%D8%A1-...-%D9%8A
 *
 * So the stored value and the incoming value never matched, the lookup returned
 * "no redirect", and the request fell through to locale routing and a 404. The
 * map had 200 rows and none of them worked.
 *
 * Percent-decoding is the canonical form: it is identical regardless of hex
 * case, and it is already how the rest of this codebase handles Next's
 * inconsistent encoding of route params (see lib/payload/slug.ts). Both sides —
 * what the importer stores and what middleware looks up — go through here.
 */
export function normalizeLegacyPath(pathname: string): string {
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    // Malformed escape sequence — fall back to the raw value rather than throw.
  }

  // Collapse the trailing slash. "/" itself is never a legacy candidate, so
  // reducing it to "" is harmless, but guard anyway.
  const trimmed = decoded.replace(/\/+$/, "");
  return trimmed || "/";
}
