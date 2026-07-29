import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { InstagramEmbed } from "./InstagramEmbed";

describe("InstagramEmbed", () => {
  it("renders an iframe pointed at the /embed URL with the required attributes", () => {
    const { container } = render(
      <InstagramEmbed canonicalUrl="https://www.instagram.com/p/ABC123/" caption={null} />,
    );
    const iframe = container.querySelector("iframe");
    expect(iframe).toBeTruthy();
    expect(iframe?.getAttribute("src")).toBe("https://www.instagram.com/p/ABC123/embed");
    expect(iframe?.getAttribute("loading")).toBe("lazy");
    expect(iframe?.getAttribute("referrerPolicy")).toBe("no-referrer-when-downgrade");
    expect(iframe?.hasAttribute("allowFullScreen")).toBe(true);
  });

  it("reserves a 9:16 box for a reel", () => {
    const { container } = render(
      <InstagramEmbed canonicalUrl="https://www.instagram.com/reel/XYZ789/" caption={null} />,
    );
    const box = container.querySelector("[data-embed-box]") as HTMLElement;
    expect(box.style.aspectRatio).toBe("9 / 16");
  });

  it("reserves a 4:5 box for a post", () => {
    const { container } = render(
      <InstagramEmbed canonicalUrl="https://www.instagram.com/p/ABC123/" caption={null} />,
    );
    const box = container.querySelector("[data-embed-box]") as HTMLElement;
    expect(box.style.aspectRatio).toBe("4 / 5");
  });

  // A1 — the unconditional fallback. A deleted post, a private account and a
  // suspended one ALL return HTTP 200 and paint zero images, and this can't be
  // detected cross-origin, so the caption+link must render regardless — not
  // behind any error/failure check.
  it("renders the caption+link fallback unconditionally alongside a working iframe", () => {
    const { getByRole, container } = render(
      <InstagramEmbed canonicalUrl="https://www.instagram.com/p/ABC123/" caption="لقطة من المباراة" />,
    );
    expect(container.querySelector("iframe")).toBeTruthy();
    const link = getByRole("link", { name: "شاهد على إنستغرام" });
    expect(link.getAttribute("href")).toBe("https://www.instagram.com/p/ABC123/");
    expect(container.textContent).toContain("لقطة من المباراة");
  });

  it("still renders the caption+link fallback even when the URL cannot be turned into an iframe src", () => {
    const { getByRole, container } = render(
      <InstagramEmbed canonicalUrl="not-a-url" caption="لقطة من المباراة" />,
    );
    expect(container.querySelector("iframe")).toBeNull();
    const link = getByRole("link", { name: "شاهد على إنستغرام" });
    expect(link.getAttribute("href")).toBe("not-a-url");
  });
});
