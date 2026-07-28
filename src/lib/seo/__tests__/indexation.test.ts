import { describe, expect, it } from "vitest";
import { isIndexable, robotsFor, RELEASED_ARCHIVE_YEARS, RELEASE_ARCHIVE_BRIEF } from "../indexation";

describe("isIndexable", () => {
  it("always indexes native editorial articles, whatever their date", () => {
    expect(isIndexable({ seoTier: "editorial", publishedAt: "2019-04-01" })).toBe(true);
    expect(isIndexable({ seoTier: "editorial", publishedAt: "2026-07-01" })).toBe(true);
  });

  it("treats a missing tier as editorial, so pre-existing rows keep indexing", () => {
    expect(isIndexable({ publishedAt: "2026-07-01" })).toBe(true);
    expect(isIndexable({ seoTier: null, publishedAt: "2019-01-01" })).toBe(true);
  });

  it("indexes archive-full only for released years", () => {
    for (const y of RELEASED_ARCHIVE_YEARS) {
      expect(isIndexable({ seoTier: "archive-full", publishedAt: `${y}-06-01` })).toBe(true);
    }
    expect(isIndexable({ seoTier: "archive-full", publishedAt: "2021-06-01" })).toBe(false);
    expect(isIndexable({ seoTier: "archive-full", publishedAt: "2022-06-01" })).toBe(false);
  });

  it("holds archive-brief back regardless of year", () => {
    const held = !RELEASE_ARCHIVE_BRIEF;
    if (held) {
      expect(isIndexable({ seoTier: "archive-brief", publishedAt: "2026-07-01" })).toBe(false);
      expect(isIndexable({ seoTier: "archive-brief", publishedAt: "2021-07-01" })).toBe(false);
    }
  });

  it("does not index an archive article with no publish date", () => {
    expect(isIndexable({ seoTier: "archive-full", publishedAt: null })).toBe(false);
  });

  it("reads the year in UTC, so a New Year's Eve timestamp cannot drift a year", () => {
    // 2023-12-31T23:00Z is still 2023 in UTC even where local time is already 2024.
    expect(isIndexable({ seoTier: "archive-full", publishedAt: "2023-12-31T23:00:00Z" })).toBe(false);
    expect(isIndexable({ seoTier: "archive-full", publishedAt: "2024-01-01T00:30:00Z" })).toBe(true);
  });
});

describe("robotsFor", () => {
  it("returns undefined when indexable, so no robots tag is emitted", () => {
    expect(robotsFor({ seoTier: "editorial", publishedAt: "2026-01-01" })).toBeUndefined();
  });

  it("returns noindex,follow when held back, so links are still crawled", () => {
    expect(robotsFor({ seoTier: "archive-full", publishedAt: "2021-01-01" })).toEqual({
      index: false,
      follow: true,
    });
  });
});
