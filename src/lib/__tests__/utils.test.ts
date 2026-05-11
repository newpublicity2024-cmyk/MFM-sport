import { describe, it, expect } from "vitest";
import { getEntityLogoUrl, getArticleHeroUrl } from "@/lib/utils";

describe("getEntityLogoUrl", () => {
  it("returns the upload's url when a Media object is set", () => {
    const entity = { logo: { url: "/api/media/file/wydad.png" }, logoUrl: null };
    expect(getEntityLogoUrl(entity)).toBe("/api/media/file/wydad.png");
  });

  it("falls back to logoUrl when logo is empty", () => {
    const entity = { logo: null, logoUrl: "https://media.api-sports.io/football/teams/965.png" };
    expect(getEntityLogoUrl(entity)).toBe("https://media.api-sports.io/football/teams/965.png");
  });

  it("prefers upload over logoUrl when both are set", () => {
    const entity = { logo: { url: "/api/media/file/x.png" }, logoUrl: "https://example.com/y.png" };
    expect(getEntityLogoUrl(entity)).toBe("/api/media/file/x.png");
  });

  it("returns null when neither is set", () => {
    expect(getEntityLogoUrl({ logo: null, logoUrl: null })).toBeNull();
    expect(getEntityLogoUrl({})).toBeNull();
  });

  it("treats logo as id (not object) by ignoring it and using logoUrl", () => {
    const entity = { logo: 42, logoUrl: "https://example.com/x.png" };
    expect(getEntityLogoUrl(entity)).toBe("https://example.com/x.png");
  });
});

describe("getArticleHeroUrl", () => {
  it("returns sized hero from upload when present", () => {
    const article = {
      featuredImage: { url: "/orig.jpg", sizes: { hero: { url: "/orig-1200.jpg" } } },
      featuredImageUrl: null,
    };
    expect(getArticleHeroUrl(article)).toBe("/orig-1200.jpg");
  });

  it("falls back to featuredImageUrl", () => {
    expect(
      getArticleHeroUrl({ featuredImage: null, featuredImageUrl: "/images/seed/articles/01.jpg" }),
    ).toBe("/images/seed/articles/01.jpg");
  });

  it("returns null when neither is set", () => {
    expect(getArticleHeroUrl({})).toBeNull();
  });
});
