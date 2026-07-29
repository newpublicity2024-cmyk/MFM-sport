/**
 * Hostname allowlist for the `embedFrame` block's `src` field (Datawrapper charts,
 * Google Maps, SoundCloud, Spotify).
 *
 * Same discipline as the hostname allowlists in `parseEmbed.ts`: exact string equality
 * only, never `endsWith` or `includes` — a suffix or substring check would let
 * "notsoundcloud.com" or "https://evil.com/?x=open.spotify.com" through. Everything
 * lives in this one array so adding a future provider, or a legacy alternate host for
 * an existing one, is a single-line change here rather than a hunt through block config.
 *
 * SoundCloud is load-bearing, not decorative: MFM is a radio brand and audio segments
 * are a real, recurring content type here.
 *
 * Each host below is the exact hostname the platform's own "Share → Embed" dialog
 * currently emits — not a guess at a plausible-looking domain:
 *   - Datawrapper chart embeds are served from `datawrapper.dwcdn.net`.
 *   - Google's "Embed a map" iframe points at `www.google.com/maps/embed?pb=…`.
 *   - SoundCloud's player iframe is served from `w.soundcloud.com` specifically —
 *     NOT `soundcloud.com` itself, which never appears as an iframe `src` host.
 *   - Spotify's embed iframes are served from `open.spotify.com/embed/…`.
 *
 * Hostname alone is NOT enough for every one of these (fix round 1, Finding 1): three
 * of the four hosts above are dedicated embed-only (sub)domains, where any path is by
 * definition an embed. `www.google.com` is not — it is Google's general web frontend,
 * so `isAllowedIframeSrc("https://www.google.com/search?q=test")` and even the bare
 * homepage both satisfied hostname-only matching. `PATH_PREFIXES_BY_HOSTNAME` below adds
 * a required path-prefix check, scoped per host, applied only after the hostname
 * exact-match above has already passed — see `isAllowedIframeSrc`.
 */

export const IFRAME_HOSTNAME_ALLOWLIST = [
  "datawrapper.dwcdn.net",
  "www.google.com",
  "w.soundcloud.com",
  "open.spotify.com",
] as const;

const ALLOWLIST_SET = new Set<string>(IFRAME_HOSTNAME_ALLOWLIST);

/** Exact-equality check only. Never rewrite this as `.endsWith()` or `.includes()`. */
export function isAllowedIframeHostname(hostname: string): boolean {
  return ALLOWLIST_SET.has(hostname.toLowerCase());
}

/**
 * Required path prefixes per hostname, checked only after `isAllowedIframeHostname`
 * has already passed. A host absent from this map (Datawrapper) has no path
 * constraint: it is a dedicated embed CDN where the path is just the chart id, so any
 * path on that host is an embed.
 *
 * Spotify lists two alternatives: its embed generator also emits podcast-episode links
 * under `/embed-podcast/…`, a distinct top-level path segment from `/embed/…` — not a
 * suffix or a looser boundary rule on the same prefix, so it gets its own entry rather
 * than widening the boundary check in a way that could quietly cover more than intended.
 */
const PATH_PREFIXES_BY_HOSTNAME: Readonly<Record<string, readonly string[]>> = {
  "www.google.com": ["/maps/embed"],
  "w.soundcloud.com": ["/player"],
  "open.spotify.com": ["/embed", "/embed-podcast"],
};

/**
 * True when `pathname` is exactly `prefix`, or starts with `prefix` followed by a `/`
 * segment separator. Deliberately not a bare `.startsWith(prefix)`: that would let
 * `/maps/embedxyz` satisfy a `/maps/embed` prefix, which is exactly the segment-
 * boundary bypass the fix-round review caught live.
 */
function matchesPathPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isAllowedIframePath(hostname: string, pathname: string): boolean {
  const prefixes = PATH_PREFIXES_BY_HOSTNAME[hostname.toLowerCase()];
  if (!prefixes) return true; // no constraint for this host
  return prefixes.some((prefix) => matchesPathPrefix(pathname, prefix));
}

// Mirrors parseEmbed.ts's own tryParseHttpUrl: an absolute http(s) URL, parsed without
// ever throwing, so a malformed paste fails closed instead of 500ing the admin save.
function tryParseHttpUrl(raw: string): URL | null {
  if (!/^https?:\/\//i.test(raw)) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

/**
 * Validates the embedFrame block's `src` value end to end: must be a non-empty string,
 * an absolute http(s) URL, its hostname must be in the allowlist above by exact
 * equality, AND — where that host declares one in `PATH_PREFIXES_BY_HOSTNAME` — its
 * path must match a required prefix on a segment boundary. Used both by the block's
 * field `validate()` and directly in tests.
 */
export function isAllowedIframeSrc(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;

  const url = tryParseHttpUrl(trimmed);
  if (!url) return false;

  if (!isAllowedIframeHostname(url.hostname)) return false;
  return isAllowedIframePath(url.hostname, url.pathname);
}
