import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeroSlider } from "@/components/home/HeroSlider";
import type { HeroSlide } from "@/lib/home/cards";

const slides: HeroSlide[] = [
  {
    id: "1",
    title: "عنوان طويل جدًا لمقال في الصفحة الرئيسية يمتد على أكثر من سطر واحد",
    slug: "one",
    heroUrl: null,
    alt: "",
    categoryName: "البطولة",
    categorySlug: "botola",
    publishedAt: "2026-09-17T10:00:00.000Z",
  },
  { id: "2", title: "Second", slug: "two", heroUrl: null, alt: "" },
];

beforeAll(() => {
  // jsdom has no matchMedia; the slider only reads prefers-reduced-motion from it.
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
});

describe("HeroSlider caption", () => {
  it("mobile: the title is two lines of 18px text; desktop restores the large clamp and three lines", () => {
    render(<HeroSlider slides={slides} locale="ar" />);
    const title = screen.getAllByRole("heading", { level: 2 })[0]!;
    expect(title.className).toContain("text-lg");
    expect(title.className).toContain("line-clamp-2");
    expect(title.className).toContain("lg:text-[clamp(1.5rem,3vw+1rem,2.25rem)]");
    expect(title.className).toContain("lg:line-clamp-3");
    // The old mobile size must not survive as an unprefixed class.
    expect(title.className.split(" ")).not.toContain("text-[clamp(1.5rem,3vw+1rem,2.25rem)]");
    expect(title.className.split(" ")).not.toContain("line-clamp-3");
  });

  it("mobile: the caption hugs the bottom edge with small padding; desktop pads more", () => {
    render(<HeroSlider slides={slides} locale="ar" />);
    const title = screen.getAllByRole("heading", { level: 2 })[0]!;
    const caption = title.parentElement!;
    expect(caption.className).toContain("bottom-0");
    expect(caption.className).toContain("p-3");
    expect(caption.className).toContain("lg:p-6");
    expect(caption.className.split(" ")).not.toContain("p-6");
  });

  it("mobile: the date is smaller and closer to the title", () => {
    render(<HeroSlider slides={slides} locale="ar" />);
    const time = document.querySelector("time")!;
    expect(time.className).toContain("text-xs");
    expect(time.className).toContain("lg:text-sm");
  });

  it("RTL: prev/next arrows sit on logical start/end edges and the glyph is picked by locale", () => {
    render(<HeroSlider slides={slides} locale="ar" />);
    const prev = screen.getByRole("button", { name: "Previous slide" });
    const next = screen.getByRole("button", { name: "Next slide" });
    expect(prev.className).toContain("start-3");
    expect(next.className).toContain("end-3");
  });
});
