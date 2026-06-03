import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LeaguePlaylistBanner } from "@/components/home/LeaguePlaylistBanner";

const PLAYLIST_URL =
  "https://www.youtube.com/playlist?list=PL3AfsMqHuUG2ribU3zGm6xQ9G5FSPiDuF";

describe("LeaguePlaylistBanner", () => {
  it("links to the YouTube playlist and opens in a new tab safely", () => {
    render(<LeaguePlaylistBanner locale="en" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", PLAYLIST_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders the banner image from /images/box-banner.jpg", () => {
    const { container } = render(<LeaguePlaylistBanner locale="en" />);
    const img = container.querySelector("img");
    // next/image rewrites src into an optimizer URL; the original path is encoded inside it.
    expect(decodeURIComponent(img?.getAttribute("src") ?? "")).toContain(
      "/images/box-banner.jpg",
    );
  });

  it("uses a localized accessible label (English)", () => {
    render(<LeaguePlaylistBanner locale="en" />);
    expect(
      screen.getByRole("link", { name: /Featured playlist on YouTube/i }),
    ).toBeInTheDocument();
  });

  it("uses the Arabic label when locale=ar", () => {
    render(<LeaguePlaylistBanner locale="ar" />);
    expect(
      screen.getByRole("link", { name: /قائمة تشغيل/ }),
    ).toBeInTheDocument();
  });
});
