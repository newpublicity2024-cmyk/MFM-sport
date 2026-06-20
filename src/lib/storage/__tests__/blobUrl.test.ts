import { describe, it, expect } from "vitest";
import { blobBaseUrl, blobFileURL } from "@/lib/storage/blobUrl";

// A token shaped like Vercel's: vercel_blob_rw_<storeId>_<secret>
const TOKEN = "vercel_blob_rw_AbCd1234_secretsecretsecret";
const BASE = "https://abcd1234.public.blob.vercel-storage.com";

describe("blobBaseUrl", () => {
  it("derives the public base URL from the RW token (store id lower-cased)", () => {
    expect(blobBaseUrl(TOKEN, undefined)).toBe(BASE);
  });

  it("prefers an explicit override and trims trailing slashes", () => {
    expect(blobBaseUrl(TOKEN, "https://cdn.example.com/")).toBe("https://cdn.example.com");
  });

  it("returns null when no token and no override (local dev)", () => {
    expect(blobBaseUrl(undefined, undefined)).toBeNull();
  });

  it("returns null for a malformed token", () => {
    expect(blobBaseUrl("not-a-real-token", undefined)).toBeNull();
  });
});

describe("blobFileURL", () => {
  it("builds a direct blob URL, encoding the filename", () => {
    expect(blobFileURL("photo.jpg", BASE)).toBe(`${BASE}/photo.jpg`);
  });

  it("URL-encodes Arabic filenames and spaces (the ones that 500'd)", () => {
    // "حكيم زياش" — Arabic with a space, no extension
    expect(blobFileURL("حكيم زياش", BASE)).toBe(
      `${BASE}/${encodeURIComponent("حكيم زياش")}`,
    );
    expect(blobFileURL("حكيم زياش", BASE)).toContain("%20");
  });

  it("encodes sized-variant filenames the same way", () => {
    expect(blobFileURL("photo-600x400.jpg", BASE)).toBe(`${BASE}/photo-600x400.jpg`);
  });

  it("returns null when no base is configured (caller falls back to /api/media)", () => {
    expect(blobFileURL("photo.jpg", null)).toBeNull();
  });

  it("returns null for an empty filename", () => {
    expect(blobFileURL("", BASE)).toBeNull();
  });
});
