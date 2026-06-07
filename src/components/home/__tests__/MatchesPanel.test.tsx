import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/hooks/useLiveFixtures", () => ({
  useLiveFixtures: () => ({ fixtures: [] }),
}));

import { MatchesPanel } from "@/components/home/MatchesPanel";

const statusLabels = { finished: "FT", live: "LIVE", scheduled: "SCH" };

// Botola (id 200, country Morocco => priority 0, previously auto-open) + another league.
function fixture(id: number, leagueId: number, leagueName: string, country: string) {
  return {
    fixture: {
      id,
      date: "2026-06-10T18:00:00Z",
      timestamp: id,
      venue: null,
      status: { long: "", short: "NS", elapsed: null },
      referee: null,
    },
    league: { id: leagueId, name: leagueName, country, logo: "", flag: null, season: 2026, round: "R" },
    teams: {
      home: { id: 1, name: "Home", logo: "", winner: null },
      away: { id: 2, name: "Away", logo: "", winner: null },
    },
    goals: { home: null, away: null },
    score: {
      halftime: { home: null, away: null },
      fulltime: { home: null, away: null },
      extratime: { home: null, away: null },
      penalty: { home: null, away: null },
    },
  } as never;
}

const fixtures = [
  fixture(1, 200, "Botola Pro", "Morocco"),
  fixture(2, 39, "Premier League", "England"),
];

describe("MatchesPanel", () => {
  it("starts with ALL league groups collapsed (no auto-open)", () => {
    const { container } = render(
      <MatchesPanel fixtures={fixtures} locale="en" statusLabels={statusLabels} />,
    );
    const toggles = container.querySelectorAll("button[aria-expanded]");
    expect(toggles.length).toBeGreaterThan(0);
    toggles.forEach((t) => expect(t.getAttribute("aria-expanded")).toBe("false"));
  });

  it("renders the league groups inside a mobile vertical snap slider (5 rows)", () => {
    const { container } = render(
      <MatchesPanel fixtures={fixtures} locale="en" statusLabels={statusLabels} />,
    );
    const slider = container.querySelector("[data-leagues-slider]") as HTMLElement;
    expect(slider).toBeTruthy();
    expect(slider.className).toContain("max-h-[19rem]");
    expect(slider.className).toContain("snap-y");
    expect(slider.className).toContain("no-scrollbar");
    expect(slider.className).toContain("lg:max-h-none");
  });
});
