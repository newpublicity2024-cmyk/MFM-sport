import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LeagueArticleCard } from "@/components/home/LeagueArticleCard";
import type { LeagueCardArticle } from "@/lib/home/cards";

const article: LeagueCardArticle = {
  id: "1",
  title: "Big Match Recap",
  slug: "big-match-recap",
  heroUrl: "https://example.com/hero.jpg",
  categoryName: "Botola",
  publishedAt: "2026-05-13T12:00:00.000Z",
};

describe("LeagueArticleCard", () => {
  it("links the title to the localized article URL", () => {
    render(<LeagueArticleCard article={article} locale="en" />);
    const link = screen.getByRole("link", { name: /Big Match Recap/ });
    expect(link).toHaveAttribute("href", "/en/articles/big-match-recap");
  });

  it("shows the category badge", () => {
    render(<LeagueArticleCard article={article} locale="en" />);
    expect(screen.getByText("Botola")).toBeInTheDocument();
  });

  it("merges a custom className onto the article element", () => {
    const { container } = render(
      <LeagueArticleCard article={article} locale="en" className="w-[85%] snap-start" />,
    );
    const el = container.querySelector("article") as HTMLElement;
    expect(el.className).toContain("w-[85%]");
    expect(el.className).toContain("snap-start");
  });
});
