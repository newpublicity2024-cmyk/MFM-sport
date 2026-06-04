import { describe, it, expect } from "vitest";
import { decodeSlug } from "../slug";

describe("decodeSlug", () => {
  it("decodes a percent-encoded Arabic slug to its stored decoded form", () => {
    // This is exactly what Next.js sometimes hands us as params.slug.
    const encoded =
      "%D8%A7%D9%84%D8%AC%D9%8A%D8%B4-%D8%A7%D9%84%D9%85%D9%84%D9%83%D9%8A";
    expect(decodeSlug(encoded)).toBe("الجيش-الملكي");
  });

  it("leaves an already-decoded Arabic slug unchanged (idempotent)", () => {
    const decoded = "الجيش-الملكي-يعلن-إصابة-الثنائي-الفحل";
    expect(decodeSlug(decoded)).toBe(decoded);
  });

  it("leaves a plain ASCII slug unchanged", () => {
    expect(decodeSlug("botola-pro-1")).toBe("botola-pro-1");
  });

  it("returns the raw input when it contains a malformed percent sequence", () => {
    // decodeURIComponent throws URIError here; we must not crash.
    expect(decodeSlug("100%-discount")).toBe("100%-discount");
  });
});
