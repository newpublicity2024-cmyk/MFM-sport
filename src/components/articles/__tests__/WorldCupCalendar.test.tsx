import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { WorldCupCalendar } from "@/components/articles/WorldCupCalendar";
import type { ApiFixture } from "@/lib/api-football/types";

function fixture(id: number): ApiFixture {
  return {
    fixture: {
      id,
      date: "2026-06-11T18:00:00+00:00",
      timestamp: 0,
      venue: { id: null, name: null, city: null },
      status: { long: "Not Started", short: "NS", elapsed: null },
      referee: null,
    },
    league: { id: 1, name: "World Cup", country: "World", logo: "", flag: null, season: 2026, round: "Group Stage" },
    teams: {
      home: { id: 1, name: "Morocco", logo: "https://logo/h.png", winner: null },
      away: { id: 2, name: "Spain", logo: "https://logo/a.png", winner: null },
    },
    goals: { home: null, away: null },
    score: { halftime: { home: null, away: null }, fulltime: { home: null, away: null }, extratime: { home: null, away: null }, penalty: { home: null, away: null } },
  } as unknown as ApiFixture;
}

describe("WorldCupCalendar", () => {
  it("renders nothing when there are no fixtures", () => {
    const { container } = render(
      <WorldCupCalendar fixtures={[]} locale="ar" title="مونديال 2026" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the title and a capped scroll slider of match rows", () => {
    const fixtures = [1, 2, 3, 4, 5, 6, 7].map(fixture);
    const { container, getByText } = render(
      <WorldCupCalendar fixtures={fixtures} locale="ar" title="مونديال 2026" />,
    );
    expect(getByText("مونديال 2026")).toBeTruthy();
    const slider = container.querySelector("[data-worldcup-slider]") as HTMLElement;
    expect(slider).toBeTruthy();
    expect(slider.className).toContain("overflow-y-auto");
    expect(slider.className).toContain("no-scrollbar");
    expect(slider.className).toContain("max-h-[19rem]");
    // One link per fixture (MatchCard renders an <a>).
    expect(slider.querySelectorAll("a").length).toBe(7);
  });
});
