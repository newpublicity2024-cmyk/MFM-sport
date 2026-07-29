import { describe, it, expect } from "vitest";
import { parseEmbed } from "./parseEmbed";

describe("parseEmbed — empty and garbage input", () => {
  it.each([undefined, null, "", "   ", "not a link at all"])("returns invalid for %j", (input) => {
    expect(parseEmbed(input as string).kind).toBe("invalid");
  });
});

describe("parseEmbed — YouTube links become iframes", () => {
  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
  ])("maps %s to the nocookie embed", (url) => {
    const result = parseEmbed(url);
    expect(result.kind).toBe("iframe");
    if (result.kind !== "iframe") throw new Error("unreachable");
    expect(result.src).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(result.ratio).toBeCloseTo(16 / 9);
  });
});

describe("parseEmbed — other platform links", () => {
  it("maps an Instagram post to the /embed path", () => {
    const result = parseEmbed("https://www.instagram.com/p/C1a2B3c4D5e/");
    expect(result).toMatchObject({
      kind: "iframe",
      src: "https://www.instagram.com/p/C1a2B3c4D5e/embed",
    });
  });

  it("keeps the reel path for an Instagram reel", () => {
    const result = parseEmbed("https://www.instagram.com/reel/C1a2B3c4D5e/");
    expect(result).toMatchObject({
      kind: "iframe",
      src: "https://www.instagram.com/reel/C1a2B3c4D5e/embed",
    });
  });

  it("maps a TikTok video to the v2 embed", () => {
    const result = parseEmbed("https://www.tiktok.com/@mfmsport/video/7412345678901234567");
    expect(result).toMatchObject({
      kind: "iframe",
      src: "https://www.tiktok.com/embed/v2/7412345678901234567",
    });
  });

  it("wraps a Facebook post URL in the post plugin", () => {
    const result = parseEmbed("https://www.facebook.com/MFMSport/posts/123456789");
    expect(result.kind).toBe("iframe");
    if (result.kind !== "iframe") throw new Error("unreachable");
    expect(result.src).toContain("facebook.com/plugins/post.php");
    expect(result.src).toContain(encodeURIComponent("https://www.facebook.com/MFMSport/posts/123456789"));
  });

  it("uses the video plugin for a Facebook video URL", () => {
    const result = parseEmbed("https://www.facebook.com/MFMSport/videos/123456789");
    expect(result.kind).toBe("iframe");
    if (result.kind !== "iframe") throw new Error("unreachable");
    expect(result.src).toContain("facebook.com/plugins/video.php");
  });
});

describe("parseEmbed — X/Twitter has no iframe endpoint", () => {
  it.each([
    "https://twitter.com/MFMSport/status/1234567890123456789",
    "https://x.com/MFMSport/status/1234567890123456789",
  ])("returns a script blockquote for %s", (url) => {
    const result = parseEmbed(url);
    expect(result.kind).toBe("script");
    if (result.kind !== "script") throw new Error("unreachable");
    expect(result.platform).toBe("twitter");
    expect(result.html).toContain('class="twitter-tweet"');
    expect(result.html).toContain("/status/1234567890123456789");
  });
});

describe("parseEmbed — pasted markup passes through", () => {
  it("detects the twitter SDK from a pasted blockquote", () => {
    const html = '<blockquote class="twitter-tweet"><a href="https://x.com/a/status/1"></a></blockquote>';
    const result = parseEmbed(html);
    expect(result).toMatchObject({ kind: "html", platforms: ["twitter"] });
    if (result.kind !== "html") throw new Error("unreachable");
    expect(result.html).toBe(html);
  });

  it("detects instagram, facebook and tiktok markers", () => {
    expect(parseEmbed('<blockquote class="instagram-media"></blockquote>')).toMatchObject({ platforms: ["instagram"] });
    expect(parseEmbed('<div class="fb-video" data-href="x"></div>')).toMatchObject({ platforms: ["facebook"] });
    expect(parseEmbed('<blockquote class="tiktok-embed"></blockquote>')).toMatchObject({ platforms: ["tiktok"] });
  });

  it("requires no SDK for a bare iframe", () => {
    const result = parseEmbed('<iframe src="https://example.com/x"></iframe>');
    expect(result).toMatchObject({ kind: "html", platforms: [] });
  });

  it("prefers the markup branch when input contains both a tag and a URL", () => {
    const result = parseEmbed('<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>');
    expect(result.kind).toBe("html");
  });
});

describe("parseEmbed — security and URL parsing robustness", () => {
  it("rejects Twitter URLs with quote characters in the username (XSS attempt)", () => {
    const result = parseEmbed('https://twitter.com/a" onmouseover="alert(1)/status/123');
    expect(result.kind).toBe("invalid");
  });

  it("rejects substring matches for YouTube (hostname must match exactly)", () => {
    const result = parseEmbed("https://evil.com/?x=youtube.com/watch?v=AAAAAAAAAAA");
    expect(result.kind).toBe("invalid");
  });

  it("rejects substring matches for Facebook (hostname must match exactly)", () => {
    const result = parseEmbed("https://notfacebook.com/");
    expect(result.kind).toBe("invalid");
  });

  it("rejects l.facebook.com (redirect host, not in allowlist)", () => {
    const result = parseEmbed("https://l.facebook.com/l.php?u=https%3A%2F%2Fyoutu.be%2FdQw4w9WgXcQ");
    expect(result.kind).toBe("invalid");
  });

  it("accepts m.facebook.com (mobile subdomain in allowlist)", () => {
    const result = parseEmbed("https://m.facebook.com/MFMSport/posts/123");
    expect(result.kind).toBe("iframe");
    if (result.kind !== "iframe") throw new Error("unreachable");
    expect(result.src).toContain("facebook.com/plugins/post.php");
  });

  it("accepts Twitter handles with underscores (real Twitter handle format)", () => {
    const result = parseEmbed("https://x.com/MFM_Sport/status/123");
    expect(result.kind).toBe("script");
    if (result.kind !== "script") throw new Error("unreachable");
    expect(result.platform).toBe("twitter");
  });

  it("rejects malformed URLs without throwing", () => {
    const malformed = [
      "https://",
      "http://[",
      "://invalid",
    ];
    for (const url of malformed) {
      expect(() => parseEmbed(url)).not.toThrow();
      expect(parseEmbed(url).kind).toBe("invalid");
    }
  });
});
