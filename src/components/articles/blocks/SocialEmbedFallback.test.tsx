import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SocialEmbedFallback } from "./SocialEmbedFallback";

describe("SocialEmbedFallback", () => {
  it("always renders the link, even with no caption", () => {
    const { getByRole } = render(
      <SocialEmbedFallback caption={null} href="https://www.instagram.com/p/ABC123/" linkText="شاهد على إنستغرام" />,
    );
    const link = getByRole("link", { name: "شاهد على إنستغرام" });
    expect(link.getAttribute("href")).toBe("https://www.instagram.com/p/ABC123/");
  });

  it("renders the caption alongside the link when provided", () => {
    const { getByText, getByRole } = render(
      <SocialEmbedFallback caption="من مباراة اليوم" href="https://www.instagram.com/p/ABC123/" linkText="شاهد على إنستغرام" />,
    );
    expect(getByText(/من مباراة اليوم/)).toBeTruthy();
    expect(getByRole("link", { name: "شاهد على إنستغرام" })).toBeTruthy();
  });

  it("opens the link safely in a new tab (noopener noreferrer)", () => {
    const { getByRole } = render(
      <SocialEmbedFallback caption={undefined} href="https://www.facebook.com/x/posts/1" linkText="شاهد على فيسبوك" />,
    );
    const link = getByRole("link", { name: "شاهد على فيسبوك" });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
  });

  it("does not render a caption paragraph when caption is an empty string", () => {
    const { container } = render(
      <SocialEmbedFallback caption="" href="https://www.facebook.com/x/posts/1" linkText="شاهد على فيسبوك" />,
    );
    // Only the link's own text should be present -- no stray empty caption text node.
    expect(container.textContent?.trim()).toBe("شاهد على فيسبوك");
  });
});
