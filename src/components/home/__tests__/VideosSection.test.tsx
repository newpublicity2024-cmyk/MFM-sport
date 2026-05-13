import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VideosSection } from "@/components/home/VideosSection";
import { MOCK_VIDEOS } from "@/lib/home/mockVideos";

describe("VideosSection", () => {
  it("renders the section title", () => {
    render(<VideosSection title="Latest Videos" locale="en" />);
    expect(screen.getByRole("heading", { name: "Latest Videos" })).toBeInTheDocument();
  });

  it("defaults to the first video and renders its iframe", () => {
    render(<VideosSection title="Latest Videos" locale="en" />);
    const first = MOCK_VIDEOS[0];
    const iframe = screen.getByTitle(first.title.en) as HTMLIFrameElement;
    expect(iframe.src).toContain(`youtube.com/embed/${first.id}`);
  });

  it("swaps the iframe when a list item is clicked", () => {
    render(<VideosSection title="Latest Videos" locale="en" />);
    const second = MOCK_VIDEOS[1];
    fireEvent.click(screen.getByRole("button", { name: new RegExp(second.title.en) }));
    const iframe = screen.getByTitle(second.title.en) as HTMLIFrameElement;
    expect(iframe.src).toContain(`youtube.com/embed/${second.id}`);
  });
});
