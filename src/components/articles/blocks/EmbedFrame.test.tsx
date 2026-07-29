import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { EmbedFrame } from "./EmbedFrame";

describe("EmbedFrame", () => {
  it("renders an iframe for an allowlisted SoundCloud player src", () => {
    const { container } = render(
      <EmbedFrame src="https://w.soundcloud.com/player/?url=123" height={166} title="حلقة البودكاست" />,
    );
    const iframe = container.querySelector("iframe");
    expect(iframe?.getAttribute("src")).toBe("https://w.soundcloud.com/player/?url=123");
    expect(iframe?.getAttribute("height")).toBe("166");
    expect(iframe?.getAttribute("title")).toBe("حلقة البودكاست");
    expect(iframe?.getAttribute("loading")).toBe("lazy");
    expect(iframe?.getAttribute("referrerPolicy")).toBe("no-referrer-when-downgrade");
  });

  it("renders an iframe for an allowlisted Datawrapper chart src", () => {
    const { container } = render(
      <EmbedFrame src="https://datawrapper.dwcdn.net/abc123/1/" height={400} title="رسم بياني" />,
    );
    expect(container.querySelector("iframe")).toBeTruthy();
  });

  // Defense in depth: the block's own validate() already checked this at write
  // time, but the renderer re-checks against the same shared allowlist rather
  // than trusting stored data blindly -- fail closed, not open.
  it("renders nothing for a disallowed src, even though the field was required at write time", () => {
    const { container } = render(
      <EmbedFrame src="https://evil.com/steal" height={400} title="عنوان" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for a src that matches the hostname but not the required path prefix", () => {
    const { container } = render(
      <EmbedFrame src="https://www.google.com/search?q=test" height={400} title="عنوان" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("falls back to a default height when height is missing", () => {
    const { container } = render(
      <EmbedFrame src="https://open.spotify.com/embed/track/1" height={null} title="أغنية" />,
    );
    expect(container.querySelector("iframe")?.getAttribute("height")).toBe("400");
  });

  it("never throws for a null/undefined src", () => {
    expect(() => render(<EmbedFrame src={null} height={400} title="عنوان" />)).not.toThrow();
    expect(() => render(<EmbedFrame src={undefined} height={400} title="عنوان" />)).not.toThrow();
  });
});
