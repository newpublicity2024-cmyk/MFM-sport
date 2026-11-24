/**
 * Web push for new articles — the pure half: WHETHER a save sends, and WHAT it
 * sends. No I/O here, so every rule below is unit-tested without a database or
 * a network (see __tests__/articleNotification.test.ts).
 *
 * The audience is real from the first publish: the OneSignal app `mfmsport.ma`
 * dates from the WordPress site and still holds ~1,364 reachable subscribers.
 * A wrong "send" cannot be recalled, so the decision is fail-closed — every
 * guard below has to agree before anything leaves the building.
 */
import { createHash } from "node:crypto";
import { extractPlainText } from "@/lib/richtext/extractPlainText";
import { SITE_NAME_AR } from "@/lib/seo/siteIdentity";
import { getArticleHeroUrl } from "@/lib/utils";

/** A publish whose `publishedAt` is older than this is not news: it is an old
 *  article being re-published, back-dated, or touched by a script. */
export const PUSH_FRESHNESS_MS = 12 * 60 * 60 * 1000;

/** Undelivered notifications expire after a day — a device that comes online
 *  on Thursday should not receive Monday's match report. OneSignal's default
 *  is three days. */
export const PUSH_TTL_SECONDS = 24 * 60 * 60;

/** Body text budget. Android shows ~2 lines collapsed; the rest is cut. */
export const PUSH_LEDE_MAX_CHARS = 140;

/** OneSignal's built-in "everyone subscribed" segment. Its existence on the
 *  live app is checked by `scripts/verify-push.ts live`, not assumed. */
export const PUSH_SEGMENT = "Subscribed Users";

/** Fixed namespace for the per-article idempotency UUID (RFC 9562 v5). Never
 *  change it: doing so would let every article published in the last 30 days
 *  (OneSignal's idempotency window) be sent a second time. */
const IDEMPOTENCY_NAMESPACE = "6f1c2a52-8a37-4d3e-9b1e-3f0c6d1a9e47";

export type PushEnv = {
  VERCEL_ENV?: string;
  ONESIGNAL_APP_API_KEY?: string;
  NEXT_PUBLIC_ONESIGNAL_APP_ID?: string;
};

type ArticleState = {
  id: number | string;
  status?: string | null;
  seoTier?: string | null;
  publishedAt?: string | null;
};

export type PushDecision =
  | { send: true }
  | {
      send: false;
      reason:
        | "not-published"
        | "already-published"
        | "not-editorial"
        | "bulk-context"
        | "not-production"
        | "not-configured"
        | "no-date"
        | "stale";
    };

/** Reasons that fire on almost every save; logging them would be noise. */
export const ROUTINE_SKIPS = new Set(["not-published", "already-published"]);

/**
 * Sends only for the FIRST publish of an editorial article, on production,
 * when OneSignal is configured, and while the article is fresh.
 *
 * Order matters only for which reason is reported; any single failing guard
 * stops the send.
 */
export function decideArticlePush(input: {
  doc: ArticleState;
  previousDoc?: Partial<ArticleState> | null;
  operation: "create" | "update" | string;
  context?: Record<string, unknown> | null;
  env: PushEnv;
  now: Date;
}): PushDecision {
  const { doc, previousDoc, operation, context, env, now } = input;

  if (doc.status !== "published") return { send: false, reason: "not-published" };
  // A save of an already-published article (a typo fix, a new tag) is not news.
  if (operation === "update" && previousDoc?.status === "published") {
    return { send: false, reason: "already-published" };
  }
  // Archive imports are published rows carrying an archive tier; 37,000 of them
  // must never reach a phone. Explicit "editorial" only — a missing tier fails
  // closed rather than open.
  if (doc.seoTier !== "editorial") return { send: false, reason: "not-editorial" };
  // Bulk scripts (importer, backfills, slug repair) already opt out of
  // revalidation with this flag; anything that skips revalidation is not an
  // editor pressing Publish.
  if (context?.disableRevalidate || context?.disablePush) {
    return { send: false, reason: "bulk-context" };
  }
  // Previews and local dev share the production database — a publish there is
  // real, but a notification from there is not ours to send.
  if (env.VERCEL_ENV !== "production") return { send: false, reason: "not-production" };
  if (!env.ONESIGNAL_APP_API_KEY || !env.NEXT_PUBLIC_ONESIGNAL_APP_ID) {
    return { send: false, reason: "not-configured" };
  }
  // setPublishedAtOnPublish stamps a date on every publish, so a missing one
  // means something bypassed it.
  const publishedAt = doc.publishedAt ? Date.parse(doc.publishedAt) : NaN;
  if (Number.isNaN(publishedAt)) return { send: false, reason: "no-date" };
  if (now.getTime() - publishedAt > PUSH_FRESHNESS_MS) return { send: false, reason: "stale" };

  return { send: true };
}

