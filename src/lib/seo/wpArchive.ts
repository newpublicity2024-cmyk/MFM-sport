/**
 * Pure parsing helpers for the WordPress archive backfill.
 *
 * Kept separate from scripts/import-wp-archive.ts so they can be unit-tested
 * without pulling in the Payload config (which requires DATABASE_URL and
 * PAYLOAD_SECRET at module load). Nothing here touches the database or the
 * filesystem.
 */

/** Below this many characters of body text an article is "brief" — a headline
 *  and a sentence. See docs/wp-corpus-analysis.md. */
export const BRIEF_THRESHOLD = 500;

/** ACF flexible-content fields carry body paragraphs alongside content:encoded.
 *  Ignoring them silently truncates articles. */
export const ACF_BODY_KEY = /^content(_block)?_\d+(_content_\d+|_article)?$/;

/**
 * Reduce a body to its readable text.
 *
 * The CDATA wrapper MUST be removed before stripping tags. `<![CDATA[` opens
 * with "<" and `]]>` closes with ">", so a naive /<[^>]+>/ swallows the entire
 * section as if it were one tag — deleting the body of every plain-text post.
 * That bug produced a fake "2,224 posts are empty" reading during analysis; the
 * real figure is 4.
 */
export function stripToText(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\[[^\]]{0,80}\]/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-z]+;/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function bodyTextLength(raw: string): number {
  return stripToText(raw).length;
}

export function tierFor(textLength: number): "archive-full" | "archive-brief" {
  return textLength >= BRIEF_THRESHOLD ? "archive-full" : "archive-brief";
}

/**
 * Strip images and figures. Every attachment URL in the export points at
 * mfmsport.ma/wp-content/uploads/..., which now 404s — the media is gone, so
 * keeping the tags would only render broken images.
 */
export function stripDeadMedia(html: string): string {
  return html
    .replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, "")
    .replace(/<img[^>]*>/gi, "")
    .replace(/<a[^>]*>\s*<\/a>/gi, "")
    .replace(/<p>\s*<\/p>/gi, "");
}

/**
 * Pull a YouTube video out of a body.
 *
 * A slice of the archive is video-only: the whole post body is a YouTube
 * <iframe> and nothing else. An iframe is not a Lexical node and carries no
 * text, so such a body converts to an empty state and fails the required-field
 * check — losing the row and its redirect. The Articles collection models this
 * properly via isVideo/videoUrl, so these are routed there instead.
 */
export function extractYouTubeUrl(html: string): string | null {
  const m =
    html.match(/youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]{6,})/i) ||
    html.match(/youtube\.com\/watch\?v=([A-Za-z0-9_-]{6,})/i) ||
    html.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/i);
  return m ? `https://www.youtube.com/watch?v=${m[1]}` : null;
}

/**
 * Resolve a post's publish date, tolerating WordPress's zero-date.
 *
 * A couple of rows carry `0000-00-00 00:00:00`, which becomes an Invalid Date
 * and makes toISOString() throw. Unhandled, that aborts the article and loses
 * its redirect — the most valuable part of importing the tail. Falls back to the
 * GMT column, then the modified date. Returns null only when nothing is usable,
 * so the caller can skip rather than write a NULL publishedAt (which sorts NULLS
 * FIRST and buries the newest articles in every listing).
 */
export function resolvePublishedAt(
  ...candidates: (string | null | undefined)[]
): string | null {
  for (const raw of candidates) {
    if (!raw) continue;
    if (raw.startsWith("0000-")) continue;
    const ts = new Date(raw.replace(" ", "T") + (raw.endsWith("Z") ? "" : "Z"));
    if (Number.isFinite(ts.getTime())) return ts.toISOString();
  }
  return null;
}

/** The path a legacy URL should redirect FROM, normalised to what the
 *  middleware actually receives. WP permalinks percent-encode Arabic. */
export function legacyPathFromLink(link: string): string | null {
  try {
    const u = new URL(link);
    return u.pathname.endsWith("/") ? u.pathname : `${u.pathname}/`;
  } catch {
    return null;
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
