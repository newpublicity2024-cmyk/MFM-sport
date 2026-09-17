import { describe, it, expect, vi } from "vitest";
import { render, within, fireEvent, screen } from "@testing-library/react";

// Isolate the playlist banner (it renders its own image/markup we don't care about here).
vi.mock("@/components/home/LeaguePlaylistBanner", () => ({
  LeaguePlaylistBanner: () => <div data-testid="playlist" />,
}));

import { LatestNewsSection } from "@/components/home/LatestNewsSection";
import type { LeagueCardArticle } from "@/lib/home/cards";
import type { TagChip } from "@/lib/home/latestNewsTags";

const tags: TagChip[] = [
  { id: "3", name: "Maroc", slug: "maroc" },
  { id: "490", name: "Inwi", slug: "inwi" },
];
const latest: LeagueCardArticle[] = [
  { id: "a1", title: "Newest", slug: "newest", heroUrl: null },
  { id: "a2", title: "Second", slug: "second", heroUrl: null },
  { id: "a3", title: "Third", slug: "third", heroUrl: null },
];
const articlesByTag: Record<string, LeagueCardArticle[]> = {
  "": latest,
  "3": [{ id: "m1", title: "Maroc Story", slug: "maroc-story", heroUrl: null }],
  "490": [],
};
const labels = { all: "All", tagFilters: "tag filters", empty: "Nothing here" };

function renderSection(locale = "en") {
  return render(
    <LatestNewsSection
      title="Latest news"
      locale={locale}
      tags={tags}
      articlesByTag={articlesByTag}
      labels={labels}
    />,
  );
}

describe("LatestNewsSection", () => {
  it("has no league filter anywhere: no league buttons, no leagues panel", () => {
    const { container } = renderSection();
    expect(container.querySelector("img[alt='']")).toBeNull();
    const buttons = screen.getAllByRole("button");
    // Only tag chips (2 rows × 3 chips) + desktop scroll arrows (2) + carousel dots, never a league.
    buttons.forEach((b) => expect(b.textContent).not.toMatch(/Botola|Premier|League/));
  });

  it("desktop: the chip row sits in the header beside the title, with arrows", () => {
    const { container } = renderSection();
    const h2 = screen.getByRole("heading", { level: 2, name: "Latest news" });
    const header = h2.parentElement as HTMLElement;
    const chipRow = header.querySelector("[data-tag-chips]") as HTMLElement;
    expect(chipRow).toBeTruthy();
    const wrapper = chipRow.parentElement as HTMLElement;
    expect(wrapper.className).toContain("hidden");
    expect(wrapper.className).toContain("lg:block");
    expect(within(header).getByRole("button", { name: "Scroll tags to end" })).toBeInTheDocument();
    expect(container.querySelectorAll("[data-tag-chips]").length).toBe(2);
  });

  it("mobile: the chips are a row of their own between the title and the slider, without arrows", () => {
    const { container } = renderSection();
    const h2 = screen.getByRole("heading", { level: 2 });
    const rows = Array.from(container.querySelectorAll("[data-tag-chips]"));
    const mobileRow = rows.find((r) => r.parentElement?.className.includes("lg:hidden")) as HTMLElement;
    expect(mobileRow).toBeTruthy();
    expect(mobileRow.parentElement?.querySelector("button[aria-label^='Scroll']")).toBeNull();
    const slider = container.querySelector("[data-latest-mobile] .snap-x") as HTMLElement;
    expect(slider).toBeTruthy();
    // title → mobile chips → slider, in document order
    expect(h2.compareDocumentPosition(mobileRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(mobileRow.compareDocumentPosition(slider) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("desktop: the newest article takes the spotlight cell (col 3, row 1) and the carousel gets the rest", () => {
    const { container } = renderSection();
    const desktop = container.querySelector("[data-latest-desktop]") as HTMLElement;
    const spotlight = desktop.querySelector("[data-spotlight]") as HTMLElement;
    expect(spotlight).toBeTruthy();
    expect(spotlight.className).toContain("lg:col-start-3");
    expect(spotlight.className).toContain("lg:row-start-1");
    expect(within(spotlight).getByText("Newest")).toBeInTheDocument();
    const carousel = desktop.querySelector(".lg\\:grid-rows-subgrid") as HTMLElement;
    expect(within(carousel).queryByText("Newest")).toBeNull();
    expect(within(carousel).getByText("Second")).toBeInTheDocument();
    expect(within(carousel).getByText("Third")).toBeInTheDocument();
  });

  it("mobile: the slider shows every latest article", () => {
    const { container } = renderSection();
    const slider = container.querySelector("[data-latest-mobile] .snap-x") as HTMLElement;
    const titles = within(slider)
      .getAllByRole("article")
      .map((a) => a.querySelector("h3")?.textContent);
    expect(titles).toEqual(["Newest", "Second", "Third"]);
  });

  it("selecting a tag chip switches every list to that tag's articles; 'all' restores the latest", () => {
    const { container } = renderSection();
    const mobileChips = container.querySelectorAll("[data-tag-chips]")[1] as HTMLElement;
    fireEvent.click(within(mobileChips).getByRole("button", { name: "Maroc" }));
    const mobile = container.querySelector("[data-latest-mobile]") as HTMLElement;
    expect(within(mobile).getByText("Maroc Story")).toBeInTheDocument();
    expect(within(mobile).queryByText("Newest")).toBeNull();
    // Both chip rows reflect the selection.
    screen.getAllByRole("button", { name: "Maroc" }).forEach((b) => {
      expect(b).toHaveAttribute("aria-pressed", "true");
    });
    fireEvent.click(within(mobileChips).getByRole("button", { name: "All" }));
    expect(
      within(container.querySelector("[data-latest-mobile]") as HTMLElement).getByText("Newest"),
    ).toBeInTheDocument();
  });

  it("shows the empty label when the chosen tag has no articles", () => {
    renderSection();
    fireEvent.click(screen.getAllByRole("button", { name: "Inwi" })[0]!);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.queryByRole("article")).toBeNull();
  });
});
