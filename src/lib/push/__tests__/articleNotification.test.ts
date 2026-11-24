// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  PUSH_FRESHNESS_MS,
  PUSH_LEDE_MAX_CHARS,
  PUSH_SEGMENT,
  PUSH_TTL_SECONDS,
  articlePushIdempotencyKey,
  articlePushLede,
  buildArticleNotification,
  decideArticlePush,
  truncateAtWord,
  type PushEnv,
} from "../articleNotification";

const NOW = new Date("2026-11-24T12:00:00.000Z");
const PROD: PushEnv = {
  VERCEL_ENV: "production",
  ONESIGNAL_APP_API_KEY: "os_v2_app_test",
  NEXT_PUBLIC_ONESIGNAL_APP_ID: "a32a8dec-858d-40eb-98d2-b6e447b78a34",
};
const fresh = { id: 42, status: "published", seoTier: "editorial", publishedAt: NOW.toISOString() };

function decide(over: Partial<Parameters<typeof decideArticlePush>[0]> = {}) {
  return decideArticlePush({
    doc: fresh,
    previousDoc: { status: "draft" },
    operation: "update",
    context: {},
    env: PROD,
    now: NOW,
    ...over,
  });
}

describe("decideArticlePush", () => {
  it("sends on the first publish of a draft (draft → published)", () => {
    expect(decide()).toEqual({ send: true });
  });

  it("sends when an article is created already published", () => {
    expect(decide({ operation: "create", previousDoc: undefined })).toEqual({ send: true });
  });

  it("skips a re-save of an already-published article", () => {
    expect(decide({ previousDoc: { status: "published" } })).toEqual({ send: false, reason: "already-published" });
  });

  it("skips a draft save", () => {
    expect(decide({ doc: { ...fresh, status: "draft" } })).toEqual({ send: false, reason: "not-published" });
  });

  it("skips both archive tiers and fails closed on a missing tier", () => {
    for (const seoTier of ["archive-full", "archive-brief", null, undefined]) {
      expect(decide({ doc: { ...fresh, seoTier } })).toEqual({ send: false, reason: "not-editorial" });
    }
  });

  it("skips bulk-script saves (disableRevalidate, disablePush)", () => {
    expect(decide({ context: { disableRevalidate: true } })).toEqual({ send: false, reason: "bulk-context" });
    expect(decide({ context: { disablePush: true } })).toEqual({ send: false, reason: "bulk-context" });
  });

  it("skips preview and local environments, which share the production database", () => {
    for (const VERCEL_ENV of ["preview", "development", undefined]) {
      expect(decide({ env: { ...PROD, VERCEL_ENV } })).toEqual({ send: false, reason: "not-production" });
    }
  });

  it("skips when the app key or the app id is missing", () => {
    expect(decide({ env: { ...PROD, ONESIGNAL_APP_API_KEY: "" } })).toEqual({ send: false, reason: "not-configured" });
    expect(decide({ env: { ...PROD, NEXT_PUBLIC_ONESIGNAL_APP_ID: undefined } })).toEqual({
      send: false,
      reason: "not-configured",
    });
  });

  it("sends inside the freshness window and skips just outside it", () => {
    const at = (ms: number) => ({ ...fresh, publishedAt: new Date(NOW.getTime() - ms).toISOString() });
    expect(decide({ doc: at(PUSH_FRESHNESS_MS - 60_000) })).toEqual({ send: true });
    expect(decide({ doc: at(PUSH_FRESHNESS_MS + 60_000) })).toEqual({ send: false, reason: "stale" });
  });

  it("sends a future-dated publish (the site shows it immediately)", () => {
    const future = { ...fresh, publishedAt: new Date(NOW.getTime() + 3_600_000).toISOString() };
    expect(decide({ doc: future })).toEqual({ send: true });
  });

  it("skips when publishedAt is missing or unparseable", () => {
    expect(decide({ doc: { ...fresh, publishedAt: null } })).toEqual({ send: false, reason: "no-date" });
    expect(decide({ doc: { ...fresh, publishedAt: "not a date" } })).toEqual({ send: false, reason: "no-date" });
  });
});

const lexical = (...paragraphs: string[]) => ({
  root: {
    type: "root",
    children: paragraphs.map((text) => ({ type: "paragraph", children: [{ type: "text", text }] })),
  },
});

const ARTICLE = {
  id: 9381,
  title: "الوداد يتعادل مع الرجاء في ديربي مثير",
  slug: "الوداد-يتعادل-مع-الرجاء-في-ديربي-مثير",
  excerpt: null,
  body: lexical(
    "تعادل الوداد الرياضي مع الرجاء الرياضي بهدف لمثله في ديربي الدار البيضاء الذي احتضنه ملعب محمد الخامس مساء الأحد",
    "وسجل للوداد مهاجمه في الدقيقة العشرين قبل أن يعادل الرجاء في الشوط الثاني من ضربة جزاء",
  ),
  featuredImage: {
    url: "https://abc.public.blob.vercel-storage.com/derby.jpg",
    sizes: { hero: { url: "https://abc.public.blob.vercel-storage.com/derby-1200x630.jpg" } },
  },
};
const OPTS = { appId: PROD.NEXT_PUBLIC_ONESIGNAL_APP_ID as string, siteUrl: "https://www.mfmsport.ma" };

