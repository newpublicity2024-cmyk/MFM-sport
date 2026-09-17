import { describe, it, expect, vi, beforeEach } from "vitest";

const getArticlesByTag = vi.fn();
vi.mock("@/lib/payload/queries", () => ({
  getArticlesByTag: (...args: unknown[]) => getArticlesByTag(...args),
}));

import { GET, HOME_LATEST_NEWS_LIMIT } from "@/app/api/home/latest-news/route";

beforeEach(() => getArticlesByTag.mockReset());

describe("GET /api/home/latest-news", () => {
  it("400s without a numeric tag id", async () => {
    expect((await GET(new Request("http://x/api/home/latest-news"))).status).toBe(400);
    expect((await GET(new Request("http://x/api/home/latest-news?tag=abc"))).status).toBe(400);
    expect(getArticlesByTag).not.toHaveBeenCalled();
  });

  it("returns the tag's newest articles as slim cards, in the requested locale", async () => {
    getArticlesByTag.mockResolvedValue({
      docs: [
        {
          id: 7,
          title: "عنوان",
          slug: "slug-1",
          publishedAt: "2026-09-17T10:00:00.000Z",
          categories: [{ name: "البطولة", slug: "botola" }],
          body: { root: {} },
        },
      ],
    });
    const res = await GET(new Request("http://x/api/home/latest-news?tag=490&locale=ar"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { articles: Record<string, unknown>[] };
    expect(getArticlesByTag).toHaveBeenCalledWith(490, "ar", 1, HOME_LATEST_NEWS_LIMIT);
    expect(json.articles).toHaveLength(1);
    expect(json.articles[0]).toMatchObject({ id: "7", title: "عنوان", slug: "slug-1", categoryName: "البطولة" });
    // Never the heavy body.
    expect(json.articles[0]).not.toHaveProperty("body");
  });

  it("falls back to Arabic for an unknown locale", async () => {
    getArticlesByTag.mockResolvedValue({ docs: [] });
    await GET(new Request("http://x/api/home/latest-news?tag=3&locale=de"));
    expect(getArticlesByTag).toHaveBeenCalledWith(3, "ar", 1, HOME_LATEST_NEWS_LIMIT);
  });
});
