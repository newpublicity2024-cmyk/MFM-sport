import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchApi = vi.fn();
vi.mock("@/lib/api-football/client", () => ({
  fetchApi: (...args: unknown[]) => fetchApi(...args),
}));
vi.mock("@/lib/cache", () => ({
  hasUpstash: () => false,
  cachedJson: (_k: string, _o: unknown, f: () => unknown) => f(),
}));

import { getTeamRecentFixtures, getFixturesByTeam } from "@/lib/api-football/fixtures";

beforeEach(() => fetchApi.mockReset().mockResolvedValue([]));

describe("getTeamRecentFixtures", () => {
  it("asks upstream for the team's last N fixtures with NO season, so early-season form reaches back", async () => {
    await getTeamRecentFixtures(968, 6);
    expect(fetchApi).toHaveBeenCalledTimes(1);
    const [endpoint, params] = fetchApi.mock.calls[0]!;
    expect(endpoint).toBe("/fixtures");
    expect(params).toEqual({ team: 968, last: 6 });
    expect(params).not.toHaveProperty("season");
  });

  it("is a different read from the season-bound getter the club page uses", async () => {
    await getFixturesByTeam(968, 2026, { last: 5 });
    expect(fetchApi.mock.calls[0]![1]).toEqual({ team: 968, season: 2026, last: 5 });
  });
});
