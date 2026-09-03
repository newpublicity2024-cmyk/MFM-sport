import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-football/fixtures", () => ({
  getFixturesByLeague: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/api-football/season", () => ({
  getCurrentSeason: vi.fn(),
}));

import { getFixturesByLeague } from "@/lib/api-football/fixtures";
import { getCurrentSeason } from "@/lib/api-football/season";
import { resolveSeason, getCompetitionFixtures } from "@/lib/api-football/competition";

const mockFixtures = vi.mocked(getFixturesByLeague);
const mockSeason = vi.mocked(getCurrentSeason);

const BOTOLA = { apiFootballId: 200, season: 2024 };

beforeEach(() => {
  mockFixtures.mockClear();
  mockSeason.mockReset();
});

describe("resolveSeason", () => {
  it("uses the season API-Football flags as current, not the doc's", () => {
    mockSeason.mockResolvedValue({ season: 2026, start: null, end: null });
    return expect(resolveSeason(BOTOLA)).resolves.toBe(2026);
  });

  it("passes the doc's season as the upstream fallback", async () => {
    mockSeason.mockResolvedValue({ season: 2024, start: null, end: null });
    await resolveSeason(BOTOLA);
    expect(mockSeason).toHaveBeenCalledWith(200, 2024);
  });
});

describe("getCompetitionFixtures", () => {
  it("queries the resolved season, not the configured one", async () => {
    mockSeason.mockResolvedValue({ season: 2026, start: null, end: null });
    await getCompetitionFixtures(BOTOLA);
    expect(mockFixtures).toHaveBeenCalledWith(200, 2026);
  });

  it("omits the options argument entirely when none are given", async () => {
    // Arity matters: getFixturesByLeague is React cache()d, and a trailing
    // `undefined` is a different cache key from an absent third argument.
    mockSeason.mockResolvedValue({ season: 2026, start: null, end: null });
    await getCompetitionFixtures(BOTOLA);
    expect(mockFixtures.mock.calls[0]).toHaveLength(2);
  });

  it("forwards next/last through to the fixtures getter", async () => {
    mockSeason.mockResolvedValue({ season: 2026, start: null, end: null });
    await getCompetitionFixtures(BOTOLA, { next: 50 });
    expect(mockFixtures).toHaveBeenCalledWith(200, 2026, { next: 50 });
  });
});