/** RFC 9562 version-5 UUID: deterministic, so every instance, retry and
 *  re-publish of one article presents OneSignal with the same key, and
 *  OneSignal drops the duplicate for 30 days. */
export function articlePushIdempotencyKey(articleId: number | string): string {
  const ns = Buffer.from(IDEMPOTENCY_NAMESPACE.replace(/-/g, ""), "hex");
  const hash = createHash("sha1")
    .update(ns)
    .update(`mfmsport:article-published:${String(articleId)}`, "utf8")
    .digest();
  const b = Buffer.from(hash.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50; // version 5
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 9562 variant
  const hex = b.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Cuts at the last word boundary that fits, then adds an ellipsis. */
export function truncateAtWord(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(" ");
  // A single unbroken run longer than the budget: hard-cut rather than return "".
  const cut = lastSpace > max / 2 ? slice.slice(0, lastSpace) : slice;
  return `${cut.replace(/[\s،,.:;-]+$/u, "")}…`;
}

export type NotifiableArticle = {
  id: number | string;
  title?: string | null;
  slug?: string | null;
  excerpt?: string | null;
  body?: unknown;
  featuredImage?: unknown;
  featuredImageUrl?: string | null;
};

/** The second line of the notification. Editors never fill `excerpt` (0 of
 *  the last 14 days' articles have one), so the opening of the body is the
 *  normal source; the site name is the last resort. */
export function articlePushLede(article: NotifiableArticle): string {
  const excerpt = article.excerpt?.trim();
  if (excerpt) return truncateAtWord(excerpt, PUSH_LEDE_MAX_CHARS);
  const bodyText = extractPlainText(article.body);
  if (bodyText) return truncateAtWord(bodyText, PUSH_LEDE_MAX_CHARS);
  return SITE_NAME_AR;
}

function absoluteHttps(url: string | null | undefined, siteUrl: string): string | undefined {
  if (!url) return undefined;
  const resolved = url.startsWith("/") ? `${siteUrl}${url}` : url;
  return resolved.startsWith("https://") ? resolved : undefined;
}

export type OneSignalPushBody = {
  app_id: string;
  target_channel: "push";
  included_segments: string[];
  name: string;
  headings: { en: string; ar: string };
  contents: { en: string; ar: string };
  url: string;
  chrome_web_image?: string;
  chrome_web_icon: string;
  firefox_icon: string;
  web_push_topic: string;
  ttl: number;
  idempotency_key: string;
};

/**
 * The request body for OneSignal's Create Notification endpoint.
 *
 * `en` is mandatory in `headings`/`contents` (OneSignal rejects a message
 * without it) and is also the fallback for every subscriber whose browser is
 * not Arabic — French-language browsers are common here — so both keys carry
 * the same Arabic text.
 */
export function buildArticleNotification(
  article: NotifiableArticle,
  opts: { appId: string; siteUrl: string },
): OneSignalPushBody {
  const title = article.title?.trim();
  const slug = article.slug?.trim();
  if (!title || !slug) {
    throw new Error(`[push] article ${String(article.id)} has no Arabic title or slug`);
  }
  const lede = articlePushLede(article);
  const icon = `${opts.siteUrl}/apple-icon.png`;
  const image = absoluteHttps(getArticleHeroUrl(article, "hero"), opts.siteUrl);

  return {
    app_id: opts.appId,
    target_channel: "push",
    included_segments: [PUSH_SEGMENT],
    // Internal only (the dashboard's message list), never shown to readers.
    name: `article:${String(article.id)}`,
    headings: { en: title, ar: title },
    contents: { en: lede, ar: lede },
    url: `${opts.siteUrl}/ar/articles/${encodeURIComponent(slug)}`,
    ...(image ? { chrome_web_image: image } : {}),
    chrome_web_icon: icon,
    firefox_icon: icon,
    // A later notification for the same article replaces this one on the
    // device instead of stacking beside it.
    web_push_topic: `article-${String(article.id)}`,
    ttl: PUSH_TTL_SECONDS,
    idempotency_key: articlePushIdempotencyKey(article.id),
  };
}
