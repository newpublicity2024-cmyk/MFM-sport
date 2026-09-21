import { describe, it, expect } from "vitest";
import {
  HOME_TITLE_AR,
  NAV_SECTIONS_AR,
  SITE_NAME,
  SITE_NAME_AR,
  SITE_SLOGAN_AR,
  homeJsonLd,
} from "@/lib/seo/siteIdentity";
import ar from "../../../../messages/ar.json";

const LATIN = /[A-Za-z]/;

describe("site identity for search engines", () => {
  it("the homepage title is the Arabic brand + the owner's slogan, with no Latin letters", () => {
    expect(HOME_TITLE_AR).toBe(`${SITE_NAME_AR} - ${SITE_SLOGAN_AR}`);
    expect(HOME_TITLE_AR).toContain("إم إف إم في قلب الحدث");
    expect(HOME_TITLE_AR).not.toMatch(LATIN);
    expect(HOME_TITLE_AR).not.toMatch(/Tout le sport|rien que/i);
    expect(HOME_TITLE_AR.length).toBeLessThanOrEqual(70);
  });

  it("declares WebSite + NewsMediaOrganization + navigation, with the Arabic name first and the Latin name as alternate", () => {
    const graph = (homeJsonLd() as { "@graph": Record<string, unknown>[] })["@graph"];
    const website = graph.find((n) => n["@type"] === "WebSite")!;
    const org = graph.find((n) => n["@type"] === "NewsMediaOrganization")!;
    const nav = graph.find((n) => n["@type"] === "ItemList")!;
    expect(website.name).toBe(SITE_NAME_AR);
    expect(website.alternateName).toContain(SITE_NAME);
    expect(website.url).toBe("https://www.mfmsport.ma");
    expect(org.slogan).toBe(SITE_SLOGAN_AR);
    expect((org.logo as { url: string }).url).toMatch(/^https:\/\/www\.mfmsport\.ma\/images\/.+\.png$/);
    expect((org.sameAs as string[]).some((u) => u.includes("youtube.com"))).toBe(true);
    const items = nav.itemListElement as { name: string; url: string; position: number }[];
    expect(items.map((i) => i.name)).toEqual(NAV_SECTIONS_AR.map((s) => s.name));
    expect(items.map((i) => i.url)).toEqual(NAV_SECTIONS_AR.map((s) => `https://www.mfmsport.ma${s.path}`));
    expect(items.map((i) => i.position)).toEqual([1, 2, 3, 4]);
  });

  it("every main section has its own Arabic description (the text Google shows under a sitelink)", () => {
    const descriptions = [
      ar.article.listingDescription,
      ar.competition.listingDescription,
      ar.match.listingDescription,
      ar.videos.listingDescription,
    ];
    expect(new Set(descriptions).size).toBe(4);
    descriptions.forEach((d) => {
      expect(d.length).toBeGreaterThan(60);
      expect(d).not.toMatch(/Moroccan Football News Portal/);
      expect(d).not.toMatch(LATIN);
    });
  });
});
