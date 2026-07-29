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

const YOUTUBE =
  /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;
const INSTAGRAM = /instagram\.com\/(p|reel|tv)\/([A-Za-z0-9_-]+)/;
const TIKTOK = /tiktok\.com\/@[^/]+\/video\/(\d+)/;
const TWITTER = /(?:twitter|x)\.com\/([^/]+)\/status\/(\d+)/;
const FACEBOOK = /facebook\.com\//;

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

  const youtube = YOUTUBE.exec(raw);
  if (youtube) {
    return {
      kind: "iframe",
      src: `https://www.youtube-nocookie.com/embed/${youtube[1]}`,
      title: "YouTube",
      ratio: RATIO_VIDEO,
    };
  }

  const instagram = INSTAGRAM.exec(raw);
  if (instagram) {
    return {
      kind: "iframe",
      src: `https://www.instagram.com/${instagram[1]}/${instagram[2]}/embed`,
      title: "Instagram",
      ratio: RATIO_SOCIAL,
    };
  }

  const tiktok = TIKTOK.exec(raw);
  if (tiktok) {
    return {
      kind: "iframe",
      src: `https://www.tiktok.com/embed/v2/${tiktok[1]}`,
      title: "TikTok",
      ratio: RATIO_VERTICAL,
    };
  }

  const twitter = TWITTER.exec(raw);
  if (twitter) {
    const canonical = `https://twitter.com/${twitter[1]}/status/${twitter[2]}`;
    return {
      kind: "script",
      platform: "twitter",
      html: `<blockquote class="twitter-tweet" dir="rtl"><a href="${canonical}"></a></blockquote>`,
    };
  }

  if (FACEBOOK.test(raw)) {
    // Facebook splits its plugin by content type; /videos/ and /watch use video.php.
    const plugin = /\/(videos?|watch)\b/.test(raw) ? "video" : "post";
    return {
      kind: "iframe",
      src: `https://www.facebook.com/plugins/${plugin}.php?href=${encodeURIComponent(raw)}&show_text=true`,
      title: "Facebook",
      ratio: RATIO_SOCIAL,
    };
  }

  return { kind: "invalid" };
}
