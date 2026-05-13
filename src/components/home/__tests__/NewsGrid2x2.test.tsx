import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NewsGrid2x2 } from "@/components/home/NewsGrid2x2";
import type { MockLeagueArticle } from "@/lib/home/mockLeagueNews";

function makeArticle(i: number): MockLeagueArticle {
  return {
    id: `id-${i}`,
    leagueId: "x",
    title: { en: `Title ${i}`, ar: `العنوان ${i}`, fr: `Titre ${i}` },
    slug: `slug-${i}`,
    imageUrl: `https://example.com/${i}.jpg`,
    category: { en: "Cat", ar: "فئة", fr: "Cat" },
    publishedAt: "2026-05-13T12:00:00.000Z",
  };
}

describe("NewsGrid2x2", () => {
  it("renders all provided article titles (English)", () => {
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
    const link = screen.getByRole("link", { name: /Titre 1/ });
    expect(link).toHaveAttribute("href", "/fr/articles/slug-1");
  });

  it("uses Arabic title when locale=ar", () => {
    const articles = [makeArticle(1)];
    render(<NewsGrid2x2 articles={articles} locale="ar" />);
    expect(screen.getByText("العنوان 1")).toBeInTheDocument();
  });

  it("renders empty grid gracefully when no articles", () => {
    const { container } = render(<NewsGrid2x2 articles={[]} locale="en" />);
    expect(container.querySelectorAll("article")).toHaveLength(0);
  });
});
