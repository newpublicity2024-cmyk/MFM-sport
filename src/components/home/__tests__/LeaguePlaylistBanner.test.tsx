import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LeaguePlaylistBanner } from "@/components/home/LeaguePlaylistBanner";

const LINK_URL = "https://www.instagram.com/mfmsportofficiel";

describe("LeaguePlaylistBanner", () => {
  it("links to the Instagram profile and opens in a new tab safely", () => {
    render(<LeaguePlaylistBanner locale="en" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", LINK_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders the banner image from /images/actual-banner.jpeg", () => {
    const { container } = render(<LeaguePlaylistBanner locale="en" />);
    const img = container.querySelector("img");
    // next/image rewrites src into an optimizer URL; the original path is encoded inside it.
    expect(decodeURIComponent(img?.getAttribute("src") ?? "")).toContain(
      "/images/actual-banner.jpeg",
    );
  });

  it("uses a localized accessible label (English)", () => {
    render(<LeaguePlaylistBanner locale="en" />);
    expect(
      screen.getByRole("link", { name: /Follow us on Instagram/i }),
    ).toBeInTheDocument();
  });

  it("uses the Arabic label when locale=ar", () => {
    render(<LeaguePlaylistBanner locale="ar" />);
    expect(
      screen.getByRole("link", { name: /إنستغرام/ }),
    ).toBeInTheDocument();
  });

  it("fits the image without zooming (object-contain, not object-cover)", () => {
    const { container } = render(<LeaguePlaylistBanner locale="en" />);
    const img = container.querySelector("img");
    expect(img?.className).toContain("object-contain");
    expect(img?.className).not.toContain("object-cover");
  });
});
