import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NewsGrid2x2 } from "@/components/home/NewsGrid2x2";
import type { LeagueCardArticle } from "@/lib/home/cards";

function makeArticle(i: number): LeagueCardArticle {
  return {
    id: `id-${i}`,
    title: `Title ${i}`,
    slug: `slug-${i}`,
    heroUrl: `/api/media/file/${i}.jpg`,
    categoryName: "Cat",
    publishedAt: "2026-05-13T12:00:00.000Z",
  };
}

describe("NewsGrid2x2", () => {
  it("renders all provided article titles", () => {
    const articles = [1, 2, 3, 4].map(makeArticle);
    render(<NewsGrid2x2 articles={articles} locale="en" />);
    expect(screen.getByText("Title 1")).toBeInTheDocument();
    expect(screen.getByText("Title 2")).toBeInTheDocument();
    expect(screen.getByText("Title 3")).toBeInTheDocument();
    expect(screen.getByText("Title 4")).toBeInTheDocument();
  });

  it("links each card to /{locale}/articles/{slug}", () => {
    const articles = [makeArticle(1)];
    render(<NewsGrid2x2 articles={articles} locale="fr" />);
    const link = screen.getByRole("link", { name: /Title 1/ });
    expect(link).toHaveAttribute("href", "/fr/articles/slug-1");
  });

  it("renders the category label when provided", () => {
    render(<NewsGrid2x2 articles={[makeArticle(1)]} locale="en" />);
    expect(screen.getByText("Cat")).toBeInTheDocument();
  });

  it("renders empty grid gracefully when no articles", () => {
    const { container } = render(<NewsGrid2x2 articles={[]} locale="en" />);
    expect(container.querySelectorAll("article")).toHaveLength(0);
  });
});
