import { describe, it, expect } from "vitest";
import { pickCurrentSeason } from "@/lib/api-football/season";
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
