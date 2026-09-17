import { describe, expect, it } from "vitest";
import { hasNonAscii, isUnsafeIsrPath, onDemandOnly } from "../isr";

describe("onDemandOnly", () => {
  it("lists nothing, so every param is generated on demand", () => {
    expect(onDemandOnly()).toEqual([]);
  });
});

describe("hasNonAscii", () => {
  it("is false for plain ASCII slugs", () => {
    expect(hasNonAscii("/ar/club/rs-berkane")).toBe(false);
    expect(hasNonAscii("/ar/matches/1550109")).toBe(false);
  });

  it("is true for raw Arabic and for percent-encoded Arabic", () => {
    expect(hasNonAscii("/ar/club/الرجاء")).toBe(true);
    expect(hasNonAscii("/ar/club/%D8%A7%D9%84%D8%B1%D8%AC%D8%A7%D8%A1")).toBe(true);
  });

  it("does not throw on a malformed escape", () => {
    expect(hasNonAscii("/ar/club/%E0%A4%A")).toBe(false);
  });
});

describe("isUnsafeIsrPath", () => {
  it("flags non-ASCII on every ISR route shape", () => {
    for (const p of [
      "/ar/club/%D8%A7",
      "/ar/competition/الدوري",
      "/ar/author/%D9%85",
      "/ar/author/%D9%85/page/2",
      "/ar/matches/%D9%A1",
      "/ar/articles/page/%D9%A2",
    ]) {
      expect(isUnsafeIsrPath(p), p).toBe(true);
    }
  });

  it("lets ASCII slugs through on those routes", () => {
    for (const p of [
      "/ar/club/rs-berkane",
      "/ar/competition/botola-pro-1",
      "/ar/author/yassine-elbassri",
      "/ar/author/yassine-elbassri/page/2",
      "/ar/matches/1550109",
      "/ar/articles/page/2",
    ]) {
      expect(isUnsafeIsrPath(p), p).toBe(false);
    }
  });

  // These routes are dynamic on purpose because their slugs are Arabic; the
  // guard must never touch them or it would 404 the whole archive.
  it("never matches the article, tag or category slug routes", () => {
    for (const p of [
      "/ar/articles/%D8%A7%D9%84%D9%85%D8%BA%D8%B1%D8%A8",
      "/ar/tag/مزراوي",
      "/ar/category/%D9%83%D8%A3%D8%B3",
      "/ar/tag/%D9%85/page/2",
      "/ar/category/%D9%83/page/3",
    ]) {
      expect(isUnsafeIsrPath(p), p).toBe(false);
    }
  });

  it("ignores the static listing pages themselves", () => {
    expect(isUnsafeIsrPath("/ar/club")).toBe(false);
    expect(isUnsafeIsrPath("/ar/articles")).toBe(false);
  });
});
