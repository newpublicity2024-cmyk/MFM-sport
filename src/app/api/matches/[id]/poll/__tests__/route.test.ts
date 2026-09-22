import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ApiFixture } from "@/lib/api-football/types";

const getFixtureById = vi.fn();
const checkRateLimit = vi.fn();
const castVote = vi.fn();
const readCounts = vi.fn();
const readVote = vi.fn();
const cookieStore = { get: vi.fn(), set: vi.fn() };

vi.mock("@/lib/api-football/fixtures", () => ({ getFixtureById: (...a: unknown[]) => getFixtureById(...a) }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...a: unknown[]) => checkRateLimit(...a) }));
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));
vi.mock("@/lib/poll/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/poll/store")>();
  return {
    ...actual,
    castVote: (...a: unknown[]) => castVote(...a),
    readCounts: (...a: unknown[]) => readCounts(...a),
    readVote: (...a: unknown[]) => readVote(...a),
  };
});

import { GET, POST } from "@/app/api/matches/[id]/poll/route";

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const post = (body: unknown, id = "77") =>
  POST(new Request("https://x/api", { method: "POST", body: JSON.stringify(body) }), params(id));

function fixture(short: string, date: string): ApiFixture {
  return {
    fixture: { id: 77, date, timestamp: 0, venue: null, status: { long: "", short, elapsed: null }, referee: null },
    league: { id: 200, name: "Botola", country: "Morocco", logo: "", flag: null, season: 2026, round: "" },
    teams: { home: { id: 1, name: "H", logo: "", winner: null }, away: { id: 2, name: "A", logo: "", winner: null } },
    goals: { home: null, away: null },
    score: { halftime: { home: null, away: null }, fulltime: { home: null, away: null }, extratime: { home: null, away: null }, penalty: { home: null, away: null } },
  };
}
const FUTURE = new Date(Date.now() + 3 * 3600_000).toISOString();

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimit.mockResolvedValue({ success: true });
  readCounts.mockResolvedValue({ home: 2, draw: 1, away: 1 });
  readVote.mockResolvedValue(null);
  cookieStore.get.mockReturnValue(undefined);
  getFixtureById.mockResolvedValue(fixture("NS", FUTURE));
  castVote.mockResolvedValue({ status: "recorded", choice: "home", counts: { home: 3, draw: 1, away: 1 } });
});

describe("GET", () => {
  it("returns counts, percentages summing to 100 and a total", async () => {
    const res = await GET(new Request("https://x"), params("77"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.available).toBe(true);
    expect(body.counts).toEqual({ home: 2, draw: 1, away: 1 });
    expect(body.percentages.home + body.percentages.draw + body.percentages.away).toBe(100);
    expect(body.total).toBe(4);
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("says unavailable (not an error) when there is no store", async () => {
    readCounts.mockResolvedValue(null);
    const body = await (await GET(new Request("https://x"), params("77"))).json();
    expect(body).toMatchObject({ available: false });
  });

  it("400s on a non-numeric id", async () => {
    expect((await GET(new Request("https://x"), params("abc"))).status).toBe(400);
  });
});

describe("POST", () => {
  it("records a valid vote and sets a first-party voter cookie", async () => {
    const res = await post({ choice: "home" });
    expect(res.status).toBe(200);
    expect(castVote).toHaveBeenCalledWith(77, expect.any(String), "home");
    const [, opts] = cookieStore.set.mock.calls[0] ?? [];
    expect(res.cookies.get("mfm_voter")?.value).toBeTruthy();
    void opts;
    const body = await res.json();
    expect(body.myVote).toBe("home");
    expect(body.recorded).toBe(true);
  });

  it("reuses an existing voter cookie instead of minting a new one", async () => {
    cookieStore.get.mockReturnValue({ value: "voter-1" });
    const res = await post({ choice: "draw" });
    expect(castVote).toHaveBeenCalledWith(77, "voter-1", "draw");
    expect(res.cookies.get("mfm_voter")).toBeUndefined();
  });

  it("rejects an invalid choice without touching the store", async () => {
    for (const bad of [{ choice: "win" }, { choice: 1 }, {}, { choice: null }]) {
      const res = await post(bad);
      expect(res.status).toBe(400);
    }
    expect(castVote).not.toHaveBeenCalled();
    expect(getFixtureById).not.toHaveBeenCalled();
  });

  it("rejects a malformed body", async () => {
    const res = await POST(new Request("https://x/api", { method: "POST", body: "not json" }), params("77"));
    expect(res.status).toBe(400);
    expect(castVote).not.toHaveBeenCalled();
  });

  it("409s once the match has kicked off, and records nothing", async () => {
    getFixtureById.mockResolvedValue(fixture("1H", new Date(Date.now() - 3600_000).toISOString()));
    const res = await post({ choice: "home" });
    expect(res.status).toBe(409);
    expect(castVote).not.toHaveBeenCalled();
    // The reader still gets the standings of the vote.
    expect((await res.json()).counts).toEqual({ home: 2, draw: 1, away: 1 });
  });

  it("409s for a scheduled match whose kick-off time has passed", async () => {
    getFixtureById.mockResolvedValue(fixture("NS", new Date(Date.now() - 60_000).toISOString()));
    expect((await post({ choice: "home" })).status).toBe(409);
    expect(castVote).not.toHaveBeenCalled();
  });

  it("404s for a fixture that does not exist", async () => {
    getFixtureById.mockResolvedValue(null);
    expect((await post({ choice: "home" })).status).toBe(404);
  });

  it("429s when the rate limiter says so, before reading the fixture", async () => {
    checkRateLimit.mockResolvedValue({ success: false });
    expect((await post({ choice: "home" })).status).toBe(429);
    expect(getFixtureById).not.toHaveBeenCalled();
  });

  it("503s when the store is unavailable", async () => {
    castVote.mockResolvedValue({ status: "unavailable" });
    const res = await post({ choice: "home" });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ available: false });
  });

  it("does not double-count a repeat vote", async () => {
    cookieStore.get.mockReturnValue({ value: "voter-1" });
    castVote.mockResolvedValue({ status: "already-voted", choice: "home", counts: { home: 3, draw: 1, away: 1 } });
    const body = await (await post({ choice: "away" })).json();
    expect(body.myVote).toBe("home");
    expect(body.recorded).toBe(false);
    expect(body.counts).toEqual({ home: 3, draw: 1, away: 1 });
  });
});
