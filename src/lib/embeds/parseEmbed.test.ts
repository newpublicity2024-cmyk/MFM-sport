import { describe, it, expect } from "vitest";
import { parseEmbed, isUnresolvableShortLink } from "./parseEmbed";

describe("parseEmbed — empty and garbage input", () => {
  it.each([undefined, null, "", "   ", "not a link at all"])("returns null for %j", (input) => {
    expect(parseEmbed(input as string)).toBeNull();
  });
});

describe("parseEmbed — YouTube resolves to a canonical watch URL", () => {
  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
  ])("maps %s to the canonical watch URL", (url) => {
    expect(parseEmbed(url)).toEqual({
      platform: "youtube",
      id: "dQw4w9WgXcQ",
      canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
  });

  it("strips tracking params from the canonical URL", () => {
    const result = parseEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&si=xyz");
    expect(result).toEqual({
      platform: "youtube",
      id: "dQw4w9WgXcQ",
      canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
  });
});

describe("parseEmbed — Instagram preserves the matched content type", () => {
  it("resolves a /p/ post URL", () => {
    const result = parseEmbed("https://www.instagram.com/p/C1a2B3c4D5e/");
    expect(result).toEqual({
      platform: "instagram",
      id: "C1a2B3c4D5e",
      canonicalUrl: "https://www.instagram.com/p/C1a2B3c4D5e/",
    });
  });

  it("keeps /reel/ distinct from /p/ — the types are not interchangeable", () => {
    const result = parseEmbed("https://www.instagram.com/reel/C1a2B3c4D5e/");
    expect(result).toEqual({
      platform: "instagram",
      id: "C1a2B3c4D5e",
      canonicalUrl: "https://www.instagram.com/reel/C1a2B3c4D5e/",
    });
  });

  it("resolves m.instagram.com (mobile subdomain, previously missing from the allowlist)", () => {
    const result = parseEmbed("https://m.instagram.com/p/C1a2B3c4D5e/");
    expect(result).toEqual({
      platform: "instagram",
      id: "C1a2B3c4D5e",
      canonicalUrl: "https://www.instagram.com/p/C1a2B3c4D5e/",
    });
  });

  it("keeps /tv/ distinct as well — all three of p, reel and tv are matched, not normalised", () => {
    const result = parseEmbed("https://www.instagram.com/tv/C1a2B3c4D5e/");
    expect(result).toEqual({
      platform: "instagram",
      id: "C1a2B3c4D5e",
      canonicalUrl: "https://www.instagram.com/tv/C1a2B3c4D5e/",
    });
  });
});

describe("parseEmbed — X (formerly Twitter)", () => {
  it.each([
    "https://twitter.com/MFMSport/status/1234567890123456789",
    "https://x.com/MFMSport/status/1234567890123456789",
  ])("resolves %s to platform x with an x.com canonical URL", (url) => {
    expect(parseEmbed(url)).toEqual({
      platform: "x",
      id: "1234567890123456789",
      canonicalUrl: "https://x.com/MFMSport/status/1234567890123456789",
    });
  });

  it("accepts underscores in the handle (real Twitter/X handle format)", () => {
    const result = parseEmbed("https://x.com/MFM_Sport/status/123");
    expect(result).toEqual({
      platform: "x",
      id: "123",
      canonicalUrl: "https://x.com/MFM_Sport/status/123",
    });
  });
});

describe("parseEmbed — Facebook keeps the whole URL as its id", () => {
  it("resolves a post URL", () => {
    const result = parseEmbed("https://www.facebook.com/MFMSport/posts/123456789");
    expect(result).toEqual({
      platform: "facebook",
      id: "https://www.facebook.com/MFMSport/posts/123456789",
      canonicalUrl: "https://www.facebook.com/MFMSport/posts/123456789",
    });
  });

  it("resolves a video URL the same way — post vs. video plugin choice is a rendering concern, not a parsing one", () => {
    const result = parseEmbed("https://www.facebook.com/MFMSport/videos/123456789");
    expect(result).toEqual({
      platform: "facebook",
      id: "https://www.facebook.com/MFMSport/videos/123456789",
      canonicalUrl: "https://www.facebook.com/MFMSport/videos/123456789",
    });
  });

  it("accepts m.facebook.com (mobile subdomain in allowlist)", () => {
    const result = parseEmbed("https://m.facebook.com/MFMSport/posts/123");
    expect(result).toEqual({
      platform: "facebook",
      id: "https://m.facebook.com/MFMSport/posts/123",
      canonicalUrl: "https://m.facebook.com/MFMSport/posts/123",
    });
  });

  it("strips the query string and fragment from the canonical URL", () => {
    const result = parseEmbed("https://www.facebook.com/MFMSport/posts/123456789?ref=share#comment-1");
    expect(result).toEqual({
      platform: "facebook",
      id: "https://www.facebook.com/MFMSport/posts/123456789",
      canonicalUrl: "https://www.facebook.com/MFMSport/posts/123456789",
    });
  });
});

describe("parseEmbed — fb.watch is rejected, not guessed", () => {
  it("returns null for a fb.watch short link instead of guessing post vs. video", () => {
    expect(parseEmbed("https://fb.watch/abc123/")).toBeNull();
  });
});

describe("parseEmbed — TikTok is no longer a supported platform", () => {
  it("returns null for a TikTok video URL", () => {
    expect(parseEmbed("https://www.tiktok.com/@mfmsport/video/7412345678901234567")).toBeNull();
  });
});

describe("isUnresolvableShortLink", () => {
  it("is true for a fb.watch URL", () => {
    expect(isUnresolvableShortLink("https://fb.watch/abc123/")).toBe(true);
  });

  it("is false for a normal Facebook URL", () => {
    expect(isUnresolvableShortLink("https://www.facebook.com/MFMSport/posts/123456789")).toBe(false);
  });

  it("is false for empty input", () => {
    expect(isUnresolvableShortLink("")).toBe(false);
  });
});

describe("parseEmbed — pasted markup is reduced to a canonical URL, never stored as HTML", () => {
  it("extracts a tweet URL from an href inside a pasted blockquote", () => {
    const html = '<blockquote class="twitter-tweet"><a href="https://x.com/a/status/1"></a></blockquote>';
    expect(parseEmbed(html)).toEqual({
      platform: "x",
      id: "1",
      canonicalUrl: "https://x.com/a/status/1",
    });
  });

  it("extracts an Instagram URL from data-instgrm-permalink", () => {
    const html =
      '<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/p/ABC/"></blockquote>';
    expect(parseEmbed(html)).toEqual({
      platform: "instagram",
      id: "ABC",
      canonicalUrl: "https://www.instagram.com/p/ABC/",
    });
  });

  it("extracts a Facebook URL from data-href", () => {
    const html = '<div class="fb-video" data-href="https://www.facebook.com/MFMSport/videos/1"></div>';
    expect(parseEmbed(html)).toEqual({
      platform: "facebook",
      id: "https://www.facebook.com/MFMSport/videos/1",
      canonicalUrl: "https://www.facebook.com/MFMSport/videos/1",
    });
  });

  it("extracts a YouTube URL from an iframe src", () => {
    const html = '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>';
    expect(parseEmbed(html)).toEqual({
      platform: "youtube",
      id: "dQw4w9WgXcQ",
      canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
  });

  it("decodes an &amp;-escaped URL before parsing", () => {
    const html = '<a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ&amp;feature=share">شاهد</a>';
    expect(parseEmbed(html)).toEqual({
      platform: "youtube",
      id: "dQw4w9WgXcQ",
      canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
  });

  it("returns null when markup's only URL is off-platform", () => {
    expect(parseEmbed('<iframe src="https://evil.com/x"></iframe>')).toBeNull();
  });

  it("returns null for a bare iframe pointing off-platform", () => {
    expect(parseEmbed('<iframe src="https://example.com/x"></iframe>')).toBeNull();
  });

  it("returns null for an Instagram-marker blockquote with no href to extract", () => {
    expect(parseEmbed('<blockquote class="instagram-media"></blockquote>')).toBeNull();
  });

  it("returns null for a Facebook-marker div whose data-href isn't a real URL", () => {
    expect(parseEmbed('<div class="fb-video" data-href="x"></div>')).toBeNull();
  });

  it("returns null for TikTok markup now that TikTok is unsupported", () => {
    expect(parseEmbed('<blockquote class="tiktok-embed"></blockquote>')).toBeNull();
  });
});

describe("parseEmbed — security and URL parsing robustness", () => {
  it("rejects Twitter URLs with quote characters in the username (XSS attempt)", () => {
    expect(parseEmbed('https://twitter.com/a" onmouseover="alert(1)/status/123')).toBeNull();
  });

  it("rejects substring matches for YouTube (hostname must match exactly)", () => {
    expect(parseEmbed("https://evil.com/?x=youtube.com/watch?v=AAAAAAAAAAA")).toBeNull();
  });

  it("rejects substring matches for Facebook (hostname must match exactly)", () => {
    expect(parseEmbed("https://notfacebook.com/")).toBeNull();
  });

  it("rejects l.facebook.com (redirect host, not in allowlist)", () => {
    expect(parseEmbed("https://l.facebook.com/l.php?u=https%3A%2F%2Fyoutu.be%2FdQw4w9WgXcQ")).toBeNull();
  });

  it("rejects malformed URLs without throwing", () => {
    const malformed = ["https://", "http://[", "://invalid"];
    for (const url of malformed) {
      expect(() => parseEmbed(url)).not.toThrow();
      expect(parseEmbed(url)).toBeNull();
    }
  });
});
