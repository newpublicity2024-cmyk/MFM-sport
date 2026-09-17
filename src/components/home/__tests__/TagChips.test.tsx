import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TagChips } from "@/components/home/TagChips";
import { LATEST_KEY, type TagChip } from "@/lib/home/latestNewsTags";

const tags: TagChip[] = [
  { id: "3", name: "المغرب", slug: "maroc" },
  { id: "490", name: "البطولة إنوي", slug: "inwi" },
];

function renderChips(locale: string, arrows = false, onSelect = vi.fn()) {
  return render(
    <TagChips
      chips={tags}
      selectedId={LATEST_KEY}
      onSelect={onSelect}
      locale={locale}
      allLabel="الكل"
      label="tag filters"
      arrows={arrows}
    />,
  );
}

afterEach(() => vi.restoreAllMocks());

describe("TagChips", () => {
  it("renders an 'all' chip first, then one chip per tag, in a single non-wrapping scroll row", () => {
    renderChips("ar");
    const row = screen.getByRole("group", { name: "tag filters" });
    const chips = Array.from(row.querySelectorAll("button"));
    expect(chips.map((c) => c.textContent)).toEqual(["الكل", "المغرب", "البطولة إنوي"]);
    expect(row.className).toContain("overflow-x-auto");
    expect(row.className).toContain("whitespace-nowrap");
    chips.forEach((c) => expect(c.className).toContain("shrink-0"));
  });

  it("marks the selected chip with aria-pressed and reports the tag id on click", () => {
    const onSelect = vi.fn();
    renderChips("ar", false, onSelect);
    expect(screen.getByRole("button", { name: "الكل" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "المغرب" }));
    expect(onSelect).toHaveBeenCalledWith("3");
    fireEvent.click(screen.getByRole("button", { name: "الكل" }));
    expect(onSelect).toHaveBeenCalledWith(LATEST_KEY);
    expect(LATEST_KEY).not.toBe("");
  });

  it("renders no arrows unless asked; with arrows they are desktop-only (mobile swipes)", () => {
    renderChips("ar");
    expect(screen.queryByRole("button", { name: /Scroll tags/ })).toBeNull();
    renderChips("ar", true);
    screen.getAllByRole("button", { name: /Scroll tags/ }).forEach((b) => {
      expect(b.parentElement!.className).toContain("hidden");
      expect(b.parentElement!.className).toContain("lg:flex");
    });
  });

  it("shows a crest before the name when a chip carries one", () => {
    render(
      <TagChips
        chips={[{ id: "39", name: "Premier League", logoUrl: "https://x/39.png" }]}
        selectedId={LATEST_KEY}
        onSelect={() => {}}
        locale="ar"
        allLabel="الكل"
        label="leagues"
      />,
    );
    const chip = screen.getByRole("button", { name: "Premier League" });
    expect(chip.querySelector("img")).toBeTruthy();
    expect(screen.getByRole("button", { name: "الكل" }).querySelector("img")).toBeNull();
  });

  it("arrows scroll the strip, and in RTL the physical direction is mirrored", () => {
    const scrollBy = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollBy", { value: scrollBy, configurable: true });
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { value: 500, configurable: true });

    renderChips("en", true);
    fireEvent.click(screen.getByRole("button", { name: "Scroll tags to end" }));
    expect(scrollBy).toHaveBeenLastCalledWith(expect.objectContaining({ left: 400 }));
    fireEvent.click(screen.getByRole("button", { name: "Scroll tags to start" }));
    expect(scrollBy).toHaveBeenLastCalledWith(expect.objectContaining({ left: -400 }));

    scrollBy.mockClear();
    renderChips("ar", true);
    const [, arEnd] = screen.getAllByRole("button", { name: "Scroll tags to end" });
    const [, arStart] = screen.getAllByRole("button", { name: "Scroll tags to start" });
    fireEvent.click(arEnd!);
    // RTL: "toward the end" is physically leftward, so the delta is negative.
    expect(scrollBy).toHaveBeenLastCalledWith(expect.objectContaining({ left: -400 }));
    fireEvent.click(arStart!);
    expect(scrollBy).toHaveBeenLastCalledWith(expect.objectContaining({ left: 400 }));
  });

  it("in Arabic the arrow on the logical start edge is the visual right edge (start-0 / end-0, not left/right)", () => {
    renderChips("ar", true);
    const start = screen.getByRole("button", { name: "Scroll tags to start" }).parentElement!;
    const end = screen.getByRole("button", { name: "Scroll tags to end" }).parentElement!;
    expect(start.className).toContain("start-0");
    expect(end.className).toContain("end-0");
    expect(start.className).not.toMatch(/\bleft-0\b/);
    expect(end.className).not.toMatch(/\bright-0\b/);
  });
});
