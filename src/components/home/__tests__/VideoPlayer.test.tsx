import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VideoPlayer } from "@/components/home/VideoPlayer";

describe("VideoPlayer", () => {
  it("renders a YouTube iframe with the correct video id in src", () => {
    render(<VideoPlayer videoId="abc123" title="My Title" />);
    const iframe = screen.getByTitle("My Title") as HTMLIFrameElement;
    expect(iframe.tagName).toBe("IFRAME");
    expect(iframe.src).toContain("youtube.com/embed/abc123");
  });

  it("sets allowfullscreen on the iframe", () => {
    render(<VideoPlayer videoId="abc123" title="My Title" />);
    const iframe = screen.getByTitle("My Title");
    expect(iframe).toHaveAttribute("allowfullscreen");
  });

  it("updates the iframe src when videoId changes", () => {
    const { rerender } = render(<VideoPlayer videoId="abc123" title="t" />);
    rerender(<VideoPlayer videoId="xyz999" title="t" />);
    const iframe = screen.getByTitle("t") as HTMLIFrameElement;
    expect(iframe.src).toContain("youtube.com/embed/xyz999");
  });
});
