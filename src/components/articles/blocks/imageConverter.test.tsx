import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { articleImageConverter } from "./imageConverter";

// The converter is a plain function (`{ node } => ReactNode`), the same shape
// Payload's own JSXConverters use -- not a React component -- so it's called
// directly and the returned node is rendered, rather than mounted as JSX.
function renderConverter(node: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (articleImageConverter as any)({ node });
  return render(<>{result}</>);
}

const baseMedia = {
  id: 1,
  alt: "لاعب يحتفل بالهدف",
  url: "https://blob.example.com/goal.jpg",
  mimeType: "image/jpeg",
  width: 1200,
  height: 800,
};

describe("articleImageConverter", () => {
  it("renders a sized next/image with explicit width/height for a populated image node", () => {
    const { container } = renderConverter({
      value: baseMedia,
      fields: { caption: "لحظة التسجيل", credit: "تصوير: محمد" },
    });
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("alt")).toBe("لاعب يحتفل بالهدف");
    expect(img?.getAttribute("width")).toBe("1200");
    expect(img?.getAttribute("height")).toBe("800");
  });

  it("never sets priority (that belongs to the hero image only)", () => {
    const { container } = renderConverter({ value: baseMedia, fields: {} });
    const img = container.querySelector("img");
    // next/image emits fetchPriority (or nothing) rather than a `priority` DOM
    // attribute; asserting there's no eager fetchpriority hint is the closest
    // artefact-level check available without importing next/image internals.
    expect(img?.getAttribute("fetchpriority")).not.toBe("high");
  });

  it("renders the per-usage caption and credit beneath the image", () => {
    const { getByText } = renderConverter({
      value: baseMedia,
      fields: { caption: "لحظة التسجيل", credit: "تصوير: محمد" },
    });
    expect(getByText(/لحظة التسجيل/)).toBeTruthy();
    expect(getByText(/تصوير: محمد/)).toBeTruthy();
  });

  it("renders the image with no caption/credit block when fields is missing entirely", () => {
    const { container, queryByText } = renderConverter({ value: baseMedia });
    expect(container.querySelector("img")).toBeTruthy();
    expect(queryByText(/تصوير/)).toBeNull();
  });

  it("renders the image with no caption/credit block when fields is null", () => {
    const { container, queryByText } = renderConverter({ value: baseMedia, fields: null });
    expect(container.querySelector("img")).toBeTruthy();
    expect(queryByText(/تصوير/)).toBeNull();
  });

  it("guards a nullable mimeType and falls back to a plain link instead of throwing", () => {
    // A single render call: rendering itself is the "does this throw" assertion
    // -- an uncaught throw here fails the test with the real stack trace.
    const audioDoc = { ...baseMedia, mimeType: null, filename: "clip.mp3" };
    const { container, getByRole } = renderConverter({ value: audioDoc, fields: {} });
    expect(container.querySelector("img")).toBeNull();
    expect(getByRole("link")).toBeTruthy();
  });

  it("falls back to a plain link for a non-image upload (e.g. audio) rather than throwing", () => {
    const audioDoc = { ...baseMedia, mimeType: "audio/mpeg", filename: "clip.mp3" };
    const { container, getByRole } = renderConverter({ value: audioDoc, fields: {} });
    expect(container.querySelector("img")).toBeNull();
    const link = getByRole("link");
    expect(link.getAttribute("href")).toBe(audioDoc.url);
  });

  it("renders nothing for an unpopulated upload node (value is just an id)", () => {
    const { container } = renderConverter({ value: 42, fields: {} });
    expect(container.firstChild).toBeNull();
  });

  it("falls back to an unsized plain img when width/height are missing, rather than dropping the image", () => {
    const noDimensions = { ...baseMedia, width: null, height: null };
    const { container } = renderConverter({ value: noDimensions, fields: {} });
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.hasAttribute("width")).toBe(false);
  });

  it("renders nothing when the media document has no url", () => {
    const noUrl = { ...baseMedia, url: null };
    const { container } = renderConverter({ value: noUrl, fields: {} });
    expect(container.firstChild).toBeNull();
  });
});
