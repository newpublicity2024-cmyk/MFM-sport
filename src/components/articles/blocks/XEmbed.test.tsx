import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

// react-tweet's <Tweet> is an async Server Component (it awaits the syndication
// fetch internally via its own Suspense boundary) -- that can only actually run
// inside Next's RSC pipeline, not under plain react-dom/client in jsdom. Real
// end-to-end behaviour was verified separately by running the Next dev server
// and fetching a real tweet (see task-567-report.md); this unit test mocks the
// external dependency at the same module boundary the codebase already uses for
// RichText in InArticleAdInjector.test.tsx.
vi.mock("react-tweet", () => ({
  Tweet: (props: { id: string; components?: { TweetNotFound?: () => React.ReactNode } }) => (
    <div data-testid="tweet" data-id={props.id} />
  ),
}));

describe("XEmbed", () => {
  it("renders the tweet container with dir=ltr", async () => {
    const { XEmbed } = await import("./XEmbed");
    const { container, getByTestId } = render(
      <XEmbed id="1234567890" canonicalUrl="https://x.com/MFMSport/status/1234567890" caption={null} />,
    );
    const wrapper = container.querySelector('[dir="ltr"]');
    expect(wrapper).toBeTruthy();
    expect(getByTestId("tweet").getAttribute("data-id")).toBe("1234567890");
  });

  it("renders the caption beneath the tweet when provided", async () => {
    const { XEmbed } = await import("./XEmbed");
    const { getByText } = render(
      <XEmbed id="1234567890" canonicalUrl="https://x.com/MFMSport/status/1234567890" caption="تعليق الناشر" />,
    );
    expect(getByText("تعليق الناشر")).toBeTruthy();
  });

  it("renders nothing for a missing id (malformed data path)", async () => {
    const { XEmbed } = await import("./XEmbed");
    const { container } = render(
      <XEmbed id="" canonicalUrl="https://x.com/MFMSport/status/1234567890" caption={null} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
