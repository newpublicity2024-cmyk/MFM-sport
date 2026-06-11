import { describe, it, expect, vi, beforeEach } from "vitest";
import { getFixturesByLeague } from "@/lib/api-football/fixtures";

vi.mock("@/lib/api-football/fixtures", () => ({
  getFixturesByLeague: vi.fn().mockResolvedValue([]),
}));

import {
  WORLD_CUP_LEAGUE_ID,
  WORLD_CUP_SEASON,
  getWorldCupFixtures,
  getAllWorldCupFixtures,
} from "@/lib/api-football/worldcup";

const mockGetFixturesByLeague = vi.mocked(getFixturesByLeague);

describe("world cup constants", () => {
  it("targets league 1, season 2026 (the 2026 World Cup)", () => {
    expect(WORLD_CUP_LEAGUE_ID).toBe(1);
    expect(WORLD_CUP_SEASON).toBe(2026);
  });
});

describe("world cup fixture fetchers", () => {
  beforeEach(() => mockGetFixturesByLeague.mockClear());

  it("getWorldCupFixtures requests the next 50 upcoming matches", async () => {
    await getWorldCupFixtures();
    expect(mockGetFixturesByLeague).toHaveBeenCalledWith(1, 2026, { next: 50 });
  });

  it("getAllWorldCupFixtures requests the whole season (no next/last filter)", async () => {
    await getAllWorldCupFixtures();
    expect(mockGetFixturesByLeague).toHaveBeenCalledWith(1, 2026);
  });
});
