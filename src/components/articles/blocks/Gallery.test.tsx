import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { Gallery } from "./Gallery";

const image = (n: number, caption?: string) => ({
  id: `img-${n}`,
  image: {
    id: n,
    url: `https://blob.example.com/${n}.jpg`,
    alt: `صورة ${n}`,
    width: 800,
    height: 600,
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  caption,
});

describe("Gallery", () => {
  it("renders nothing when images is empty, null or undefined", () => {
    expect(render(<Gallery images={[]} layout="grid" />).container.firstChild).toBeNull();
    expect(render(<Gallery images={null} layout="grid" />).container.firstChild).toBeNull();
    expect(render(<Gallery images={undefined} layout="grid" />).container.firstChild).toBeNull();
  });

  it("renders every image in a grid layout", () => {
    const images = [image(1), image(2), image(3)];
    const { container } = render(<Gallery images={images} layout="grid" />);
    expect(container.querySelectorAll("img").length).toBe(3);
    expect(container.querySelector("[data-gallery-grid]")).toBeTruthy();
    expect(container.querySelector("[data-gallery-carousel]")).toBeNull();
  });

  it("renders a horizontally-scrollable carousel container for carousel layout", () => {
    const images = [image(1), image(2)];
    const { container } = render(<Gallery images={images} layout="carousel" />);
    expect(container.querySelector("[data-gallery-carousel]")).toBeTruthy();
    expect(container.querySelector("[data-gallery-grid]")).toBeNull();
  });

  it("lazy-loads every image except the first", () => {
    const images = [image(1), image(2), image(3)];
    const { container } = render(<Gallery images={images} layout="grid" />);
    const imgs = Array.from(container.querySelectorAll("img"));
    expect(imgs[0].getAttribute("loading")).not.toBe("lazy");
    expect(imgs[1].getAttribute("loading")).toBe("lazy");
    expect(imgs[2].getAttribute("loading")).toBe("lazy");
  });

  it("renders per-image captions only for images that have one", () => {
    const images = [image(1, "الصورة الأولى"), image(2)];
    const { getByText, container } = render(<Gallery images={images} layout="grid" />);
    expect(getByText("الصورة الأولى")).toBeTruthy();
    // Only one figcaption should exist -- the second image has no caption.
    expect(container.querySelectorAll("figcaption").length).toBe(1);
  });

  it("skips an item whose image is an unpopulated relation (a bare id) rather than throwing", () => {
    const images = [image(1), { id: "img-broken", image: 99, caption: undefined }];
    expect(() => render(<Gallery images={images as never} layout="grid" />)).not.toThrow();
    const { container } = render(<Gallery images={images as never} layout="grid" />);
    expect(container.querySelectorAll("img").length).toBe(1);
  });

  // Fix round 1, Finding 3: bare "‹"/"›" text glyphs are bidi-mirrored by the
  // browser in RTL (this exact defect was fixed twice before on this repo, PRs
  // #30 and #31) -- the nav buttons must use icon components, not text glyphs,
  // while keeping their (already-correct) Arabic aria-labels.
  it("carousel nav buttons carry Arabic aria-labels and no bidi-mirrored text glyphs", () => {
    const images = [image(1), image(2)];
    const { container, getByLabelText } = render(<Gallery images={images} layout="carousel" />);
    const prevButton = getByLabelText("السابق");
    const nextButton = getByLabelText("التالي");
    expect(prevButton.textContent).toBe("");
    expect(nextButton.textContent).toBe("");
    expect(container.textContent).not.toContain("‹");
    expect(container.textContent).not.toContain("›");
  });

  // Fix round 2: LeagueCarousel.tsx's scroll() flips the scrollBy sign in RTL
  // (evergreen browsers use the negative-scrollLeft RTL model: 0 is the start
  // /right/ edge, and moving toward later content needs a NEGATIVE delta).
  // Gallery's scrollBy had no such flip, so under this site's only served
  // locale (Arabic, dir="rtl" -- see [locale]/layout.tsx) "التالي" (next) sent
  // a POSITIVE delta, which moves toward PREVIOUS, and "السابق" (previous)
  // sent negative, which moves toward NEXT: the two buttons were physically
  // swapped for every reader. A test asserting only "scrollBy fired" would
  // have passed against that broken code -- this pins the SIGN of the delta,
  // which is the only thing that actually distinguishes correct from swapped.
  it("flips the scrollBy delta sign between LTR and RTL for the same (next) button", () => {
    const images = [image(1), image(2)];

    function captureNextDelta(dir: "ltr" | "rtl"): number {
      // Each call renders its own instance -- unmount before returning so the
      // next call's getByLabelText doesn't see two mounted copies (render()
      // only auto-cleans up BETWEEN separate `it()` blocks, not between two
      // calls within the same test).
      const { container, getByLabelText, unmount } = render(
        <div dir={dir}>
          <Gallery images={images} layout="carousel" />
        </div>,
      );
      const scroller = container.querySelector("[data-gallery-scroller]") as HTMLElement;
      // jsdom never computes real layout, so clientWidth is always 0 -- and
      // 0 * either sign is 0, which would make this test pass trivially
      // whether or not the sign flip exists. Stub a real width so the two
      // deltas are actually distinguishable non-zero numbers.
      Object.defineProperty(scroller, "clientWidth", { value: 400, configurable: true });
      const scrollBySpy = vi.fn();
      scroller.scrollBy = scrollBySpy;

      fireEvent.click(getByLabelText("التالي")); // "next" -- toward later content

      expect(scrollBySpy).toHaveBeenCalledTimes(1);
      const delta = (scrollBySpy.mock.calls[0][0] as { left: number }).left;
      unmount();
      return delta;
    }

    const ltrDelta = captureNextDelta("ltr");
    const rtlDelta = captureNextDelta("rtl");

    // The direction of travel for the SAME button must flip between the two
    // writing directions -- not merely "some delta was sent".
    expect(Math.sign(ltrDelta)).not.toBe(Math.sign(rtlDelta));
    expect(ltrDelta).toBeGreaterThan(0);
    expect(rtlDelta).toBeLessThan(0);
  });
});
