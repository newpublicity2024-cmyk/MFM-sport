import { describe, it, expect } from "vitest";
import { facebookTransport } from "./facebookTransport";
import { parseEmbed } from "@/lib/embeds/parseEmbed";

describe("facebookTransport", () => {
  it("uses the video.php plugin for a /videos/ URL", () => {
    const result = facebookTransport("https://www.facebook.com/MFMSport/videos/1234567890");
    expect(result?.src.startsWith("https://www.facebook.com/plugins/video.php?")).toBe(true);
  });

  it("uses the video.php plugin for a bare /watch/ URL (facebookTransport in isolation)", () => {
    const result = facebookTransport("https://www.facebook.com/watch/");
    expect(result?.src.startsWith("https://www.facebook.com/plugins/video.php?")).toBe(true);
  });

  // Fix round 1, Finding 2: before the parseEmbed.ts fix, a pasted
  // /watch/?v=<id> link lost its id upstream (canonicalUrl became the bare
  // Watch homepage), so this branch was reachable only by hand-constructing a
  // canonicalUrl that parseEmbed could never actually produce -- dead by
  // construction. This exercises parseEmbed -> facebookTransport end to end on
  // a realistic pasted link, proving the branch is reachable through the real
  // flow now.
  it("resolves a real /watch/?v=<id> link end-to-end through parseEmbed into the video.php plugin", () => {
    const parsed = parseEmbed("https://www.facebook.com/watch/?v=1234567890");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.embed.canonicalUrl).toBe("https://www.facebook.com/watch/?v=1234567890");

    const result = facebookTransport(parsed.embed.canonicalUrl);
    expect(result?.src.startsWith("https://www.facebook.com/plugins/video.php?")).toBe(true);
    const src = new URL(result!.src);
    expect(src.searchParams.get("href")).toBe("https://www.facebook.com/watch/?v=1234567890");
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
