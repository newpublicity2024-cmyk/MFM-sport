import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
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
});
