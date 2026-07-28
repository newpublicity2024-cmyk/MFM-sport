import { describe, expect, it } from "vitest";
import { normalizeLegacyPath } from "../legacyPath";

// The real row from the production redirect map, and the form the platform
// actually delivers to middleware after its 308 normalisation.
const AS_STORED_BY_WORDPRESS =
  "/%d8%b9%d9%84%d8%a7%d8%a1-%d8%a7%d9%84%d9%85%d8%b3%d9%83%d9%8a%d9%86%d9%8a/";
const AS_RECEIVED_BY_MIDDLEWARE =
  "/%D8%B9%D9%84%D8%A7%D8%A1-%D8%A7%D9%84%D9%85%D8%B3%D9%83%D9%8A%D9%86%D9%8A";

describe("normalizeLegacyPath", () => {
  it("collapses the case+slash mismatch that broke every Arabic redirect", () => {
    // This is the whole bug: these two are the same URL, but an exact-match
    // lookup treated them as different, so all 200 redirects silently missed.
    expect(normalizeLegacyPath(AS_STORED_BY_WORDPRESS)).toBe(
      normalizeLegacyPath(AS_RECEIVED_BY_MIDDLEWARE),
    );
  });

  it("decodes to readable Arabic", () => {
    expect(normalizeLegacyPath(AS_RECEIVED_BY_MIDDLEWARE)).toBe("/علاء-المسكيني");
  });

  it("strips a trailing slash", () => {
    expect(normalizeLegacyPath("/some-post/")).toBe("/some-post");
    expect(normalizeLegacyPath("/some-post///")).toBe("/some-post");
  });

  it("is idempotent, so normalising an already-normal path is safe", () => {
    const once = normalizeLegacyPath(AS_STORED_BY_WORDPRESS);
    expect(normalizeLegacyPath(once)).toBe(once);
  });

  it("leaves plain ASCII paths alone", () => {
    expect(normalizeLegacyPath("/transfers")).toBe("/transfers");
  });

  it("survives a malformed escape sequence instead of throwing", () => {
    expect(normalizeLegacyPath("/%E0%A4%A")).toBe("/%E0%A4%A");
    expect(normalizeLegacyPath("/100%-fit/")).toBe("/100%-fit");
  });

  it("never returns an empty string", () => {
    expect(normalizeLegacyPath("/")).toBe("/");
  });
});
