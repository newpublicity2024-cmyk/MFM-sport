// src/lib/payload/__tests__/ads.test.ts
import { describe, it, expect } from "vitest";
import type { Ad } from "@/payload-types";
import { groupAds } from "@/lib/payload/ads";

// Minimal fake Payload docs (image populated to depth 1). Cast to Ad — these
// stubs intentionally omit timestamp fields groupAds never reads.
const doc = (over: Record<string, unknown>) =>
  ({
    id: 1,
    name: "Ad",
    type: "image",
    placement: "top-banner",
    linkUrl: null,
    image: { url: "https://blob/x.jpg", alt: "alt text", sizes: {} },
    ...over,
  }) as unknown as Ad;

describe("groupAds", () => {
  it("returns an entry for every placement, empty when no docs", () => {
    const g = groupAds([]);
    expect(Object.keys(g).sort()).toEqual(
      [
        "article-sidebar",
        "hero-news",
        "news-card",
        "news-videos",
        "top-banner",
        "videos-matches",
      ].sort(),
    );
    expect(g["top-banner"]).toEqual([]);
  });

  it("maps an image doc into an image AdItem under its placement", () => {
    const g = groupAds([doc({ id: 7, placement: "hero-news", linkUrl: "https://ex.com" })]);
    expect(g["hero-news"]).toEqual([
      {
        id: 7,
        type: "image",
        imageUrl: "https://blob/x.jpg",
        alt: "alt text",
        linkUrl: "https://ex.com",
      },
    ]);
    expect(g["top-banner"]).toEqual([]);
  });

  it("prefers media alt, falls back to the ad name", () => {
    const g = groupAds([
      doc({ id: 2, image: { url: "https://blob/y.jpg", alt: "", sizes: {} }, name: "Fallback" }),
    ]);
    expect(g["top-banner"][0].alt).toBe("Fallback");
  });

  it("skips image docs whose image has no usable URL", () => {
    const g = groupAds([doc({ id: 3, image: null })]);
    expect(g["top-banner"]).toEqual([]);
  });

  it("treats a doc with no type as an image ad (legacy rows)", () => {
    const g = groupAds([doc({ id: 11, type: undefined })]);
    expect(g["top-banner"][0].type).toBe("image");
  });

  it("maps a tag ad into a tag AdItem (no image needed)", () => {
    const g = groupAds([
      doc({ id: 9, type: "tag", embedCode: "<ins>x</ins>", image: null, placement: "news-card" }),
    ]);
    expect(g["news-card"]).toEqual([{ id: 9, type: "tag", embedCode: "<ins>x</ins>" }]);
  });

  it("skips a tag ad whose embed code is blank", () => {
    const g = groupAds([doc({ id: 10, type: "tag", embedCode: "   ", image: null })]);
    expect(g["top-banner"]).toEqual([]);
  });
});
