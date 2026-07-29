import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("react-tweet", () => ({
  Tweet: (props: { id: string }) => <div data-testid="tweet" data-id={props.id} />,
}));

describe("SocialEmbedRenderer", () => {
  it("renders the X embed for an x.com source", async () => {
    const { SocialEmbedRenderer } = await import("./SocialEmbedRenderer");
    const { getByTestId } = render(
      <SocialEmbedRenderer source="https://x.com/MFMSport/status/1234567890123456789" caption={null} />,
    );
    expect(getByTestId("tweet").getAttribute("data-id")).toBe("1234567890123456789");
  });

  it("renders a Facebook iframe + unconditional Arabic fallback for a facebook.com source", async () => {
    const { SocialEmbedRenderer } = await import("./SocialEmbedRenderer");
    const { container, getByRole } = render(
      <SocialEmbedRenderer source="https://www.facebook.com/MFMSport/videos/123" caption={null} />,
    );
    expect(container.querySelector("iframe")).toBeTruthy();
    expect(getByRole("link", { name: "شاهد على فيسبوك" })).toBeTruthy();
  });

  it("renders an Instagram iframe + unconditional Arabic fallback for an instagram.com source", async () => {
    const { SocialEmbedRenderer } = await import("./SocialEmbedRenderer");
    const { container, getByRole } = render(
      <SocialEmbedRenderer source="https://www.instagram.com/p/ABC123/" caption={null} />,
    );
    expect(container.querySelector("iframe")).toBeTruthy();
    expect(getByRole("link", { name: "شاهد على إنستغرام" })).toBeTruthy();
  });

  // YouTube is a supported parseEmbed platform (a journalist can paste a YouTube
  // link into the same socialEmbed block), but Task 5 specifies no dedicated
  // YouTube renderer -- the design doc's "lite facade" is future work. Rather
  // than silently rendering nothing for a whole platform, this reuses the same
  // always-visible caption+link pattern already required for Facebook/Instagram.
  // Deliberate, scoped-down choice -- see task-567-report.md.
  it("renders the caption+link fallback (no iframe) for a youtube.com source", async () => {
    const { SocialEmbedRenderer } = await import("./SocialEmbedRenderer");
    const { container, getByRole } = render(
      <SocialEmbedRenderer source="https://www.youtube.com/watch?v=dQw4w9WgXcQ" caption={null} />,
    );
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector('[data-testid="tweet"]')).toBeNull();
    expect(getByRole("link", { name: "شاهد على يوتيوب" })).toBeTruthy();
  });

  it("renders nothing for a source parseEmbed cannot resolve at all (malformed data path)", async () => {
    const { SocialEmbedRenderer } = await import("./SocialEmbedRenderer");
    const { container } = render(<SocialEmbedRenderer source="not a link at all" caption={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for an empty/missing source", async () => {
    const { SocialEmbedRenderer } = await import("./SocialEmbedRenderer");
    const { container } = render(<SocialEmbedRenderer source={null as unknown as string} caption={null} />);
    expect(container.firstChild).toBeNull();
  });
});
