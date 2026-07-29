import { describe, it, expect } from "vitest";
import { tierForLexicalBody } from "../blockAwareTiering";
import { BRIEF_THRESHOLD, tierFor } from "../wpArchive";

function paragraph(text: string) {
  return { type: "paragraph", children: [{ type: "text", text }] };
}

function root(children: unknown[]) {
  return { root: { type: "root", children } };
}

function longText(length: number): string {
  return "أ".repeat(length);
}

describe("tierForLexicalBody", () => {
  it("tiers a long plain-text body as archive-full, matching tierFor's own threshold", () => {
    const content = root([paragraph(longText(BRIEF_THRESHOLD))]);
    expect(tierForLexicalBody(content)).toBe("archive-full");
    expect(tierForLexicalBody(content)).toBe(tierFor(BRIEF_THRESHOLD));
  });

  it("tiers a short plain-text body as archive-brief", () => {
    const content = root([paragraph(longText(BRIEF_THRESHOLD - 1))]);
    expect(tierForLexicalBody(content)).toBe("archive-brief");
  });

  it("counts image alt text and caption toward length", () => {
    // Body text alone is short, but the upload node's alt+caption push it over
    // the threshold once combined -- proving captions/alt count, not just body text.
    const shortBody = longText(10);
    const altAndCaption = longText(BRIEF_THRESHOLD - 10);
    const content = root([
      paragraph(shortBody),
      { type: "upload", value: { alt: altAndCaption }, fields: {} },
    ]);
    expect(tierForLexicalBody(content)).toBe("archive-full");
  });

  // The media-block ineligibility rule: THE headline requirement of Task 7.
  it("is archive-full for a short body containing a gallery, regardless of text length", () => {
    const content = root([
      paragraph("مقال قصير جدا"), // well under BRIEF_THRESHOLD
      { type: "block", fields: { blockType: "gallery", layout: "grid", images: [] } },
    ]);
    expect(tierForLexicalBody(content)).toBe("archive-full");
  });

  it("is archive-full for a short body containing a socialEmbed, regardless of text length", () => {
    const content = root([
      paragraph("قصير"),
      { type: "block", fields: { blockType: "socialEmbed", source: "https://x.com/a/status/1" } },
    ]);
    expect(tierForLexicalBody(content)).toBe("archive-full");
  });

  it("is archive-full for a short body containing an audio block, regardless of text length", () => {
    const content = root([
      paragraph("قصير"),
      { type: "block", fields: { blockType: "audio", file: 1 } },
    ]);
    expect(tierForLexicalBody(content)).toBe("archive-full");
  });

  it("is archive-full for a short body containing an embedFrame block, regardless of text length", () => {
    const content = root([
      paragraph("قصير"),
      { type: "block", fields: { blockType: "embedFrame", src: "https://w.soundcloud.com/player/?url=1" } },
    ]);
    expect(tierForLexicalBody(content)).toBe("archive-full");
  });

  it("is archive-full for a short body containing a bare inline image (upload node), regardless of text length", () => {
    const content = root([paragraph("قصير"), { type: "upload", value: { alt: "" } }]);
    expect(tierForLexicalBody(content)).toBe("archive-full");
  });

  it("still tiers a short body with NO media block as archive-brief", () => {
    const content = root([paragraph("قصير")]);
    expect(tierForLexicalBody(content)).toBe("archive-brief");
  });

  it("never throws for malformed content", () => {
    expect(() => tierForLexicalBody(null)).not.toThrow();
    expect(() => tierForLexicalBody(undefined)).not.toThrow();
    expect(() => tierForLexicalBody({})).not.toThrow();
    expect(tierForLexicalBody(null)).toBe("archive-brief");
  });

  it("does not change tierFor's own signature or behaviour (raw-HTML import path untouched)", () => {
    expect(tierFor(499)).toBe("archive-brief");
    expect(tierFor(500)).toBe("archive-full");
  });
});
