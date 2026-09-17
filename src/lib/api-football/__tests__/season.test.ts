import { describe, it, expect } from "vitest";
import { pickCurrentSeason, seasonYearFallback } from "@/lib/api-football/season";
import type { ApiLeagueInfo } from "@/lib/api-football/types";

function info(seasons: { year: number; current: boolean; start?: string; end?: string }[]): ApiLeagueInfo {
  return {
    league: { id: 1, name: "X", type: "Cup", logo: "" },
    country: { name: "World", code: null, flag: null },
    seasons: seasons.map((s) => ({
      year: s.year,
      start: s.start ?? `${s.year}-08-01`,
      end: s.end ?? `${s.year + 1}-05-31`,
      current: s.current,
    })),
  };
}

describe("pickCurrentSeason", () => {
  it("returns the season flagged current", () => {
    const r = pickCurrentSeason(info([{ year: 2024, current: false }, { year: 2025, current: true, start: "2025-08-09" }]), 2000);
    expect(r.season).toBe(2025);
    expect(r.start).toBe("2025-08-09");
  });

  it("falls back to max year when none flagged current", () => {
    const r = pickCurrentSeason(info([{ year: 2023, current: false }, { year: 2024, current: false }]), 2000);
    expect(r.season).toBe(2024);
  });

  it("falls back to the provided fallback when info is missing or empty", () => {
    expect(pickCurrentSeason(undefined, 2025)).toEqual({ season: 2025, start: null, end: null });
    expect(pickCurrentSeason(info([]), 2025).season).toBe(2025);
  });
});

describe("seasonYearFallback", () => {
  // API-Football names a season after its starting year; the leagues covered
  // here start in late summer.
  it("is the current year from July onward", () => {
    expect(seasonYearFallback(new Date("2026-09-17T00:00:00Z"))).toBe(2026);
    expect(seasonYearFallback(new Date("2026-07-01T00:00:00Z"))).toBe(2026);
  });

  it("is the previous year before July", () => {
    expect(seasonYearFallback(new Date("2027-03-01T00:00:00Z"))).toBe(2026);
    expect(seasonYearFallback(new Date("2026-06-30T23:59:59Z"))).toBe(2025);
  });
});
