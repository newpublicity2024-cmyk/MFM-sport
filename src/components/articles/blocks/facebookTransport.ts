/**
 * Pure helper: turns a Facebook `canonicalUrl` (as produced by `parseEmbed.ts`,
 * e.g. `https://www.facebook.com/MFMSport/videos/123/`) into the Social Plugins
 * iframe `src` (`plugins/video.php` or `plugins/post.php`) and the aspect-ratio
 * box the renderer should reserve.
 *
 * The `href` param is always built from the ALREADY-VALIDATED `canonicalUrl` the
 * parser produced (exact-hostname-matched against `HOSTNAME_ALLOWLISTS.facebook`
 * in parseEmbed.ts) — never from raw journalist input — so this function must
 * only ever be called with a `parseEmbed` result's `embed.canonicalUrl`.
 *
 * Never throws. Returns `null` for anything unparseable so the caller can still
 * render the unconditional caption+link fallback (A1).
 */

export type IframeTransport = {
  src: string;
  aspectRatio: string;
};

const VIDEO_ASPECT_RATIO = "16 / 9";
// Facebook posts vary a lot in height (text length, photo count), but a fixed
// box is still required so nothing shifts after the iframe loads. Taller than
// the video ratio is the closer approximation for a typical text/photo post.
const POST_ASPECT_RATIO = "3 / 4";

function tryParseUrl(value: string): URL | null {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isVideoUrl(url: URL): boolean {
  return /\/videos\//i.test(url.pathname) || url.pathname === "/watch" || url.pathname === "/watch/";
}

export function facebookTransport(canonicalUrl: string): IframeTransport | null {
  const url = tryParseUrl(canonicalUrl);
  if (!url) return null;

  const video = isVideoUrl(url);
  const plugin = video ? "video.php" : "post.php";

  const pluginUrl = new URL(`https://www.facebook.com/plugins/${plugin}`);
  pluginUrl.searchParams.set("href", canonicalUrl);
  pluginUrl.searchParams.set("show_text", "false");

  return {
    src: pluginUrl.toString(),
    aspectRatio: video ? VIDEO_ASPECT_RATIO : POST_ASPECT_RATIO,
  };
}
