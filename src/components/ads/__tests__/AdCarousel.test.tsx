// src/components/ads/__tests__/AdCarousel.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import { AdCarousel } from "@/components/ads/AdCarousel";
import type { AdItem } from "@/lib/payload/ads";

const ads: AdItem[] = [
  { id: 1, type: "image", imageUrl: "https://blob/a.jpg", alt: "Ad A", linkUrl: "https://a.com" },
  { id: 2, type: "image", imageUrl: "https://blob/b.jpg", alt: "Ad B" },
];

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("AdCarousel", () => {
  it("renders nothing when there are no ads", () => {
    const { container } = render(<AdCarousel ads={[]} format="banner" />);
    expect(container.firstChild).toBeNull();
  });

  it("banner format applies the fixed 970x250 slot (capped, centered)", () => {
    const { container } = render(<AdCarousel ads={[ads[0]]} format="banner" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("aspect-[970/250]");
    expect(root.className).toContain("max-w-[970px]");
    const img = container.querySelector("img");
    expect(img?.className).toContain("object-cover");
    expect(img?.getAttribute("alt")).toBe("Ad A");
  });

  it("card format uses the fixed 300x250 medium-rectangle ratio", () => {
    const { container } = render(<AdCarousel ads={[ads[0]]} format="card" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("aspect-[300/250]");
    expect(root.className).toContain("rounded-xl");
  });

  it("tower format uses the fixed 300x600 vertical ratio", () => {
    const { container } = render(<AdCarousel ads={[ads[0]]} format="tower" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("aspect-[300/600]");
    expect(root.className).toContain("rounded-xl");
  });

  it("wraps a slide in a new-tab link when linkUrl is set, plain when not", () => {
    const withLink = render(<AdCarousel ads={[ads[0]]} format="banner" />);
    const a = withLink.container.querySelector("a");
    expect(a).toHaveAttribute("href", "https://a.com");
    expect(a).toHaveAttribute("target", "_blank");
    expect(a).toHaveAttribute("rel", "noopener noreferrer");

    const noLink = render(<AdCarousel ads={[ads[1]]} format="banner" />);
    expect(noLink.container.querySelector("a")).toBeNull();
  });

  it("shows dots only when there is more than one ad, and a dot click switches slides", () => {
    const single = render(<AdCarousel ads={[ads[0]]} format="banner" />);
    expect(single.container.querySelectorAll("[data-ad-dot]")).toHaveLength(0);

    const { container } = render(<AdCarousel ads={ads} format="banner" />);
    const dots = container.querySelectorAll("[data-ad-dot]");
    expect(dots).toHaveLength(2);
    // First ad visible initially.
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("Ad A");
    fireEvent.click(dots[1]);
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("Ad B");
  });

  it("auto-advances on its interval", () => {
    vi.useFakeTimers();
    const { container } = render(<AdCarousel ads={ads} format="banner" intervalMs={3000} />);
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("Ad A");
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("Ad B");
  });

  it("renders a tag ad as an embed slot, not an image carousel", () => {
    const tag: AdItem = { id: 9, type: "tag", embedCode: '<ins id="net"></ins>' };
    const { container } = render(<AdCarousel ads={[tag]} format="banner" />);
    expect(container.querySelector("[data-ad-embed]")).not.toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  it("a tag ad in the slot overrides image ads (the network owns the slot)", () => {
    const mixed: AdItem[] = [
      { id: 1, type: "image", imageUrl: "https://blob/a.jpg", alt: "A" },
      { id: 2, type: "tag", embedCode: "<ins></ins>" },
    ];
    const { container } = render(<AdCarousel ads={mixed} format="banner" />);
    expect(container.querySelector("[data-ad-embed]")).not.toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });
});
