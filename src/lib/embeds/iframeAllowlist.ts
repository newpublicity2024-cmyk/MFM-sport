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
 * an absolute http(s) URL, and its hostname must be in the allowlist above by exact
 * equality. Used both by the block's field `validate()` and directly in tests.
 */
export function isAllowedIframeSrc(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;

  const url = tryParseHttpUrl(trimmed);
  if (!url) return false;

  return isAllowedIframeHostname(url.hostname);
}
