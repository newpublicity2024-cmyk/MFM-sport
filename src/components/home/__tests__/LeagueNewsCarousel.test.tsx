import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LeagueNewsCarousel } from "@/components/home/LeagueNewsCarousel";
import type { LeagueCardArticle } from "@/lib/home/cards";
import type { AdItem } from "@/lib/payload/ads";

// Stub the card + ad so the test targets the carousel's paging/dots logic.
vi.mock("@/components/home/LeagueArticleCard", () => ({
  LeagueArticleCard: ({ article }: { article: LeagueCardArticle }) => (
    <span data-testid="card">{article.title}</span>
  ),
}));
vi.mock("@/components/ads/AdCarousel", () => ({
  AdCarousel: ({ ads }: { ads: AdItem[] }) => <span data-testid="ad">AD:{ads.length}</span>,
}));

// Disable auto-advance in tests via reduced-motion so no timers run.
beforeAll(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  );
});

function makeArticles(n: number): LeagueCardArticle[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `id-${i}`,
    title: `Title ${i}`,
    slug: `slug-${i}`,
    heroUrl: null,
    categoryName: "Cat",
    publishedAt: "2026-06-20T12:00:00.000Z",
  }));
}

const dots = () => screen.queryAllByRole("tab");
const cards = () => screen.queryAllByTestId("card");

describe("LeagueNewsCarousel", () => {
  it("pages 4 at a time with no ad (20 articles -> 5 pages/dots)", () => {
    render(<LeagueNewsCarousel articles={makeArticles(20)} locale="ar" />);
    expect(dots()).toHaveLength(5);
  });

  it("shows only the current page's 4 cards, not all 20", () => {
    render(<LeagueNewsCarousel articles={makeArticles(20)} locale="ar" />);
    expect(cards()).toHaveLength(4);
    expect(screen.getByText("Title 0")).toBeInTheDocument();
    expect(screen.queryByText("Title 4")).not.toBeInTheDocument(); // page 2
  });

  it("pages 3 at a time when an ad is present (20 articles -> 7 pages) with the ad on the page", () => {
    const ads = [{ id: "ad1" }] as unknown as AdItem[];
    render(<LeagueNewsCarousel articles={makeArticles(20)} locale="ar" ads={ads} />);
    expect(dots()).toHaveLength(7);
    expect(cards()).toHaveLength(3); // 3 blogs + the ad fills the 4th cell
    expect(screen.getByTestId("ad")).toBeInTheDocument();
  });

  it("hides the dots when there is only one page", () => {
    render(<LeagueNewsCarousel articles={makeArticles(4)} locale="ar" />);
    expect(dots()).toHaveLength(0);
  });

  it("renders nothing when there are no articles", () => {
    const { container } = render(<LeagueNewsCarousel articles={[]} locale="ar" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("first dot active by default", () => {
    render(<LeagueNewsCarousel articles={makeArticles(20)} locale="ar" />);
    expect(dots()[0]).toHaveAttribute("aria-selected", "true");
  });

  it("activates the page whose dot is clicked and swaps the visible cards", () => {
    render(<LeagueNewsCarousel articles={makeArticles(20)} locale="ar" />);
    fireEvent.click(dots()[1]);
    expect(dots()[1]).toHaveAttribute("aria-selected", "true");
    expect(dots()[0]).toHaveAttribute("aria-selected", "false");
    // page 2 shows Title 4..7
    expect(screen.getByText("Title 4")).toBeInTheDocument();
    expect(screen.queryByText("Title 0")).not.toBeInTheDocument();
  });
});
