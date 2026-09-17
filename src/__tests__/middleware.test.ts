import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// next-intl's middleware is the fallthrough: it answers 307 → /ar/<path> for
// any unprefixed path. Stub it so the tests exercise only this file's rules.
vi.mock("next-intl/middleware", () => ({
  default: () => (request: NextRequest) => {
    const p = request.nextUrl.pathname;
    if (p.startsWith("/ar")) return NextResponse.next();
    return NextResponse.redirect(new URL(`/ar${p === "/" ? "" : p}`, request.url), 307);
  },
}));

import middleware from "@/middleware";

const req = (path: string) => new NextRequest(new URL(path, "https://www.mfmsport.ma"));
const rewriteTarget = (res: Response) => res.headers.get("x-middleware-rewrite");

describe("middleware", () => {
  beforeEach(() => {
    // Redirect map lookup: a miss unless a test says otherwise.
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ to: null }),
    } as unknown as Response);
  });

  it("308s the root and section paths to their /ar equivalent", async () => {
    const root = await middleware(req("/"));
    expect(root.status).toBe(308);
    expect(root.headers.get("location")).toBe("https://www.mfmsport.ma/ar");

    const videos = await middleware(req("/videos"));
    expect(videos.status).toBe(308);
    expect(videos.headers.get("location")).toBe("https://www.mfmsport.ma/ar/videos");
  });

  it("follows a redirect-map hit with its stored status", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ to: "/ar/articles/x", statusCode: "301" }),
    } as unknown as Response);
    const res = await middleware(req("/%D8%B9%D9%84%D8%A7%D8%A1"));
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("https://www.mfmsport.ma/ar/articles/x");
  });

  // Before: miss → 308 to /ar/<legacy> → 404. That hop was ~200K of the
  // month's 517K 308s and told Google "moved" about pages that are gone.
  it("answers a legacy path that misses the map with a direct 404 rewrite", async () => {
    const res = await middleware(req("/%D8%B9%D9%84%D8%A7%D8%A1-%D8%A7%D9%84%D9%85"));
    expect(res.status).toBe(200); // a rewrite; the not-found route sets the 404
    expect(rewriteTarget(res)).toBe("https://www.mfmsport.ma/ar/__not-found");
  });

  it("still 308s an unprefixed section path even when the map misses", async () => {
    const res = await middleware(req("/matches"));
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("https://www.mfmsport.ma/ar/matches");
  });

  it("301s retired locales onto /ar", async () => {
    const res = await middleware(req("/fr/articles"));
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("https://www.mfmsport.ma/ar/articles");
  });

  // ISR routes must never render a non-ASCII path — lib/seo/isr.ts.
  it("rewrites a non-ASCII path on an ISR route to the plain 404", async () => {
    const res = await middleware(req("/ar/club/%D8%A7%D9%84%D8%B1%D8%AC%D8%A7%D8%A1"));
    expect(rewriteTarget(res)).toBe("https://www.mfmsport.ma/ar/__not-found");
  });

  it("leaves Arabic article, tag and category paths alone", async () => {
    for (const p of ["/ar/articles/%D8%A7%D9%84%D9%85", "/ar/tag/%D9%85", "/ar/category/%D9%83"]) {
      const res = await middleware(req(p));
      expect(rewriteTarget(res), p).toBeNull();
      expect(res.status, p).toBe(200);
    }
  });

  it("passes admin and api through untouched", async () => {
    for (const p of ["/admin/collections/articles", "/api/redirects?from=x"]) {
      const res = await middleware(req(p));
      expect(res.status).toBe(200);
      expect(rewriteTarget(res)).toBeNull();
    }
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
