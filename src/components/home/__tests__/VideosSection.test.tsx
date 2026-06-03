import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VideosSection } from "@/components/home/VideosSection";
import type { HomeVideo } from "@/lib/videos";

const VIDEOS: HomeVideo[] = [
  {
    youtubeId: "aaa111",
    title: "First Video",
    thumbnailUrl: "https://i.ytimg.com/vi/aaa111/hqdefault.jpg",
    duration: "08:12",
    publishedAt: "2026-05-13T12:00:00.000Z",
  },
  {
    youtubeId: "bbb222",
    title: "Second Video",
    thumbnailUrl: "https://i.ytimg.com/vi/bbb222/hqdefault.jpg",
    duration: "05:45",
    publishedAt: "2026-05-11T12:00:00.000Z",
  },
];

describe("VideosSection", () => {
  it("renders the section title", () => {
    render(<VideosSection title="The Third Half" locale="en" videos={VIDEOS} />);
    expect(screen.getByRole("heading", { name: "The Third Half" })).toBeInTheDocument();
  });

  it("renders nothing when there are no videos", () => {
    const { container } = render(
      <VideosSection title="Empty" locale="en" videos={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("defaults to the first video and renders its iframe", () => {
    render(<VideosSection title="The Third Half" locale="en" videos={VIDEOS} />);
    const iframe = screen.getByTitle("First Video") as HTMLIFrameElement;
    expect(iframe.src).toContain("youtube.com/embed/aaa111");
  });

  it("swaps the iframe when a list item is clicked", () => {
    render(<VideosSection title="The Third Half" locale="en" videos={VIDEOS} />);
    fireEvent.click(screen.getByRole("button", { name: /Second Video/ }));
    const iframe = screen.getByTitle("Second Video") as HTMLIFrameElement;
    expect(iframe.src).toContain("youtube.com/embed/bbb222");
  });

  it("wraps the section in a navy background", () => {
    const { container } = render(
      <VideosSection title="The Third Half" locale="en" videos={VIDEOS} />,
    );
    const section = container.querySelector("section");
    expect(section).toHaveClass("bg-navy");
    expect(section).toHaveClass("text-navy-foreground");
  });
});
