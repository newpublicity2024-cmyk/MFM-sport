import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LeagueNewsSection } from "@/components/home/LeagueNewsSection";
import type { LeagueCardArticle } from "@/lib/home/cards";

function makeArticles(prefix: string): LeagueCardArticle[] {
  return [1, 2, 3, 4].map((i) => ({
    id: `${prefix}-${i}`,
    title: `${prefix} article ${i}`,
    slug: `${prefix}-${i}`,
    heroUrl: `/api/media/file/${prefix}-${i}.jpg`,
    categoryName: "News",
    publishedAt: "2026-05-13T12:00:00.000Z",
  }));
}

const articlesByLeague: Record<string, LeagueCardArticle[]> = {
  "botola-pro": makeArticles("botola"),
  "premier-league": makeArticles("premier"),
};

describe("LeagueNewsSection", () => {
  it("defaults to the first league and shows its 4 articles", () => {
    render(
      <LeagueNewsSection
        title="By League"
        locale="en"
        articlesByLeague={articlesByLeague}
      />,
    );
    expect(screen.getByRole("heading", { name: "By League" })).toBeInTheDocument();
    // First league is "Botola Pro" — should be active
    expect(screen.getByRole("button", { name: /Botola Pro/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // 4 article cards visible
    expect(screen.getAllByRole("article")).toHaveLength(4);
    expect(screen.getByText(/botola article 1/)).toBeInTheDocument();
  });

  it("switches articles when a different league is clicked", () => {
    render(
      <LeagueNewsSection
        title="By League"
        locale="en"
        articlesByLeague={articlesByLeague}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Premier League/ }));
    expect(screen.getByRole("button", { name: /Premier League/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /Botola Pro/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    const articles = screen.getAllByRole("article");
    expect(articles).toHaveLength(4);
    expect(screen.getByText(/premier article 1/)).toBeInTheDocument();
  });
});
