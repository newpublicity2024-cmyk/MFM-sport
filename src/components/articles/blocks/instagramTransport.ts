/**
 * Pure helper: turns an Instagram `canonicalUrl` (as produced by `parseEmbed.ts`,
 * e.g. `https://www.instagram.com/p/ABC123/`) into the iframe `src` and the
 * aspect-ratio box the renderer should reserve.
 *
 * Never throws — mirrors `parseEmbed.ts`'s own "must never 500 an article page"
 * discipline. Returns `null` for anything that isn't a parseable URL so the caller
 * can still render the unconditional caption+link fallback (A1) even when the
 * iframe itself cannot be built.
 */

export type IframeTransport = {
  src: string;
  /** CSS `aspect-ratio` value, e.g. "9 / 16". */
  aspectRatio: string;
};

// A2 — NOT redundant. The transport spike (see design doc) found that
// /p/{reel-shortcode}/embed also fetches fine, so the /p/ vs /reel/ distinction
// stops mattering for *transport*. It still decides *layout*: reels are 9:16,
// posts are roughly 1:1 to 4:5. Using one fixed ratio for both produces either
// heavy letterboxing (reel ratio on a post) or a container that resizes after
// the iframe loads (post ratio on a reel) — the latter is CLS, on a site whose
// Core Web Vitals are actively being protected. Do not delete this switch as
// dead code just because both path forms fetch identically.
const REEL_ASPECT_RATIO = "9 / 16";
const POST_ASPECT_RATIO = "4 / 5";

function tryParseUrl(value: string): URL | null {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function instagramTransport(canonicalUrl: string): IframeTransport | null {
  const url = tryParseUrl(canonicalUrl);
  if (!url) return null;

  const pathname = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
  const src = `${url.origin}${pathname}embed`;
  const aspectRatio = /^\/reel\//.test(pathname) ? REEL_ASPECT_RATIO : POST_ASPECT_RATIO;

  return { src, aspectRatio };
}
