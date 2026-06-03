import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { AdBanner } from "@/components/ads/AdBanner";

describe("AdBanner", () => {
  it("renders the image at its natural aspect ratio (w-full h-auto, no crop)", () => {
    const { container } = render(
      <AdBanner src="/images/ocp-banner.jpeg" alt="OCP" width={1600} height={413} />,
    );
    const img = container.querySelector("img");
    expect(decodeURIComponent(img?.getAttribute("src") ?? "")).toContain(
      "/images/ocp-banner.jpeg",
    );
    expect(img?.getAttribute("alt")).toBe("OCP");
    expect(img?.className).toContain("w-full");
    expect(img?.className).toContain("h-auto");
    // Must NOT crop/zoom the image.
    expect(img?.className).not.toContain("object-cover");
  });

  it("renders without a link by default", () => {
    const { container } = render(
      <AdBanner src="/images/cargo-banner.jpeg" alt="MSC" width={970} height={250} />,
    );
    expect(container.querySelector("a")).toBeNull();
  });

  it("wraps the image in a safe new-tab link when href is provided", () => {
    const { getByRole } = render(
      <AdBanner
        src="/images/car1-banner.jpeg"
        alt="OMODA"
        width={970}
        height={250}
        href="https://example.com"
      />,
    );
    const link = getByRole("link");
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
