import { describe, it, expect } from "vitest";
import { instagramTransport } from "./instagramTransport";

describe("instagramTransport", () => {
  it("builds the /embed src for a /p/ (post) canonical URL", () => {
    const result = instagramTransport("https://www.instagram.com/p/ABC123/");
    expect(result?.src).toBe("https://www.instagram.com/p/ABC123/embed");
  });

  it("builds the /embed src for a /reel/ canonical URL", () => {
    const result = instagramTransport("https://www.instagram.com/reel/XYZ789/");
    expect(result?.src).toBe("https://www.instagram.com/reel/XYZ789/embed");
  });

  // A2: reels are 9:16, posts are roughly 1:1 to 4:5. This is not redundant even
  // though both /p/ and /reel/ fetch fine transport-wise — see the comment in
  // instagramTransport.ts. One fixed ratio across both produces either heavy
  // letterboxing or a resize-after-load, which is CLS.
  it("gives reels a 9:16 aspect ratio", () => {
    const result = instagramTransport("https://www.instagram.com/reel/XYZ789/");
    expect(result?.aspectRatio).toBe("9 / 16");
  });

  it("gives posts a taller-than-wide aspect ratio distinct from reels", () => {
    const result = instagramTransport("https://www.instagram.com/p/ABC123/");
    expect(result?.aspectRatio).toBe("4 / 5");
    expect(result?.aspectRatio).not.toBe("9 / 16");
  });

  it("treats /tv/ (legacy IGTV) like a post, not a reel", () => {
    const result = instagramTransport("https://www.instagram.com/tv/LEGACY1/");
    expect(result?.aspectRatio).toBe("4 / 5");
  });

  it("handles a canonical URL with no trailing slash", () => {
    const result = instagramTransport("https://www.instagram.com/p/ABC123");
    expect(result?.src).toBe("https://www.instagram.com/p/ABC123/embed");
  });

  it("never throws and returns null for a malformed URL", () => {
    expect(() => instagramTransport("not-a-url")).not.toThrow();
    expect(instagramTransport("not-a-url")).toBeNull();
  });

  it("never throws and returns null for an empty string", () => {
    expect(instagramTransport("")).toBeNull();
  });
});
