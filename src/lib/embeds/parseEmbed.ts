/**
 * Reduces whatever a journalist pasted into a canonical embed descriptor.
 *
 * The site no longer stores or executes pasted embed HTML. A journalist may paste
 * either a bare link or a full embed snippet copied from a platform's share dialog
 * — this parser accepts both, but its output never contains markup. It resolves
 * the input down to a platform, a platform-native id, and a canonical URL; a
 * later, separate rendering step turns that into native markup per platform
 * (react-tweet for X, plain lazy iframes for Facebook and Instagram) with no
 * platform SDK ever loaded. Anything that cannot be resolved to a known platform
 * is `null`.
 *
 * Pure and synchronous by design: no DOM, no network, no oEmbed call, and this
 * must never throw regardless of input — a throw here would 500 an article page.
 * Every branch here is unit-tested in parseEmbed.test.ts.
 */

export type EmbedPlatform = "x" | "facebook" | "instagram" | "youtube";

export type ParsedEmbed = {
  platform: EmbedPlatform;
  /** Platform-native identifier: tweet id, YouTube video id, Instagram shortcode. For
   *  Facebook, whose plugin takes the whole URL rather than an id, this is the canonical URL. */
  id: string;
  /** The canonical, normalised URL. This is what a renderer or a fallback link uses. */
  canonicalUrl: string;
};

// Hostname allowlists per platform — exact match, lowercase, never `endsWith` (so
// "notfacebook.com" and "l.facebook.com" both fail). Record<EmbedPlatform, ...> so a
// typo'd key is a compile error instead of an `undefined` lookup at runtime.
const HOSTNAME_ALLOWLISTS: Record<EmbedPlatform, readonly string[]> = {
  youtube: ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"],
  instagram: ["instagram.com", "www.instagram.com", "m.instagram.com"],
  x: ["twitter.com", "www.twitter.com", "mobile.twitter.com", "x.com", "www.x.com"],
  facebook: ["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com"],
};

// Short links we recognise but deliberately refuse to resolve. Deliberately absent
// from HOSTNAME_ALLOWLISTS.facebook: resolving fb.watch to a real post needs a
// network round trip, and guessing (as the old code did, defaulting to the "post"
// plugin) gets it wrong — fb.watch is always video.
const UNRESOLVABLE_SHORT_LINK_HOSTS: readonly string[] = ["fb.watch"];

export function parseEmbed(input: string | null | undefined): ParsedEmbed | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;

  // Markup wins over direct URL parsing. A pasted snippet is recognisable by its
  // "<", and it usually *contains* one or more candidate URLs; the snippet itself
  // is discarded either way — only a successfully resolved URL survives.
  if (raw.includes("<")) {
    return parseMarkup(raw);
  }

  return parseUrl(raw);
}

/**
 * True for short links we recognise but deliberately refuse: resolving them needs a
 * network round trip, and guessing the content type gets it wrong. Task 4's validate()
 * uses this to show a more useful Arabic error than the generic one.
 */
export function isUnresolvableShortLink(input: string | null | undefined): boolean {
  const raw = (input ?? "").trim();
  if (!raw) return false;

  const url = tryParseHttpUrl(raw);
  if (!url) return false;

  return UNRESOLVABLE_SHORT_LINK_HOSTS.includes(url.hostname.toLowerCase());
}

// Parses an absolute http(s) URL, never throwing. Shared by parseUrl and
// isUnresolvableShortLink so both apply the exact same "is this a URL at all"
// rule.
function tryParseHttpUrl(raw: string): URL | null {
  if (!/^https?:\/\//i.test(raw)) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function parseUrl(raw: string): ParsedEmbed | null {
  const url = tryParseHttpUrl(raw);
  if (!url) return null;

  const hostname = url.hostname.toLowerCase();

  if (HOSTNAME_ALLOWLISTS.youtube.includes(hostname)) {
    const videoId = extractYouTubeId(url);
    if (!videoId) return null;
    return {
      platform: "youtube",
      id: videoId,
      canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    };
  }

  if (HOSTNAME_ALLOWLISTS.instagram.includes(hostname)) {
    const match = url.pathname.match(/\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
    if (!match) return null;
    const [, type, shortcode] = match;
    return {
      platform: "instagram",
      id: shortcode,
      canonicalUrl: `https://www.instagram.com/${type}/${shortcode}/`,
    };
  }

  if (HOSTNAME_ALLOWLISTS.x.includes(hostname)) {
    const match = url.pathname.match(/\/([A-Za-z0-9_]{1,15})\/status\/(\d+)/);
    if (!match) return null;
    const [, handle, id] = match;
    return {
      platform: "x",
      id,
      canonicalUrl: `https://x.com/${handle}/status/${id}`,
    };
  }

  if (HOSTNAME_ALLOWLISTS.facebook.includes(hostname)) {
    const canonicalUrl = `${url.origin}${url.pathname}`;
    return { platform: "facebook", id: canonicalUrl, canonicalUrl };
  }

  // fb.watch (and anything else outside every allowlist above) falls through here.
  return null;
}

// Attributes a journalist's pasted snippet is expected to carry a link in.
const ATTRIBUTE_URL_PATTERN = /(?:href|src|data-href|data-instgrm-permalink)\s*=\s*"([^"]*)"/gi;
// A bare https://... run in text, not inside an attribute — bounded by whitespace,
// quotes or angle brackets rather than assuming any particular surrounding markup.
const BARE_URL_PATTERN = /https?:\/\/[^\s"'<>]+/gi;

/**
 * Extracts candidate URLs from pasted embed markup and resolves the first one that
 * matches a known platform. The markup itself is discarded either way.
 */
function parseMarkup(markup: string): ParsedEmbed | null {
  for (const candidate of extractCandidateUrls(markup)) {
    const result = parseUrl(candidate);
    if (result) return result;
  }
  return null;
}

function extractCandidateUrls(markup: string): string[] {
  // Pasted markup is HTML-escaped (e.g. "&amp;" for "&" in a query string); decode
  // before parsing so an extracted candidate is a well-formed URL.
  const decoded = markup.replace(/&amp;/g, "&");

  const candidates: string[] = [];
  for (const match of decoded.matchAll(ATTRIBUTE_URL_PATTERN)) {
    candidates.push(match[1]);
  }
  for (const match of decoded.matchAll(BARE_URL_PATTERN)) {
    candidates.push(match[0]);
  }
  return candidates;
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
