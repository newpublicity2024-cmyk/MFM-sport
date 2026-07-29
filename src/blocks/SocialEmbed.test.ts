import { describe, it, expect } from "vitest";
import { EMBED_FAILURE_MESSAGES } from "@/lib/embeds/messages";
import { SocialEmbedBlock, normalizeSocialEmbedSource, validateSocialEmbedSource } from "./SocialEmbed";

describe("SocialEmbedBlock — shape", () => {
  it("has the slug and interfaceName the converter map and generated types depend on", () => {
    expect(SocialEmbedBlock.slug).toBe("socialEmbed");
    expect(SocialEmbedBlock.interfaceName).toBe("SocialEmbedBlock");
  });

  it("declares source (required) and caption (optional), neither localized", () => {
    const source = SocialEmbedBlock.fields.find((f) => "name" in f && f.name === "source");
    const caption = SocialEmbedBlock.fields.find((f) => "name" in f && f.name === "caption");
    expect(source).toBeDefined();
    expect(caption).toBeDefined();
    // @ts-expect-error - narrowed by the find() above at runtime
    expect(source.required).toBe(true);
    // @ts-expect-error - localized must be absent/false: body is already localized (see brief §3)
    expect(source.localized).toBeFalsy();
    // @ts-expect-error - localized must be absent/false
    expect(caption.localized).toBeFalsy();
  });
});

describe("validateSocialEmbedSource — accepts a good URL", () => {
  it("returns true for a clean, resolvable URL", () => {
    expect(validateSocialEmbedSource("https://x.com/MFMSport/status/1234567890123456789")).toBe(true);
  });

  it("returns true for a messy but resolvable URL (tracking params, wrong-but-allowed host)", () => {
    expect(
      validateSocialEmbedSource(
        "https://twitter.com/MFMSport/status/1234567890123456789?s=20&t=abc",
      ),
    ).toBe(true);
  });
});

describe("validateSocialEmbedSource — rejects each EmbedFailure reason with the matching Arabic message", () => {
  it("empty", () => {
    expect(validateSocialEmbedSource("")).toBe(EMBED_FAILURE_MESSAGES.empty.ar);
    expect(validateSocialEmbedSource(undefined)).toBe(EMBED_FAILURE_MESSAGES.empty.ar);
  });

  it("unsupported", () => {
    expect(validateSocialEmbedSource("https://www.tiktok.com/@mfmsport/video/7412345678901234567")).toBe(
      EMBED_FAILURE_MESSAGES.unsupported.ar,
    );
  });

  it("short-link", () => {
    expect(validateSocialEmbedSource("https://fb.watch/abc123/")).toBe(
      EMBED_FAILURE_MESSAGES["short-link"].ar,
    );
  });

  it("multiple", () => {
    const html =
      '<a href="https://x.com/a/status/1">one</a> <a href="https://x.com/b/status/2">two</a>';
    expect(validateSocialEmbedSource(html)).toBe(EMBED_FAILURE_MESSAGES.multiple.ar);
  });
});

describe("normalizeSocialEmbedSource — reduces a messy paste to the canonical URL (the mechanism under test in Task 4 §1)", () => {
  it("normalizes a twitter.com URL with tracking params to the canonical x.com form", () => {
    expect(
      normalizeSocialEmbedSource(
        "https://twitter.com/MFMSport/status/1234567890123456789?s=20&t=abc",
      ),
    ).toBe("https://x.com/MFMSport/status/1234567890123456789");
  });

  it("normalizes pasted markup down to the bare canonical URL — the HTML itself must never survive", () => {
    const html = '<blockquote class="twitter-tweet"><a href="https://x.com/a/status/1"></a></blockquote>';
    const normalized = normalizeSocialEmbedSource(html);
    expect(normalized).toBe("https://x.com/a/status/1");
    expect(String(normalized)).not.toContain("<");
  });

  it("leaves an unresolvable value unchanged so validate() still reports why", () => {
    expect(normalizeSocialEmbedSource("not a link")).toBe("not a link");
    expect(normalizeSocialEmbedSource("")).toBe("");
  });
});
