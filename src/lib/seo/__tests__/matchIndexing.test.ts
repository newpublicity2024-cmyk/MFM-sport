import { describe, expect, it } from "vitest";
import { isIndexableFixture } from "../matchIndexing";
import type { ApiFixture } from "@/lib/api-football/types";

function fixture(overrides: {
  leagueId: number;
  country?: string;
  home?: string;
  away?: string;
}): ApiFixture {
  return {
    fixture: {
      id: 1,
      date: "2026-08-01T18:00:00+00:00",
      timestamp: 0,
      venue: null,
      status: { long: "Not Started", short: "NS", elapsed: null },
      referee: null,
    },
    league: {
      id: overrides.leagueId,
      name: "League",
      country: overrides.country ?? "England",
      logo: "",
      flag: null,
      season: 2026,
      round: "Regular Season - 1",
    },
    teams: {
      home: { id: 1, name: overrides.home ?? "Team A", logo: "", winner: null },
      away: { id: 2, name: overrides.away ?? "Team B", logo: "", winner: null },
    },
    goals: { home: null, away: null },
    score: {
      halftime: { home: null, away: null },
      fulltime: { home: null, away: null },
      extratime: { home: null, away: null },
      penalty: { home: null, away: null },
    },
  } as ApiFixture;
}

describe("isIndexableFixture", () => {
  it("indexes Botola Pro 1", () => {
    expect(isIndexableFixture(fixture({ leagueId: 200, country: "Morocco" }))).toBe(true);
  });

  it("indexes the big-five European leagues", () => {
    for (const id of [39, 140, 135, 78, 61]) {
      expect(isIndexableFixture(fixture({ leagueId: id }))).toBe(true);
    }
  });

  it("indexes CAF and World Cup competitions", () => {
    for (const id of [1, 6, 12, 20]) {
      expect(isIndexableFixture(fixture({ leagueId: id }))).toBe(true);
    }
  });

  it("rejects the Austrian regional fixture that was polluting the index", () => {
    // The real case from the audit: Zwettl vs Schrems, Landesliga Niederösterreich —
    // ranked ahead of the newsroom's own journalism in site: queries.
    expect(
      isIndexableFixture(
        fixture({ leagueId: 9999, country: "Austria", home: "Zwettl", away: "Schrems" }),
      ),
    ).toBe(false);
  });

  it("indexes any competition hosted in Morocco regardless of league id", () => {
    expect(isIndexableFixture(fixture({ leagueId: 9999, country: "Morocco" }))).toBe(true);
  });

  it("indexes fixtures involving the Morocco national team", () => {
    expect(
      isIndexableFixture(fixture({ leagueId: 9999, country: "Qatar", home: "Morocco" })),
    ).toBe(true);
    expect(
      isIndexableFixture(fixture({ leagueId: 9999, country: "Qatar", away: "Morocco" })),
    ).toBe(true);
  });

  it("does not match clubs whose name merely starts with the country string", () => {
    // Guards the national-team regex against e.g. a club called "Moroccan Youth FC".
    expect(
      isIndexableFixture(fixture({ leagueId: 9999, country: "Spain", home: "Moroccans FC" })),
    ).toBe(false);
  });
});
