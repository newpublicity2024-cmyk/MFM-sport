import { describe, it, expect, vi } from "vitest";
import { render, within, fireEvent } from "@testing-library/react";

// Isolate the playlist banner (it renders its own image/markup we don't care about here).
vi.mock("@/components/home/LeaguePlaylistBanner", () => ({
  LeaguePlaylistBanner: () => <div data-testid="playlist" />,
}));

import { LeagueNewsSection } from "@/components/home/LeagueNewsSection";
import { LEAGUES } from "@/lib/home/leagues";
import type { LeagueCardArticle } from "@/lib/home/cards";

const firstLeagueId = LEAGUES[0]!.id;
const secondLeagueId = LEAGUES[1]!.id;
const articlesByLeague: Record<string, LeagueCardArticle[]> = {
  [firstLeagueId]: [
    { id: "a1", title: "One", slug: "one", heroUrl: null },
    { id: "a2", title: "Two", slug: "two", heroUrl: null },
  ],
  [secondLeagueId]: [
    { id: "b1", title: "Second League Story", slug: "second", heroUrl: null },
  ],
};

describe("LeagueNewsSection", () => {
  it("renders a desktop grid (hidden lg:grid) and a mobile column (lg:hidden)", () => {
    const { container } = render(
      <LeagueNewsSection title="News" locale="en" articlesByLeague={articlesByLeague} />,
    );
    const desktop = container.querySelector(".lg\\:grid");
    const mobile = container.querySelector(".lg\\:hidden");
    expect(desktop?.className).toContain("hidden");
    expect(mobile).toBeTruthy();
  });

  it("on mobile, the filter comes before the blog slider", () => {
    const { container } = render(
      <LeagueNewsSection title="News" locale="en" articlesByLeague={articlesByLeague} />,
    );
    const mobile = container.querySelector(".lg\\:hidden") as HTMLElement;
    const slider = mobile.querySelector(".snap-x") as HTMLElement;
    expect(slider).toBeTruthy();
    const firstFilterButton = mobile.querySelector("button") as HTMLElement;
    expect(firstFilterButton).toBeTruthy();
    const pos = firstFilterButton.compareDocumentPosition(slider);
    // eslint-disable-next-line no-bitwise
    expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders the blog cards inside the mobile slider", () => {
    const { container } = render(
      <LeagueNewsSection title="News" locale="en" articlesByLeague={articlesByLeague} />,
    );
    const mobile = container.querySelector(".lg\\:hidden") as HTMLElement;
    const slider = mobile.querySelector(".snap-x") as HTMLElement;
    expect(within(slider).getAllByRole("article").length).toBe(2);
  });

  it("defaults to the first league and switches the slider's articles when another filter is clicked", () => {
    const { container } = render(
      <LeagueNewsSection title="News" locale="en" articlesByLeague={articlesByLeague} />,
    );
    const mobile = container.querySelector(".lg\\:hidden") as HTMLElement;
    // Defaults to the first league's articles.
    expect(
      within(mobile.querySelector(".snap-x") as HTMLElement).getByText("One"),
    ).toBeInTheDocument();

    // The mobile filter buttons are the league-panel buttons (one per league);
    // clicking the second switches the selected league.
    const filterButtons = within(mobile).getAllByRole("button");
    fireEvent.click(filterButtons[1]!);

    const slider = mobile.querySelector(".snap-x") as HTMLElement;
    expect(within(slider).getByText("Second League Story")).toBeInTheDocument();
    expect(within(slider).queryByText("One")).not.toBeInTheDocument();
  });
});
