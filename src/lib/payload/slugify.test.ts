import { describe, it, expect } from "vitest";
import { slugify, slugifyWithFallback } from "./slugify";

describe("slugify", () => {
  it("lowercases, strips diacritics, hyphenates spaces", () => {
    expect(slugify("L'Armée Royale gagne")).toBe("larmee-royale-gagne");
  });
  it("collapses repeats and trims edge hyphens", () => {
    expect(slugify("  Royal   Army!! ")).toBe("royal-army");
  });
  it("returns empty string for all-Arabic input", () => {
    expect(slugify("الجيش الملكي")).toBe("");
  });
});

describe("slugifyWithFallback", () => {
  it("uses the slug when non-empty", () => {
    expect(slugifyWithFallback("Royal Army", "123")).toBe("royal-army");
  });
  it("falls back when the slug is empty", () => {
    expect(slugifyWithFallback("الجيش الملكي", "123")).toBe("123");
  });
});
