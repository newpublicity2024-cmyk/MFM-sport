import { describe, it, expect, vi, beforeEach } from "vitest";

const getFixturesByDateForLeagues = vi.fn();
const getOurLeagueIds = vi.fn();
vi.mock("@/lib/api-football/fixtures", () => ({
  getFixturesByDateForLeagues: (...a: unknown[]) => getFixturesByDateForLeagues(...a),
}));
vi.mock("@/lib/payload/queries", () => ({
  getOurLeagueIds: () => getOurLeagueIds(),
}));

import { GET, isValidIsoDate } from "@/app/api/fixtures/date/route";

beforeEach(() => {
  getFixturesByDateForLeagues.mockReset();
  getOurLeagueIds.mockReset().mockResolvedValue([200, 39]);
});

describe("isValidIsoDate", () => {
  it("accepts a real calendar date and rejects shapes and impossible days", () => {
    expect(isValidIsoDate("2026-09-17")).toBe(true);
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("17-09-2026")).toBe(false);
    expect(isValidIsoDate(null)).toBe(false);
    expect(isValidIsoDate("2026-09-17T00:00:00Z")).toBe(false);
  });
});

describe("GET /api/fixtures/date", () => {
  it("400s on a missing or malformed date without touching upstream", async () => {
    expect((await GET(new Request("http://x/api/fixtures/date"))).status).toBe(400);
    expect((await GET(new Request("http://x/api/fixtures/date?date=2026-13-01"))).status).toBe(400);
    expect(getFixturesByDateForLeagues).not.toHaveBeenCalled();
  });

  it("returns that day's fixtures scoped to the site's leagues", async () => {
    getFixturesByDateForLeagues.mockResolvedValue([{ fixture: { id: 1 } }]);
    const res = await GET(new Request("http://x/api/fixtures/date?date=2026-09-20"));
    expect(res.status).toBe(200);
    expect(getFixturesByDateForLeagues).toHaveBeenCalledWith("2026-09-20", [200, 39]);
    expect(await res.json()).toEqual({ fixtures: [{ fixture: { id: 1 } }] });
  });
});
