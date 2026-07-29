import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Audio } from "./Audio";

const file = {
  id: 7,
  alt: "",
  url: "https://blob.example.com/interview.mp3",
  filename: "interview.mp3",
  mimeType: "audio/mpeg",
  updatedAt: "2026-01-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("Audio", () => {
  it("renders a native audio player with preload=none for a populated file", () => {
    const { container } = render(<Audio file={file} title="المقابلة الكاملة" />);
    const audio = container.querySelector("audio");
    expect(audio).toBeTruthy();
    expect(audio?.getAttribute("preload")).toBe("none");
    expect(audio?.hasAttribute("controls")).toBe(true);
    expect(container.querySelector("source")?.getAttribute("src")).toBe(file.url);
  });

  it("renders the title above the player when provided", () => {
    // The title also appears as the <audio> element's fallback link text for
    // browsers that can't render the element -- both are intentional, so this
    // asserts on the figcaption specifically rather than an ambiguous getByText.
    const { container } = render(<Audio file={file} title="المقابلة الكاملة" />);
    expect(container.querySelector("figcaption")?.textContent).toBe("المقابلة الكاملة");
  });

  it("renders no title element when title is absent", () => {
    const { container } = render(<Audio file={file} title={null} />);
    expect(container.querySelector("figcaption")).toBeNull();
  });

  it("renders nothing for an unpopulated file relation (a bare id)", () => {
    const { container } = render(<Audio file={42} title="عنوان" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when file is null or undefined", () => {
    expect(render(<Audio file={null} title="عنوان" />).container.firstChild).toBeNull();
    expect(render(<Audio file={undefined} title="عنوان" />).container.firstChild).toBeNull();
  });

  it("renders nothing when the media document has no url", () => {
    const { container } = render(<Audio file={{ ...file, url: null }} title="عنوان" />);
    expect(container.firstChild).toBeNull();
  });
});
