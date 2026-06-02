import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VideoList } from "@/components/home/VideoList";
import type { HomeVideo } from "@/lib/videos";

const videos: HomeVideo[] = [
  {
    youtubeId: "vid1",
    title: "First",
    thumbnailUrl: "https://example.com/1.jpg",
    duration: "01:23",
    publishedAt: "2026-05-13T12:00:00.000Z",
  },
  {
    youtubeId: "vid2",
    title: "Second",
    thumbnailUrl: "https://example.com/2.jpg",
    duration: "04:56",
    publishedAt: "2026-05-12T12:00:00.000Z",
  },
];

describe("VideoList", () => {
  it("renders one button per video with title and duration", () => {
    render(
      <VideoList videos={videos} selectedId="vid1" locale="en" onSelect={() => {}} />,
    );
    expect(screen.getByRole("button", { name: /First/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Second/ })).toBeInTheDocument();
    expect(screen.getByText("01:23")).toBeInTheDocument();
    expect(screen.getByText("04:56")).toBeInTheDocument();
  });

  it("marks the selected video with aria-pressed=true", () => {
    render(
      <VideoList videos={videos} selectedId="vid2" locale="en" onSelect={() => {}} />,
    );
    expect(screen.getByRole("button", { name: /Second/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /First/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onSelect with the video id when clicked", () => {
    const onSelect = vi.fn();
    render(
      <VideoList videos={videos} selectedId="vid1" locale="en" onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Second/ }));
    expect(onSelect).toHaveBeenCalledWith("vid2");
  });
});
