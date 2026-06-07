import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ArticleSlider } from "@/components/home/ArticleSlider";
import type { LeagueCardArticle } from "@/lib/home/cards";

const articles: LeagueCardArticle[] = [
  { id: "1", title: "One", slug: "one", heroUrl: null },
  { id: "2", title: "Two", slug: "two", heroUrl: null },
  { id: "3", title: "Three", slug: "three", heroUrl: null },
];

describe("ArticleSlider", () => {
  it("renders nothing when there are no articles", () => {
    const { container } = render(<ArticleSlider articles={[]} locale="en" />);
    expect(container.firstChild).toBeNull();
  });

  it("is a horizontal snap container with one card per article", () => {
    const { container } = render(<ArticleSlider articles={articles} locale="en" />);
    const track = container.firstElementChild as HTMLElement;
    expect(track.className).toContain("snap-x");
    expect(track.className).toContain("overflow-x-auto");
    expect(track.className).toContain("no-scrollbar");
    const cards = container.querySelectorAll("article");
    expect(cards.length).toBe(3);
  });

  it("sizes each card to show one at a time with a peek (w-[85%], snap-start)", () => {
    const { container } = render(<ArticleSlider articles={articles} locale="en" />);
    container.querySelectorAll("article").forEach((c) => {
      expect((c as HTMLElement).className).toContain("w-[85%]");
      expect((c as HTMLElement).className).toContain("shrink-0");
      expect((c as HTMLElement).className).toContain("snap-start");
    });
  });
});
