import { describe, it, expect } from "vitest";
import {
  getEntityLogoUrl,
  getArticleHeroUrl,
  formatDate,
  formatTime,
  formatKickoffDateTime,
  SITE_TIME_ZONE,
} from "@/lib/utils";

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

describe("formatDate / formatTime — Africa/Casablanca", () => {
  it("shows a September kickoff at UTC+1, not the UTC instant", () => {
    // Production showed 16:30 for this fixture; the real kickoff was 17:30.
    expect(formatTime("2026-09-07T16:30:00+00:00", "ar")).toBe("17:30");
  });

  it("shows a Ramadan-window kickoff at UTC+0 (Morocco suspends DST)", () => {
    // 1 March 2026 falls inside Ramadan 1447; IANA carries the switch.
    expect(formatTime("2026-03-01T20:00:00Z", "ar")).toBe("20:00");
  });

  it("moves the date across midnight with the zone", () => {
    expect(formatDate("2026-09-07T23:30:00Z", "ar")).toContain("8");
    expect(formatDate("2026-09-07T23:30:00Z", "ar")).not.toContain("7 ");
  });

  it("uses Latin digits for ar-MA", () => {
    expect(formatTime("2026-09-07T16:30:00Z", "ar")).toMatch(/^[0-9]{2}:[0-9]{2}$/);
    expect(formatDate("2026-09-07T16:30:00Z", "ar")).toMatch(/2026/);
  });

  it("formatKickoffDateTime carries weekday, date and time in one string", () => {
    const s = formatKickoffDateTime("2026-09-07T16:30:00Z", "ar");
    expect(s).toContain("17:30");
    expect(s).toContain("2026");
    expect(s).toMatch(/الاثنين|الإثنين/);
  });

  it("exports the zone for other formatters to share", () => {
    expect(SITE_TIME_ZONE).toBe("Africa/Casablanca");
  });
});
