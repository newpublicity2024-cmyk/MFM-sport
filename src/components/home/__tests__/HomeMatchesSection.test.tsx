import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { HomeMatchesSection } from "@/components/home/HomeMatchesSection";
import type { HomeMatchLabels } from "@/components/home/HomeMatchRow";
import type { ApiFixture } from "@/lib/api-football/types";

const LABELS: HomeMatchLabels = {
  liveNow: "Live Now", events: "Events", venue: "Venue", referee: "Referee",
  viewFullMatch: "View full match", loadingDetails: "Loading...", noEvents: "No events yet",
};

function fx(id: number, short: string, ts: number, homeName: string): ApiFixture {
  return {
    fixture: {
      id, date: "2026-06-03T19:00:00+00:00", timestamp: ts,
      venue: { id: 1, name: "Stadium", city: "City" },
      status: { long: short, short, elapsed: short === "2H" ? 70 : null },
      referee: null,
    },
    league: { id: 200, name: "Botola", country: "Morocco", logo: "https://x/l.png", flag: null, season: 2026, round: "R28" },
    teams: {
      home: { id: id * 10, name: homeName, logo: "https://x/h.png", winner: null },
      away: { id: id * 10 + 1, name: "Away " + id, logo: "https://x/a.png", winner: null },
    },
    goals: { home: 1, away: 1 },
    score: {
      halftime: { home: 0, away: 0 }, fulltime: { home: null, away: null },
      extratime: { home: null, away: null }, penalty: { home: null, away: null },
    },
  };
}

describe("HomeMatchesSection", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("blocked")));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("shows the empty state when there are no fixtures", () => {
    render(
      <HomeMatchesSection
        title="Matches" emptyLabel="No matches today" locale="en" fixtures={[]} labels={LABELS}
      />,
    );
    expect(screen.getByText("No matches today")).toBeInTheDocument();
  });

  it("renders the section title and one row per fixture", () => {
    const fixtures = [fx(1, "NS", 1780000200, "Scheduled FC"), fx(2, "2H", 1780000100, "Live FC")];
    render(
      <HomeMatchesSection
        title="Matches" emptyLabel="No matches today" locale="en" fixtures={fixtures} labels={LABELS}
      />,
    );
    expect(screen.getByRole("heading", { name: "Matches" })).toBeInTheDocument();
    expect(screen.getByText("Live FC")).toBeInTheDocument();
    expect(screen.getByText("Scheduled FC")).toBeInTheDocument();
  });

  it("sorts the live match before the scheduled one", () => {
    // Scheduled fixture passed first, but live should render first.
    const fixtures = [fx(1, "NS", 1780000050, "Scheduled FC"), fx(2, "2H", 1780000999, "Live FC")];
    render(
      <HomeMatchesSection
        title="Matches" emptyLabel="No matches today" locale="en" fixtures={fixtures} labels={LABELS}
      />,
    );
    const names = screen.getAllByText(/FC$/).map((n) => n.textContent);
    expect(names[0]).toBe("Live FC");
    expect(names[1]).toBe("Scheduled FC");
  });

  it("wraps the match list in a mobile vertical snap slider (8 rows), unbounded on desktop", () => {
    const fixtures = [fx(1, "NS", 1780000200, "Alpha FC"), fx(2, "NS", 1780000300, "Beta FC"), fx(3, "NS", 1780000400, "Gamma FC")];
    const { container } = render(
      <HomeMatchesSection title="Matches" emptyLabel="none" locale="en" fixtures={fixtures} labels={LABELS} />,
    );
    const slider = container.querySelector("[data-matches-slider]") as HTMLElement;
    expect(slider).toBeTruthy();
    expect(slider.className).toContain("max-h-[32rem]");
    expect(slider.className).toContain("snap-y");
    expect(slider.className).toContain("no-scrollbar");
    expect(slider.className).toContain("lg:max-h-none");
    expect(slider.className).toContain("lg:overflow-visible");
  });

  it("makes each match row a snap target", () => {
    const fixtures = [fx(1, "NS", 1780000200, "Alpha FC"), fx(2, "NS", 1780000300, "Beta FC"), fx(3, "NS", 1780000400, "Gamma FC")];
    const { container } = render(
      <HomeMatchesSection title="Matches" emptyLabel="none" locale="en" fixtures={fixtures} labels={LABELS} />,
    );
    const slider = container.querySelector("[data-matches-slider]") as HTMLElement;
    const rows = slider.querySelectorAll(":scope > [data-match-row]");
    expect(rows.length).toBe(3);
    rows.forEach((r) => {
      expect((r as HTMLElement).className).toContain("snap-start");
      // shrink-0 keeps each row at full height in the flex-col scroll slider
      // (without it many rows get squished to ~0px).
      expect((r as HTMLElement).className).toContain("shrink-0");
    });
  });
});
