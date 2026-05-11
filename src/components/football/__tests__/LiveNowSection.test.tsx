import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { LiveNowSection } from "@/components/football/LiveNowSection";

vi.mock("@/hooks/useLiveFixtures", () => ({
  useLiveFixtures: ({ initial }: { initial: unknown[] }) => ({
    fixtures: initial,
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@/components/football/MatchList", () => ({
  MatchList: ({ fixtures }: { fixtures: unknown[] }) => (
    <div data-testid="match-list">count:{fixtures.length}</div>
  ),
}));

const messages = { match: { live: "LIVE", liveNow: "Live Now" }, common: { readMore: "View all" } };

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>{ui}</NextIntlClientProvider>,
  );
}

const liveFixture = {
  fixture: { id: 1, status: { short: "1H" } },
  league: { id: 39 },
  teams: { home: {}, away: {} },
} as never;

describe("LiveNowSection", () => {
  it("renders nothing when there are no live fixtures", () => {
    const { container } = renderWithIntl(<LiveNowSection initial={[]} locale="en" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders heading and MatchList when live fixtures exist", () => {
    renderWithIntl(<LiveNowSection initial={[liveFixture]} locale="en" />);
    expect(screen.getByText("Live Now")).toBeInTheDocument();
    expect(screen.getByTestId("match-list")).toHaveTextContent("count:1");
  });
});
