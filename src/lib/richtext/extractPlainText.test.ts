import { describe, it, expect } from "vitest";
import { extractPlainText, hasMediaBlock } from "./extractPlainText";

function paragraph(text: string) {
  return { type: "paragraph", children: [{ type: "text", text }] };
}

function root(children: unknown[]) {
  return { root: { type: "root", children } };
}

describe("extractPlainText", () => {
  it("extracts plain text from paragraphs", () => {
    const content = root([paragraph("مرحبا"), paragraph("بالعالم")]);
    expect(extractPlainText(content)).toBe("مرحبا بالعالم");
  });

  it("recurses into nested element nodes (e.g. a heading or list item)", () => {
    const content = root([
      { type: "heading", tag: "h2", children: [{ type: "text", text: "عنوان" }] },
      {
        type: "list",
        children: [{ type: "listitem", children: [{ type: "text", text: "بند أول" }] }],
      },
    ]);
    expect(extractPlainText(content)).toBe("عنوان بند أول");
  });

  // --- per-block-type contributions (design spec table) ---

  it("socialEmbed contributes its caption", () => {
    const content = root([
      { type: "block", fields: { blockType: "socialEmbed", source: "https://x.com/a/status/1", caption: "تعليق التغريدة" } },
    ]);
    expect(extractPlainText(content)).toBe("تعليق التغريدة");
  });

  it("socialEmbed with no caption contributes nothing", () => {
    const content = root([
      { type: "block", fields: { blockType: "socialEmbed", source: "https://x.com/a/status/1" } },
    ]);
    expect(extractPlainText(content)).toBe("");
  });

  it("an image (upload node) contributes alt text and caption", () => {
    const content = root([
      {
        type: "upload",
        value: { alt: "لاعب يحتفل" },
        fields: { caption: "لحظة الهدف" },
      },
    ]);
    expect(extractPlainText(content)).toBe("لاعب يحتفل لحظة الهدف");
  });

  it("gallery contributes the per-image captions, concatenated", () => {
    const content = root([
      {
        type: "block",
        fields: {
          blockType: "gallery",
          layout: "grid",
          images: [{ caption: "صورة أولى" }, { caption: "صورة ثانية" }, {}],
        },
      },
    ]);
    expect(extractPlainText(content)).toBe("صورة أولى صورة ثانية");
  });

  it("audio contributes its title", () => {
    const content = root([{ type: "block", fields: { blockType: "audio", title: "المقابلة الكاملة" } }]);
    expect(extractPlainText(content)).toBe("المقابلة الكاملة");
  });

  it("embedFrame contributes its title", () => {
    const content = root([
      { type: "block", fields: { blockType: "embedFrame", src: "https://w.soundcloud.com/player/?url=1", title: "حلقة البودكاست" } },
    ]);
    expect(extractPlainText(content)).toBe("حلقة البودكاست");
  });

  it("an unknown block type contributes nothing, silently", () => {
    const content = root([
      paragraph("قبل"),
      { type: "block", fields: { blockType: "somethingFromTheFuture", foo: "bar" } },
      paragraph("بعد"),
    ]);
    expect(extractPlainText(content)).toBe("قبل بعد");
  });

  // --- the four required malformed cases ---

  it("degrades to empty string for a block node missing fields entirely", () => {
    const content = root([{ type: "block" }]);
    expect(() => extractPlainText(content)).not.toThrow();
    expect(extractPlainText(content)).toBe("");
  });

  it("degrades to empty string for a block node whose fields is null", () => {
    const content = root([{ type: "block", fields: null }]);
    expect(() => extractPlainText(content)).not.toThrow();
    expect(extractPlainText(content)).toBe("");
  });

  it("degrades to empty string for a gallery whose images is undefined", () => {
    const content = root([{ type: "block", fields: { blockType: "gallery", images: undefined } }]);
    expect(() => extractPlainText(content)).not.toThrow();
    expect(extractPlainText(content)).toBe("");
  });

  it("degrades to empty string for a node with an unknown blockType", () => {
    const content = root([{ type: "block", fields: { blockType: "notARealBlock" } }]);
    expect(() => extractPlainText(content)).not.toThrow();
    expect(extractPlainText(content)).toBe("");
  });

  // --- general robustness: never crash, never emit "[object Object]" ---

  it("returns empty string for null/undefined content", () => {
    expect(extractPlainText(null)).toBe("");
    expect(extractPlainText(undefined)).toBe("");
  });

  it("returns empty string when content is not an object", () => {
    expect(extractPlainText("just a string")).toBe("");
    expect(extractPlainText(42)).toBe("");
  });

  it("returns empty string when root is missing or root.children is not an array", () => {
    expect(extractPlainText({})).toBe("");
    expect(extractPlainText({ root: {} })).toBe("");
    expect(extractPlainText({ root: { children: "not-an-array" } })).toBe("");
  });

  it("never emits the literal string [object Object] for a malformed upload node", () => {
    const content = root([{ type: "upload", value: {}, fields: {} }]);
    expect(extractPlainText(content)).not.toContain("[object Object]");
  });

  it("never emits [object Object] when a text node's text field is itself an object", () => {
    const content = root([{ type: "paragraph", children: [{ type: "text", text: { nested: true } }] }]);
    expect(() => extractPlainText(content)).not.toThrow();
    expect(extractPlainText(content)).not.toContain("[object Object]");
  });
});

describe("hasMediaBlock", () => {
  it("is true for an article containing an upload (image) node", () => {
    const content = root([{ type: "upload", value: { alt: "x" } }]);
    expect(hasMediaBlock(content)).toBe(true);
  });

  it.each(["socialEmbed", "gallery", "audio", "embedFrame"])(
    "is true for an article containing a %s block",
    (blockType) => {
      const content = root([{ type: "block", fields: { blockType } }]);
      expect(hasMediaBlock(content)).toBe(true);
    },
  );

  it("is false for an article containing only paragraphs", () => {
    const content = root([paragraph("مجرد نص")]);
    expect(hasMediaBlock(content)).toBe(false);
  });

  it("finds a media block nested inside another element", () => {
    const content = root([
      { type: "quote", children: [{ type: "upload", value: { alt: "x" } }] },
    ]);
    expect(hasMediaBlock(content)).toBe(true);
  });

  it("never throws and returns false for malformed content", () => {
    expect(hasMediaBlock(null)).toBe(false);
    expect(hasMediaBlock({})).toBe(false);
    expect(hasMediaBlock({ root: { children: "nope" } })).toBe(false);
  });
});
