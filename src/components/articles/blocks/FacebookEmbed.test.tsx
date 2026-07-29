import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { FacebookEmbed } from "./FacebookEmbed";

describe("FacebookEmbed", () => {
  it("renders a plugins/video.php iframe for a video URL with the required attributes", () => {
    const { container } = render(
      <FacebookEmbed canonicalUrl="https://www.facebook.com/MFMSport/videos/123" caption={null} />,
    );
    const iframe = container.querySelector("iframe");
    expect(iframe?.getAttribute("src")).toMatch(/^https:\/\/www\.facebook\.com\/plugins\/video\.php\?/);
    expect(iframe?.getAttribute("loading")).toBe("lazy");
    expect(iframe?.getAttribute("referrerPolicy")).toBe("no-referrer-when-downgrade");
    expect(iframe?.hasAttribute("allowFullScreen")).toBe(true);
  });

  it("renders a plugins/post.php iframe for a post URL", () => {
    const { container } = render(
      <FacebookEmbed canonicalUrl="https://www.facebook.com/MFMSport/posts/456" caption={null} />,
    );
    const iframe = container.querySelector("iframe");
    expect(iframe?.getAttribute("src")).toMatch(/^https:\/\/www\.facebook\.com\/plugins\/post\.php\?/);
  });

  // A1 — same unconditional treatment as Instagram: a deleted post, a private
  // account and a suspended one all return HTTP 200 and paint nothing.
  it("renders the caption+link fallback unconditionally alongside a working iframe", () => {
    const { getByRole, container } = render(
      <FacebookEmbed canonicalUrl="https://www.facebook.com/MFMSport/videos/123" caption="فيديو من المباراة" />,
    );
    expect(container.querySelector("iframe")).toBeTruthy();
    const link = getByRole("link", { name: "شاهد على فيسبوك" });
    expect(link.getAttribute("href")).toBe("https://www.facebook.com/MFMSport/videos/123");
    expect(container.textContent).toContain("فيديو من المباراة");
  });

  it("still renders the caption+link fallback even when the URL cannot be turned into an iframe src", () => {
    const { getByRole, container } = render(
      <FacebookEmbed canonicalUrl="not-a-url" caption={null} />,
    );
    expect(container.querySelector("iframe")).toBeNull();
    expect(getByRole("link", { name: "شاهد على فيسبوك" })).toBeTruthy();
  });
});
