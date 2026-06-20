import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LeagueNewsCarousel } from "@/components/home/LeagueNewsCarousel";
import type { LeagueCardArticle } from "@/lib/home/cards";
import type { AdItem } from "@/lib/payload/ads";

// Stub the per-page grid so the test targets the carousel's paging/dots logic
// (and avoids the AdCarousel / next-image chain). Each page shows its titles and
// an "AD" marker when an ad is passed through.
vi.mock("@/components/home/NewsGrid2x2", () => ({
  NewsGrid2x2: ({ articles, ads }: { articles: LeagueCardArticle[]; ads?: AdItem[] }) => (
    <div data-testid="page">
      {articles.map((a) => (
        <span key={a.id}>{a.title}</span>
      ))}
      {ads && ads.length > 0 ? <span>AD</span> : null}
    </div>
  ),
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

describe("LeagueNewsCarousel", () => {
  it("pages 4 at a time with no ad (20 articles -> 5 pages/dots)", () => {
    render(<LeagueNewsCarousel articles={makeArticles(20)} locale="ar" />);
    expect(dots()).toHaveLength(5);
  });

  it("pages 3 at a time when an ad is present (20 articles -> 7 pages/dots)", () => {
    const ads = [{ id: "ad1" }] as unknown as AdItem[];
    render(<LeagueNewsCarousel articles={makeArticles(20)} locale="ar" ads={ads} />);
    expect(dots()).toHaveLength(7);
    // The ad renders on every page (its fixed place), not just one.
    expect(screen.getAllByText("AD").length).toBe(7);
  });

  it("hides the dots when there is only one page", () => {
    render(<LeagueNewsCarousel articles={makeArticles(4)} locale="ar" />);
    expect(dots()).toHaveLength(0);
  });

  it("renders nothing when there are no articles", () => {
    const { container } = render(<LeagueNewsCarousel articles={[]} locale="ar" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps every article in the DOM (crossfade stack) and marks the active page", () => {
    render(<LeagueNewsCarousel articles={makeArticles(20)} locale="ar" />);
    // All 20 titles are present (hidden pages are opacity-0, still mounted).
    expect(screen.getByText("Title 0")).toBeInTheDocument();
    expect(screen.getByText("Title 19")).toBeInTheDocument();
    // First dot active by default.
    expect(dots()[0]).toHaveAttribute("aria-selected", "true");
  });

  it("activates the page whose dot is clicked", () => {
    render(<LeagueNewsCarousel articles={makeArticles(20)} locale="ar" />);
    fireEvent.click(dots()[2]);
    expect(dots()[2]).toHaveAttribute("aria-selected", "true");
    expect(dots()[0]).toHaveAttribute("aria-selected", "false");
  });
});
