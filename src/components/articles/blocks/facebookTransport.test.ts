import { describe, it, expect } from "vitest";
import { facebookTransport } from "./facebookTransport";

describe("facebookTransport", () => {
  it("uses the video.php plugin for a /videos/ URL", () => {
    const result = facebookTransport("https://www.facebook.com/MFMSport/videos/1234567890");
    expect(result?.src.startsWith("https://www.facebook.com/plugins/video.php?")).toBe(true);
  });

  it("uses the video.php plugin for a /watch/ URL", () => {
    const result = facebookTransport("https://www.facebook.com/watch/");
    expect(result?.src.startsWith("https://www.facebook.com/plugins/video.php?")).toBe(true);
  });

  it("uses the post.php plugin for a /posts/ URL", () => {
    const result = facebookTransport("https://www.facebook.com/MFMSport/posts/9876543210");
    expect(result?.src.startsWith("https://www.facebook.com/plugins/post.php?")).toBe(true);
  });

  it("encodes the canonical URL into the href param", () => {
    const canonicalUrl = "https://www.facebook.com/MFMSport/posts/9876543210";
    const result = facebookTransport(canonicalUrl);
    const src = new URL(result!.src);
    expect(src.searchParams.get("href")).toBe(canonicalUrl);
  });

  it("gives videos a 16:9 aspect ratio", () => {
    const result = facebookTransport("https://www.facebook.com/MFMSport/videos/1234567890");
    expect(result?.aspectRatio).toBe("16 / 9");
  });

  it("gives posts a taller aspect ratio distinct from videos", () => {
    const result = facebookTransport("https://www.facebook.com/MFMSport/posts/9876543210");
    expect(result?.aspectRatio).toBe("3 / 4");
    expect(result?.aspectRatio).not.toBe("16 / 9");
  });

  it("never throws and returns null for a malformed URL", () => {
    expect(() => facebookTransport("not-a-url")).not.toThrow();
    expect(facebookTransport("not-a-url")).toBeNull();
  });

  it("never throws and returns null for an empty string", () => {
    expect(facebookTransport("")).toBeNull();
  });
});
