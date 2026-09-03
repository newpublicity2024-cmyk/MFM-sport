import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { CompetitionCalendar } from "@/components/articles/CompetitionCalendar";
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
    league: { id: 200, name: "Botola Pro", country: "Morocco", logo: "", flag: null, season: 2026, round: "Regular Season - 3" },
    teams: {
      home: { id: 1, name: "Morocco", logo: "https://logo/h.png", winner: null },
      away: { id: 2, name: "Spain", logo: "https://logo/a.png", winner: null },
    },
    goals: { home: null, away: null },
    score: { halftime: { home: null, away: null }, fulltime: { home: null, away: null }, extratime: { home: null, away: null }, penalty: { home: null, away: null } },
  } as unknown as ApiFixture;
}

describe("CompetitionCalendar", () => {
  it("renders nothing when there are no fixtures", () => {
    const { container } = render(
      <CompetitionCalendar fixtures={[]} locale="ar" title="البطولة الاحترافية" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the title and a capped scroll slider of match rows", () => {
    const fixtures = [1, 2, 3, 4, 5, 6, 7].map(fixture);
    const { container, getByText } = render(
      <CompetitionCalendar fixtures={fixtures} locale="ar" title="البطولة الاحترافية" />,
    );
    expect(getByText("البطولة الاحترافية")).toBeTruthy();
    const slider = container.querySelector("[data-competition-slider]") as HTMLElement;
    expect(slider).toBeTruthy();
    expect(slider.className).toContain("overflow-y-auto");
    expect(slider.className).toContain("no-scrollbar");
    expect(slider.className).toContain("max-h-[19rem]");
    // One link per fixture (MatchCard renders an <a>).
    expect(slider.querySelectorAll("a").length).toBe(7);
  });

  it("titles the card from the caller (the CMS competition name), not a constant", () => {
    // Regression: the heading used to be a hardcoded "مونديال 2026" in the
    // article page, which outlived the tournament. It is now the competition's
    // localized name, so any competition can fill this card.
    const { getByText } = render(
      <CompetitionCalendar fixtures={[fixture(1)]} locale="ar" title="دوري أبطال أوروبا" />,
    );
    expect(getByText("دوري أبطال أوروبا")).toBeTruthy();
  });
});
