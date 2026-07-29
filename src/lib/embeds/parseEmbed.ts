/**
 * Reduces whatever a journalist pasted into a canonical embed descriptor.
 *
 * The site no longer stores or executes pasted embed HTML. A journalist may paste
 * either a bare link or a full embed snippet copied from a platform's share dialog
 * — this parser accepts both, but its output never contains markup. It resolves
 * the input down to a platform, a platform-native id, and a canonical URL; a
 * later, separate rendering step turns that into native markup per platform
 * (react-tweet for X, plain lazy iframes for Facebook and Instagram) with no
 * platform SDK ever loaded.
 *
 * The result is a discriminated union rather than `ParsedEmbed | null`, because a
 * caller (Task 4's `validate()`) needs to distinguish *why* nothing resolved:
 *   - "empty": nothing was pasted (or the input wasn't even a string).
 *   - "unsupported": there was content, but no known platform in it.
 *   - "short-link": every candidate was a short link we deliberately refuse to
 *     resolve (fb.watch) — resolving it needs a network round trip, and guessing
 *     the content type gets it wrong.
 *   - "multiple": the pasted markup contained more than one genuinely distinct
 *     embed (e.g. a quoted tweet, or two separate embed snippets pasted
 *     together), so which one the journalist meant is ambiguous.
 * `null` cannot carry a reason code, so this module owns the distinction and the
 * caller only surfaces it — it must never have to re-derive it.
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

export type EmbedFailure =
  /** Nothing to parse: empty, whitespace-only, or not a string at all. */
  | "empty"
  /** Parsed fine, but no supported platform. */
  | "unsupported"
  /** A short link we recognise but deliberately refuse — resolving it needs a network
   *  round trip, and guessing the content type gets it wrong. fb.watch is the case. */
  | "short-link"
  /** Pasted markup contained more than one distinct embed, so which one they meant is
   *  ambiguous. Quoted tweets and multiple embed snippets pasted together both hit this. */
  | "multiple";

export type ParseEmbedResult = { ok: true; embed: ParsedEmbed } | { ok: false; reason: EmbedFailure };

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
// plugin) gets it wrong — fb.watch is always video. Checked over every extracted
// candidate, not just a bare-URL whole input (see resolveCandidates) — mobile
// Facebook's share sheet produces fb.watch links inside pasted snippets just as
// often as bare, so a journalist pasting either shape must get the same answer.
const UNRESOLVABLE_SHORT_LINK_HOSTS: readonly string[] = ["fb.watch"];

export function parseEmbed(input: unknown): ParseEmbedResult {
  // B2: the signature is `unknown`, not `string | null | undefined`, because a
  // caller can hand this anything a form field or a stored value might contain.
  // Guarding here — before any string method is called — is what keeps the "must
  // never throw" contract true for arrays, plain objects, numbers, booleans and
  // symbols, not just for null/undefined.
  if (typeof input !== "string") return { ok: false, reason: "empty" };

  const raw = input.trim();
  if (!raw) return { ok: false, reason: "empty" };

  // Every input — a bare URL, a full embed snippet, or several of either pasted
  // together — goes through the same candidate-extraction pipeline. Treating a
  // bare URL as a single-candidate list (rather than parsing the whole trimmed
  // string as one URL) is what lets "two bare URLs pasted in one box" be
  // recognised as two candidates instead of one unparseable string.
  const cleaned = stripScriptsAndComments(raw);
  const candidates = extractCandidateUrls(cleaned);
  return resolveCandidates(candidates);
}

// B1: strips <script>…</script> blocks and <!-- … --> comments before any URL is
// extracted, so a URL that only appears inside either is never a candidate. Real
// embed snippets carry a <script> tag (the platform's widget loader) alongside
// the content the journalist actually meant, and a comment is a natural place
// for a decoy or a previous draft's leftover link to hide.
function stripScriptsAndComments(markup: string): string {
  return markup.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<!--[\s\S]*?-->/g, "");
}

// Parses an absolute http(s) URL, never throwing. Shared by parseUrl and the
// short-link check so both apply the exact same "is this a URL at all" rule.
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
 * Extracts every candidate URL from the (script/comment-stripped) input. A bare
 * URL input produces exactly one candidate; pasted markup usually produces
 * several — real or decoy, resolvable or not. Resolution and the distinct-pairs
 * count both happen afterwards, in resolveCandidates.
 */
function extractCandidateUrls(markup: string): string[] {
  // Pasted markup is HTML-escaped (e.g. "&amp;" for "&" in a query string); decode
  // before parsing so an extracted candidate is a well-formed URL. This must
  // happen before any hostname check — an encoded trick must not be able to slip
  // a disallowed host past the allowlist by decoding into a different string later.
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
 * Resolves a list of candidate URL strings to a single result, per B1 and B3:
 *
 * - Candidates are resolved with the exact same per-platform logic as a bare URL
 *   (parseUrl), then deduplicated by {platform, id} — not by raw URL string, so
 *   "twitter.com/a/status/1" and "x.com/a/status/1" count as one pair and a
 *   platform's own markup repeating its own link (e.g. once in the body, once in
 *   the attribution line) does not manufacture a second pair.
 * - More than one *distinct* pair means the paste was ambiguous: "multiple".
 * - Exactly one distinct pair resolves normally, even if it occurred several times.
 * - A resolvable embed always wins over a short link, even when both are present.
 *   Only when nothing resolves at all, and at least one candidate was a
 *   recognised-but-refused short link, does "short-link" apply.
 * - Otherwise: "unsupported".
 */
function resolveCandidates(candidates: readonly string[]): ParseEmbedResult {
  const resolved = new Map<string, ParsedEmbed>();
  let sawShortLink = false;

  for (const candidate of candidates) {
    const embed = parseUrl(candidate);
    if (embed) {
      const key = `${embed.platform}:${embed.id}`;
      if (!resolved.has(key)) resolved.set(key, embed);
      continue;
    }

    const url = tryParseHttpUrl(candidate);
    if (url && UNRESOLVABLE_SHORT_LINK_HOSTS.includes(url.hostname.toLowerCase())) {
      sawShortLink = true;
    }
  }

  const embeds = [...resolved.values()];
  if (embeds.length > 1) return { ok: false, reason: "multiple" };
  if (embeds.length === 1) return { ok: true, embed: embeds[0] };
  if (sawShortLink) return { ok: false, reason: "short-link" };
  return { ok: false, reason: "unsupported" };
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
