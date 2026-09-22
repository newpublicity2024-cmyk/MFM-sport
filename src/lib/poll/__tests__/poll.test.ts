import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  toPercentages, totalVotes, isPollChoice, castVote, readCounts, readVote,
  countsKey, voterKey, EMPTY_COUNTS, type PollRedis,
} from "@/lib/poll/store";
import { isVotingOpen } from "@/lib/poll/voting";
import type { ApiFixture } from "@/lib/api-football/types";

function fakeRedis(): PollRedis & { store: Map<string, unknown>; hashes: Map<string, Record<string, number>> } {
  const store = new Map<string, unknown>();
  const hashes = new Map<string, Record<string, number>>();
  return {
    store,
    hashes,
    async hgetall(key) {
      return hashes.get(key) ?? null;
    },
    async hincrby(key, field, by) {
      const h = hashes.get(key) ?? {};
      h[field] = (h[field] ?? 0) + by;
      hashes.set(key, h);
      return h[field]!;
    },
    async get(key) {
      return store.get(key) ?? null;
    },
    async set(key, value, opts) {
      if (opts?.nx && store.has(key)) return null;
      store.set(key, value);
      return "OK";
    },
  };
}

describe("toPercentages", () => {
  it("always sums to 100", () => {
    for (const counts of [
      { home: 1, draw: 1, away: 1 },
      { home: 2, draw: 1, away: 0 },
      { home: 7, draw: 11, away: 13 },
      { home: 1, draw: 0, away: 0 },
      { home: 99, draw: 1, away: 1 },
    ]) {
      const p = toPercentages(counts);
      expect(p.home + p.draw + p.away, JSON.stringify(counts)).toBe(100);
    }
  });

  it("is all zeros with no votes, so the UI can tell 'nobody voted' from a real 0%", () => {
    expect(toPercentages(EMPTY_COUNTS)).toEqual({ home: 0, draw: 0, away: 0 });
    expect(totalVotes(EMPTY_COUNTS)).toBe(0);
  });

  it("keeps the order of the raw counts", () => {
    const p = toPercentages({ home: 60, draw: 30, away: 10 });
    expect(p.home).toBeGreaterThan(p.draw);
    expect(p.draw).toBeGreaterThan(p.away);
  });
});

describe("isPollChoice", () => {
  it("accepts only the three choices", () => {
    expect(["home", "draw", "away"].every(isPollChoice)).toBe(true);
    for (const bad of ["Home", "win", "", null, 1, {}, ["home"]]) expect(isPollChoice(bad)).toBe(false);
  });
});

describe("castVote", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));

  it("records one vote and increments only that choice", async () => {
    const r = fakeRedis();
    const res = await castVote(1, "voter-a", "home", r);
    expect(res).toMatchObject({ status: "recorded", choice: "home", counts: { home: 1, draw: 0, away: 0 } });
    expect(r.store.get(voterKey(1, "voter-a"))).toBe("home");
    expect(r.hashes.get(countsKey(1))).toEqual({ home: 1 });
  });

  it("does not count a second vote from the same visitor, and reports the original choice", async () => {
    const r = fakeRedis();
    await castVote(1, "voter-a", "home", r);
    const again = await castVote(1, "voter-a", "away", r);
    expect(again).toMatchObject({ status: "already-voted", choice: "home" });
    expect(await readCounts(1, r)).toEqual({ home: 1, draw: 0, away: 0 });
  });

  it("counts different visitors separately and keeps fixtures apart", async () => {
    const r = fakeRedis();
    await castVote(1, "a", "home", r);
    await castVote(1, "b", "draw", r);
    await castVote(2, "a", "away", r);
    expect(await readCounts(1, r)).toEqual({ home: 1, draw: 1, away: 0 });
    expect(await readCounts(2, r)).toEqual({ home: 0, draw: 0, away: 1 });
  });

  it("reports unavailable instead of throwing when there is no store", async () => {
    expect(await castVote(1, "a", "home", null)).toEqual({ status: "unavailable" });
    expect(await readCounts(1, null)).toBeNull();
    expect(await readVote(1, "a", null)).toBeNull();
  });

  it("reports unavailable when Redis throws", async () => {
    const broken: PollRedis = {
      hgetall: async () => { throw new Error("down"); },
      hincrby: async () => { throw new Error("down"); },
      get: async () => { throw new Error("down"); },
      set: async () => { throw new Error("down"); },
    };
    expect(await castVote(1, "a", "home", broken)).toEqual({ status: "unavailable" });
    expect(await readCounts(1, broken)).toBeNull();
  });

  it("ignores junk stored under a voter key", async () => {
    const r = fakeRedis();
    r.store.set(voterKey(9, "a"), "not-a-choice");
    expect(await readVote(9, "a", r)).toBeNull();
  });
});

describe("isVotingOpen", () => {
  const fixture = (short: string, date: string): ApiFixture =>
    ({ fixture: { id: 1, date, timestamp: 0, venue: null, status: { long: "", short, elapsed: null }, referee: null },
       league: { id: 200, name: "", country: "", logo: "", flag: null, season: 2026, round: "" },
       teams: { home: { id: 1, name: "", logo: "", winner: null }, away: { id: 2, name: "", logo: "", winner: null } },
       goals: { home: null, away: null },
       score: { halftime: { home: null, away: null }, fulltime: { home: null, away: null }, extratime: { home: null, away: null }, penalty: { home: null, away: null } } }) as ApiFixture;
  const now = new Date("2026-09-22T12:00:00Z");

  it("is open before kick-off on a scheduled match", () => {
    expect(isVotingOpen(fixture("NS", "2026-09-22T18:00:00Z"), now)).toBe(true);
  });

  it("closes at kick-off even while the status still says NS", () => {
    expect(isVotingOpen(fixture("NS", "2026-09-22T11:59:00Z"), now)).toBe(false);
    expect(isVotingOpen(fixture("NS", "2026-09-22T12:00:00Z"), now)).toBe(false);
  });

  it("is closed once the match is live, finished or off", () => {
    for (const s of ["1H", "HT", "FT", "AET", "PEN", "PST", "CANC", "ABD", "AWD"]) {
      expect(isVotingOpen(fixture(s, "2026-09-22T18:00:00Z"), now), s).toBe(false);
    }
  });

  it("stays open for a fixture whose time is not yet confirmed", () => {
    expect(isVotingOpen(fixture("TBD", "2026-09-22T00:00:00Z"), now)).toBe(true);
  });
});
