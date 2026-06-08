import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SidebarNewsList } from "@/components/articles/SidebarNewsList";

const article = (id: number) => ({
  id,
  title: `Story ${id}`,
  slug: `story-${id}`,
  featuredImage: null,
  publishedAt: "2026-06-01T10:00:00.000Z",
});

describe("SidebarNewsList", () => {
  it("renders nothing when there are no articles", () => {
    const { container } = render(
      <SidebarNewsList articles={[]} locale="ar" title="آخر الأخبار" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the title and a capped scroll slider linking each story", () => {
    const articles = [1, 2, 3, 4, 5, 6].map(article);
    const { container, getByText } = render(
      <SidebarNewsList articles={articles} locale="ar" title="آخر الأخبار" />,
    );
    expect(getByText("آخر الأخبار")).toBeTruthy();
    const slider = container.querySelector("[data-sidebar-news-slider]") as HTMLElement;
    expect(slider).toBeTruthy();
    expect(slider.className).toContain("overflow-y-auto");
    expect(slider.className).toContain("no-scrollbar");
    expect(slider.className).toContain("max-h-[22rem]");
    const links = slider.querySelectorAll("a");
    expect(links.length).toBe(6);
    expect(links[0].getAttribute("href")).toBe("/ar/articles/story-1");
  });
});