describe("buildArticleNotification", () => {
  it("puts the Arabic title in both the en and ar headings", () => {
    const body = buildArticleNotification(ARTICLE, OPTS);
    expect(body.headings).toEqual({ en: ARTICLE.title, ar: ARTICLE.title });
  });

  it("uses the body's opening as the lede when there is no excerpt, cut at a word boundary within budget", () => {
    const { contents } = buildArticleNotification(ARTICLE, OPTS);
    expect(contents.en).toBe(contents.ar);
    expect(contents.ar.length).toBeLessThanOrEqual(PUSH_LEDE_MAX_CHARS);
    expect(contents.ar.endsWith("…")).toBe(true);
    expect(contents.ar.startsWith("تعادل الوداد الرياضي")).toBe(true);
    // The character before the ellipsis ends a whole word of the source text.
    const kept = contents.ar.slice(0, -1);
    expect(extractedSource().startsWith(kept)).toBe(true);
    expect(extractedSource().charAt(kept.length)).toBe(" ");
  });

  it("prefers the excerpt when an editor wrote one", () => {
    expect(articlePushLede({ ...ARTICLE, excerpt: "  ملخص قصير  " })).toBe("ملخص قصير");
  });

  it("falls back to the site name when the body has no text", () => {
    expect(articlePushLede({ ...ARTICLE, body: lexical() })).toBe("إم إف إم سبور");
  });

  it("links to the absolute www article URL whose path decodes back to the slug", () => {
    const { url } = buildArticleNotification(ARTICLE, OPTS);
    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://www.mfmsport.ma");
    expect(decodeURIComponent(parsed.pathname)).toBe(`/ar/articles/${ARTICLE.slug}`);
    expect(url).not.toMatch(/[^\x21-\x7e]/); // ASCII only: percent-encoded
  });

  it("uses the 1200×630 hero image, resolves a relative URL, and drops a non-https one", () => {
    expect(buildArticleNotification(ARTICLE, OPTS).chrome_web_image).toBe(ARTICLE.featuredImage.sizes.hero.url);
    const relative = { ...ARTICLE, featuredImage: { url: "/api/media/file/x.jpg" } };
    expect(buildArticleNotification(relative, OPTS).chrome_web_image).toBe("https://www.mfmsport.ma/api/media/file/x.jpg");
    const insecure = { ...ARTICLE, featuredImage: { url: "http://example.com/x.jpg" } };
    expect(buildArticleNotification(insecure, OPTS)).not.toHaveProperty("chrome_web_image");
  });

  it("targets every subscriber over push, expires in 24 h, and groups by article", () => {
    const body = buildArticleNotification(ARTICLE, OPTS);
    expect(body.app_id).toBe(OPTS.appId);
    expect(body.target_channel).toBe("push");
    expect(body.included_segments).toEqual([PUSH_SEGMENT]);
    expect(body.ttl).toBe(PUSH_TTL_SECONDS);
    expect(PUSH_TTL_SECONDS).toBe(86_400);
    expect(body.web_push_topic).toBe("article-9381");
    expect(body.name).toBe("article:9381");
    expect(body.chrome_web_icon).toBe("https://www.mfmsport.ma/apple-icon.png");
  });

  it("refuses to build a notification without an Arabic title or slug", () => {
    expect(() => buildArticleNotification({ ...ARTICLE, title: "" }, OPTS)).toThrow(/title or slug/);
    expect(() => buildArticleNotification({ ...ARTICLE, slug: null }, OPTS)).toThrow(/title or slug/);
  });
});

function extractedSource(): string {
  return ARTICLE.body.root.children.map((p) => p.children[0].text).join(" ");
}

describe("articlePushIdempotencyKey", () => {
  const V5 = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it("is an RFC 9562 version-5 UUID, stable per article and distinct across articles", () => {
    const a = articlePushIdempotencyKey(9381);
    expect(a).toMatch(V5);
    expect(articlePushIdempotencyKey(9381)).toBe(a);
    expect(articlePushIdempotencyKey("9381")).toBe(a);
    expect(articlePushIdempotencyKey(9382)).not.toBe(a);
  });

  it("does not change across releases (changing it would re-send the last 30 days)", () => {
    expect(articlePushIdempotencyKey(1)).toBe(articlePushIdempotencyKey(1));
    // Pinned value cross-checked against Python: uuid.uuid5(UUID(namespace), "mfmsport:article-published:1").
    expect(articlePushIdempotencyKey(1)).toMatchInlineSnapshot(`"ddc16a02-9182-5fc3-966b-424d3a365051"`);
  });
});

describe("truncateAtWord", () => {
  it("returns short text unchanged and collapses whitespace", () => {
    expect(truncateAtWord("  كلمة   أخرى ", 50)).toBe("كلمة أخرى");
  });

  it("cuts long text at a space, inside the budget, without trailing punctuation", () => {
    const out = truncateAtWord("واحد اثنان، ثلاثة أربعة خمسة ستة سبعة", 20);
    expect(out.length).toBeLessThanOrEqual(20);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/[،,]…$/);
  });

  it("hard-cuts a single word longer than the budget instead of returning nothing", () => {
    const out = truncateAtWord("ا".repeat(300), 20);
    expect(out.length).toBe(20);
  });
});
