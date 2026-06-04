import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock the team dictionary so the Arabic path is verified independently of the
// real (Wikidata-seeded) data, which lands in Task 10.
vi.mock("@/lib/api-football/dictionaries/teams.ar", () => ({
  TEAMS_AR: { 529: "برشلونة", 541: "ريال مدريد" },
}));

import { MatchCard } from "@/components/football/MatchCard";
import { transliterateToArabic } from "@/lib/api-football/transliterate";

function fixture(homeId: number, awayId: number) {
  return {
    fixture: {
      id: 1,
      date: "2026-06-04T18:00:00Z",
      timestamp: 0,
      venue: null,
      status: { long: "", short: "NS", elapsed: null },
      referee: null,
    },
    league: {
      id: 39,
      name: "Premier League",
      country: "England",
      logo: "",
      flag: null,
      season: 2024,
      round: "Regular Season - 1",
    },
    teams: {
      home: { id: homeId, name: "Home FC", logo: "", winner: null },
      away: { id: awayId, name: "Away FC", logo: "", winner: null },
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

describe("MatchCard team localization", () => {
  it("shows Arabic team names when ids are mapped and locale=ar", () => {
    render(<MatchCard fixture={fixture(529, 541)} locale="ar" />);
    expect(screen.getByText("برشلونة")).toBeInTheDocument();
    expect(screen.getByText("ريال مدريد")).toBeInTheDocument();
  });

  it("transliterates an unmapped team name to Arabic (locale=ar)", () => {
    render(<MatchCard fixture={fixture(529, -1)} locale="ar" />);
    expect(screen.getByText("برشلونة")).toBeInTheDocument();
    // Unmapped away team is transliterated, not left Latin.
    expect(screen.queryByText("Away FC")).not.toBeInTheDocument();
    expect(screen.getByText(transliterateToArabic("Away FC"))).toBeInTheDocument();
  });

  it("shows Latin team names for fr", () => {
    render(<MatchCard fixture={fixture(529, 541)} locale="fr" />);
    expect(screen.getByText("Home FC")).toBeInTheDocument();
    expect(screen.getByText("Away FC")).toBeInTheDocument();
  });
});
