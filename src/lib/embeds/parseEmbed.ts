/**
 * Turns whatever a journalist pasted into a renderable embed descriptor.
 *
 * Accepts either a plain link or a full embed snippet — the field says so, and
 * journalists paste both. Links resolve to an iframe wherever the platform offers
 * one, so article pages load no third-party SDK. X/Twitter is the sole exception:
 * it has no supported iframe endpoint, so it needs widgets.js.
 *
 * Pure and synchronous by design: no DOM, no network, no oEmbed call. Every
 * branch here is unit-tested in parseEmbed.test.ts.
 */

export type EmbedPlatform = "twitter" | "instagram" | "facebook" | "tiktok";

export type ParsedEmbed =
  | { kind: "iframe"; src: string; title: string; ratio: number }
  | { kind: "script"; html: string; platform: "twitter" }
  | { kind: "html"; html: string; platforms: EmbedPlatform[] }
  | { kind: "invalid" };

const RATIO_VIDEO = 16 / 9;
const RATIO_VERTICAL = 9 / 16;
const RATIO_SOCIAL = 4 / 5;

// Markers that tell us which SDK a pasted snippet needs. A snippet with none of
// these (a bare <iframe>, say) needs no script at all.
const SDK_MARKERS: { platform: EmbedPlatform; pattern: RegExp }[] = [
  { platform: "twitter", pattern: /twitter-tweet/ },
  { platform: "instagram", pattern: /instagram-media/ },
  { platform: "facebook", pattern: /fb-(post|video|page)/ },
  { platform: "tiktok", pattern: /tiktok-embed/ },
];

// Hostname allowlists per platform (exact match, lowercase)
const HOSTNAME_ALLOWLISTS: { [key: string]: string[] } = {
  youtube: ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"],
  instagram: ["instagram.com", "www.instagram.com"],
  tiktok: ["tiktok.com", "www.tiktok.com", "m.tiktok.com"],
  twitter: ["twitter.com", "www.twitter.com", "mobile.twitter.com", "x.com", "www.x.com"],
  facebook: ["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com", "fb.watch"],
};

export function parseEmbed(input: string | null | undefined): ParsedEmbed {
  const raw = (input ?? "").trim();
  if (!raw) return { kind: "invalid" };

  // Markup wins over URL detection. A pasted snippet usually *contains* a URL,
  // and the journalist's explicit snippet is the more specific intent.
  if (raw.includes("<")) {
    const platforms = SDK_MARKERS.filter((m) => m.pattern.test(raw)).map((m) => m.platform);
    return { kind: "html", html: raw, platforms };
  }

  if (!/^https?:\/\//i.test(raw)) return { kind: "invalid" };

  // Parse the URL. Invalid URLs return invalid, not an exception.
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { kind: "invalid" };
  }

  const hostname = url.hostname.toLowerCase();

  // YouTube
  if (HOSTNAME_ALLOWLISTS.youtube.includes(hostname)) {
    const videoId = extractYouTubeId(url);
    if (videoId) {
      return {
        kind: "iframe",
        src: `https://www.youtube-nocookie.com/embed/${videoId}`,
        title: "YouTube",
        ratio: RATIO_VIDEO,
      };
    }
  }

  // Instagram
  if (HOSTNAME_ALLOWLISTS.instagram.includes(hostname)) {
    const match = url.pathname.match(/\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
    if (match) {
      return {
        kind: "iframe",
        src: `https://www.instagram.com/${match[1]}/${match[2]}/embed`,
        title: "Instagram",
        ratio: RATIO_SOCIAL,
      };
    }
  }

  // TikTok
  if (HOSTNAME_ALLOWLISTS.tiktok.includes(hostname)) {
    const match = url.pathname.match(/@[^/]+\/video\/(\d+)/);
    if (match) {
      return {
        kind: "iframe",
        src: `https://www.tiktok.com/embed/v2/${match[1]}`,
        title: "TikTok",
        ratio: RATIO_VERTICAL,
      };
    }
  }

  // Twitter / X
  if (HOSTNAME_ALLOWLISTS.twitter.includes(hostname)) {
    const match = url.pathname.match(/\/([A-Za-z0-9_]{1,15})\/status\/(\d+)/);
    if (match) {
      const canonical = `https://twitter.com/${match[1]}/status/${match[2]}`;
      return {
        kind: "script",
        platform: "twitter",
        html: `<blockquote class="twitter-tweet" dir="rtl"><a href="${canonical}"></a></blockquote>`,
      };
    }
  }

  // Facebook
  if (HOSTNAME_ALLOWLISTS.facebook.includes(hostname)) {
    const plugin = /\/(videos?|watch)\b/.test(url.pathname) ? "video" : "post";
    return {
      kind: "iframe",
      src: `https://www.facebook.com/plugins/${plugin}.php?href=${encodeURIComponent(raw)}&show_text=true`,
      title: "Facebook",
      ratio: RATIO_SOCIAL,
    };
  }

  return { kind: "invalid" };
}

/**
 * Extract video ID from various YouTube URL formats.
 */
function extractYouTubeId(url: URL): string | null {
  const hostname = url.hostname.toLowerCase();

  if (hostname === "youtu.be") {
    const match = url.pathname.match(/^\/([A-Za-z0-9_-]{11})/);
    if (match) return match[1];
  }

  if (hostname === "youtube.com" || hostname === "www.youtube.com" || hostname === "m.youtube.com") {
    // watch?v=ID
    const v = url.searchParams.get("v");
    if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;

    // /shorts/ID
    const shortsMatch = url.pathname.match(/\/shorts\/([A-Za-z0-9_-]{11})/);
    if (shortsMatch) return shortsMatch[1];

    // /embed/ID
    const embedMatch = url.pathname.match(/\/embed\/([A-Za-z0-9_-]{11})/);
    if (embedMatch) return embedMatch[1];

    // /live/ID
    const liveMatch = url.pathname.match(/\/live\/([A-Za-z0-9_-]{11})/);
    if (liveMatch) return liveMatch[1];
  }

  return null;
}
