import { describe, expect, it } from "vitest";
import { windowFixtures } from "../fixtureWindow";
import type { ApiFixture } from "../types";

function fx(id: number, short: string, timestamp: number): ApiFixture {
  return {
    fixture: { id, status: { short }, timestamp, date: new Date(timestamp * 1000).toISOString() },
    league: { id: 200 },
    teams: { home: { id: 1 }, away: { id: 2 } },
  } as unknown as ApiFixture;
}

describe("windowFixtures", () => {
  // A season: 10 finished, 2 live, 10 scheduled, 1 postponed, in shuffled order.
  const finished = Array.from({ length: 10 }, (_, i) => fx(100 + i, "FT", 1000 + i));
  const live = [fx(200, "1H", 2000), fx(201, "HT", 2001)];
  const scheduled = Array.from({ length: 10 }, (_, i) => fx(300 + i, "NS", 3000 + i));
  const postponed = fx(400, "PST", 2500);
  const season = [...scheduled.reverse(), postponed, ...live, ...finished.reverse()];

  it("keeps every live fixture, the last N results and the next M upcoming", () => {
    const out = windowFixtures(season, { last: 3, next: 2 });
    const ids = out.map((f) => f.fixture.id).sort((a, b) => a - b);
    expect(ids).toEqual([107, 108, 109, 200, 201, 300, 301]);
  });

  it("drops postponed / cancelled fixtures rather than listing them as results", () => {
    const out = windowFixtures(season, { last: 20, next: 20 });
    expect(out.map((f) => f.fixture.id)).not.toContain(400);
    expect(out).toHaveLength(22);
  });

  it("preserves the input order", () => {
    const out = windowFixtures(season, { last: 3, next: 2 });
    const positions = out.map((f) => season.indexOf(f));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("is a no-op on an empty season", () => {
    expect(windowFixtures([], { last: 5, next: 5 })).toEqual([]);
  });
});
