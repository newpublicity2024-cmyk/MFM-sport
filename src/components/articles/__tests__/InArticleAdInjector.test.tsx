import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, it, expect, vi } from "vitest";

vi.mock("@payloadcms/richtext-lexical/react", () => ({
  RichText: ({ data }: { data: any }) => (
    <div data-testid="richtext" data-count={data?.root?.children?.length ?? 0} />
  ),
}));

vi.mock("../../ads/AdSlot", () => ({
  AdSlot: () => <div data-testid="ad-slot" />,
}));

const messages = { ads: { label: "Advertisement" } };

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>{ui}</NextIntlClientProvider>,
  );
}

describe("InArticleAdInjector", () => {
  it("renders single RichText (no ad) when content has no paragraphs", async () => {
    const { InArticleAdInjector } = await import("../InArticleAdInjector");
    const content = { root: { children: [{ type: "heading" }] } };
    const { queryAllByTestId } = renderWithIntl(
      <InArticleAdInjector content={content} />,
    );
    expect(queryAllByTestId("richtext")).toHaveLength(1);
    expect(queryAllByTestId("ad-slot")).toHaveLength(0);
  });

  it("renders single RichText when only one node remains after first paragraph", async () => {
    const { InArticleAdInjector } = await import("../InArticleAdInjector");
    const content = { root: { children: [{ type: "paragraph" }] } };
    const { queryAllByTestId } = renderWithIntl(
      <InArticleAdInjector content={content} />,
    );
    expect(queryAllByTestId("richtext")).toHaveLength(1);
    expect(queryAllByTestId("ad-slot")).toHaveLength(0);
  });

  it("splits content and injects ad after first paragraph", async () => {
    const { InArticleAdInjector } = await import("../InArticleAdInjector");
    const content = {
      root: {
        children: [
          { type: "paragraph", id: "p1" },
          { type: "paragraph", id: "p2" },
          { type: "paragraph", id: "p3" },
        ],
      },
    };
    const { queryAllByTestId } = renderWithIntl(
      <InArticleAdInjector content={content} />,
    );
    const richTexts = queryAllByTestId("richtext");
    expect(richTexts).toHaveLength(2);
    expect(richTexts[0]).toHaveAttribute("data-count", "1");
    expect(richTexts[1]).toHaveAttribute("data-count", "2");
    expect(queryAllByTestId("ad-slot")).toHaveLength(1);
  });

  it("renders nothing (gracefully) when content is null", async () => {
    const { InArticleAdInjector } = await import("../InArticleAdInjector");
    const { container } = renderWithIntl(<InArticleAdInjector content={null} />);
    expect(container.firstChild).toBeNull();
  });
});
