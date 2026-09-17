import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, within, fireEvent, screen, waitFor } from "@testing-library/react";

// Isolate the playlist banner (it renders its own image/markup we don't care about here).
vi.mock("@/components/home/LeaguePlaylistBanner", () => ({
  LeaguePlaylistBanner: () => <div data-testid="playlist" />,
}));

import { LatestNewsSection, latestNewsUrl } from "@/components/home/LatestNewsSection";
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
const byTag: Record<string, LeagueCardArticle[]> = {
  "3": [{ id: "m1", title: "Maroc Story", slug: "maroc-story", heroUrl: null }],
  "490": [],
};
const labels = { all: "All", tagFilters: "tag filters", empty: "Nothing here" };

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async (url: string) => {
    const tag = new URL(String(url), "http://x").searchParams.get("tag") ?? "";
    return { ok: true, json: async () => ({ articles: byTag[tag] ?? [] }) } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function renderSection(locale = "en") {
  return render(
    <LatestNewsSection title="Latest news" locale={locale} tags={tags} latest={latest} labels={labels} />,
  );
}

describe("LatestNewsSection", () => {
  it("has no league filter anywhere", () => {
    renderSection();
    screen.getAllByRole("button").forEach((b) => expect(b.textContent).not.toMatch(/Botola|Premier|League/));
  });

  it("renders the chip strip once, in the header: beside the title on desktop, wrapping under it on mobile", () => {
    const { container } = renderSection();
    const h2 = screen.getByRole("heading", { level: 2, name: "Latest news" });
    const header = h2.parentElement as HTMLElement;
    expect(header.className).toContain("flex-wrap");
    const rows = container.querySelectorAll("[data-tag-chips]");
    expect(rows.length).toBe(1);
    const wrapper = rows[0]!.parentElement as HTMLElement;
    expect(wrapper.parentElement).toBe(header);
    expect(wrapper.className).toContain("basis-full");
    expect(wrapper.className).toContain("lg:flex-1");
    expect(h2.compareDocumentPosition(wrapper) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(header).getByRole("button", { name: "Scroll tags to end" })).toBeInTheDocument();
  });

  it("desktop: the newest article takes the spotlight cell (col 3, row 1) and the carousel gets the rest", () => {
    const { container } = renderSection();
    const desktop = container.querySelector("[data-latest-desktop]") as HTMLElement;
    const spotlight = desktop.querySelector("[data-spotlight]") as HTMLElement;
    expect(spotlight.className).toContain("lg:col-start-3");
    expect(spotlight.className).toContain("lg:row-start-1");
    expect(within(spotlight).getByText("Newest")).toBeInTheDocument();
    const carousel = desktop.querySelector(".lg\\:grid-rows-subgrid") as HTMLElement;
    expect(within(carousel).queryByText("Newest")).toBeNull();
    expect(within(carousel).getByText("Second")).toBeInTheDocument();
    expect(within(carousel).getByText("Third")).toBeInTheDocument();
  });

  it("mobile: the slider shows every latest article, after the chips", () => {
    const { container } = renderSection();
    const chips = container.querySelector("[data-tag-chips]") as HTMLElement;
    const slider = container.querySelector("[data-latest-mobile] .snap-x") as HTMLElement;
    expect(chips.compareDocumentPosition(slider) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const titles = within(slider).getAllByRole("article").map((a) => a.querySelector("h3")?.textContent);
    expect(titles).toEqual(["Newest", "Second", "Third"]);
  });

  it("selecting a chip fetches that tag's list once (with the locale), shows a skeleton meanwhile, then renders it; 'all' restores the latest without a fetch", async () => {
    const { container } = renderSection("ar");
    fireEvent.click(screen.getByRole("button", { name: "Maroc" }));
    expect(container.querySelector("[data-latest-loading]")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]![0])).toBe(latestNewsUrl("3", "ar"));
    // Rendered in both the desktop carousel and the mobile slider.
    await waitFor(() => expect(screen.getAllByText("Maroc Story")).toHaveLength(2));
    expect(container.querySelector("[data-latest-loading]")).toBeNull();
    expect(screen.queryByText("Newest")).toBeNull();
    expect(screen.getByRole("button", { name: "Maroc" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(screen.getAllByText("Newest").length).toBeGreaterThan(0);
    // Back to the tag: served from memory, no second request.
    fireEvent.click(screen.getByRole("button", { name: "Maroc" }));
    expect(screen.getAllByText("Maroc Story")).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows the empty label when the chosen tag has no articles, and on a failed request", async () => {
    renderSection();
    fireEvent.click(screen.getByRole("button", { name: "Inwi" }));
    await waitFor(() => expect(screen.getByText("Nothing here")).toBeInTheDocument());

    fetchMock.mockRejectedValueOnce(new Error("network"));
    fireEvent.click(screen.getByRole("button", { name: "Maroc" }));
    await waitFor(() => expect(screen.getByText("Nothing here")).toBeInTheDocument());
  });
});
