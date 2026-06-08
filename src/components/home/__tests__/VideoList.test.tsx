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

  it("constrains the mobile list to ~5 rows as a snap slider", () => {
    const { container } = render(
      <VideoList videos={videos} selectedId="vid1" locale="en" onSelect={() => {}} />,
    );
    const list = container.firstElementChild as HTMLElement;
    expect(list.className).toContain("max-h-[23rem]");
    expect(list.className).not.toContain("max-h-[28rem]");
    expect(list.className).toContain("snap-y");
    expect(list.className).toContain("no-scrollbar");
    expect(list.className).toContain("lg:max-h-none");
  });

  it("makes each video button a snap target", () => {
    const { container } = render(
      <VideoList videos={videos} selectedId="vid1" locale="en" onSelect={() => {}} />,
    );
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(2);
    buttons.forEach((b) => {
      expect(b.className).toContain("snap-start");
      // shrink-0 stops flex from squishing rows when the playlist is long.
      expect(b.className).toContain("shrink-0");
    });
  });
});
