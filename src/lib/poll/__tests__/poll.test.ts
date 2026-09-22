import { describe, it, expect, vi, beforeEach } from "vitest";

// The store reaches Payload only for its drizzle handle; every test below
// injects a fake one, so the real config (and its env) is never needed.
vi.mock("@/lib/payload/queries", () => ({ getPayloadClient: vi.fn() }));

import {
  toPercentages, totalVotes, isPollChoice, castVote, readCounts, readVote,
  EMPTY_COUNTS, type PollDb,
} from "@/lib/poll/store";
import { isVotingOpen } from "@/lib/poll/voting";
import type { ApiFixture } from "@/lib/api-football/types";

/**
 * A fake `match_poll_votes` that enforces what the real table enforces: the
 * (fixture_id, voter_id) primary key, and the CHECK on `choice`. The SQL the
 * store builds is inspected rather than parsed — the statements themselves are
 * rehearsed against a real Neon branch, which is where the schema is proven.
 */
function fakeDb() {
  const rows: { fixture: number; voter: string; choice: string }[] = [];
  const db: PollDb & { rows: typeof rows; fail: boolean } = {
    rows,
    fail: false,
    async execute(query: unknown) {
      if (db.fail) throw new Error("connection terminated");
      // A drizzle template is an alternating list: {value: [sqlText]} chunks
      // and raw parameter values.
      const chunks = (query as { queryChunks: unknown[] }).queryChunks;
      let text = "";
      const params: unknown[] = [];
      for (const chunk of chunks) {
        const fragment = (chunk as { value?: unknown })?.value;
        if (Array.isArray(fragment)) text += fragment.join("");
        else params.push(chunk);
      }

      if (text.includes("INSERT INTO match_poll_votes")) {
        const [fixture, voter, choice] = params as [number, string, string];
        if (!["home", "draw", "away"].includes(choice)) {
          throw new Error('violates check constraint "match_poll_votes_choice_check"');
        }
        if (rows.some((r) => r.fixture === fixture && r.voter === voter)) return { rows: [] };
        rows.push({ fixture, voter, choice });
        return { rows: [{ choice }] };
      }
      if (text.includes("SELECT choice, count(*)")) {
        const fixture = params[0] as number;
        const counts = new Map<string, number>();
        for (const r of rows.filter((r) => r.fixture === fixture)) {
          counts.set(r.choice, (counts.get(r.choice) ?? 0) + 1);
        }
        return { rows: [...counts].map(([choice, n]) => ({ choice, n })) };
      }
      if (text.includes("SELECT choice FROM match_poll_votes")) {
        const [fixture, voter] = params as [number, string];
        const row = rows.find((r) => r.fixture === fixture && r.voter === voter);
        return { rows: row ? [{ choice: row.choice }] : [] };
      }
      throw new Error(`unexpected query: ${text.slice(0, 120)}`);
    },
  };
  return db;
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
  const A = "11111111-1111-1111-1111-111111111111";
  const B = "22222222-2222-2222-2222-222222222222";

  it("records one vote and counts only that choice", async () => {
    const db = fakeDb();
    const res = await castVote(1, A, "home", db);
    expect(res).toMatchObject({ status: "recorded", choice: "home", counts: { home: 1, draw: 0, away: 0 } });
    expect(db.rows).toHaveLength(1);
  });

  it("does not count a second vote from the same visitor, and reports the original choice", async () => {
    const db = fakeDb();
    await castVote(1, A, "home", db);
    const again = await castVote(1, A, "away", db);
    expect(again).toMatchObject({ status: "already-voted", choice: "home" });
    expect(await readCounts(1, db)).toEqual({ home: 1, draw: 0, away: 0 });
    expect(db.rows).toHaveLength(1);
  });

  it("counts different visitors separately and keeps fixtures apart", async () => {
    const db = fakeDb();
    await castVote(1, A, "home", db);
    await castVote(1, B, "draw", db);
    await castVote(2, A, "away", db);
    expect(await readCounts(1, db)).toEqual({ home: 1, draw: 1, away: 0 });
    expect(await readCounts(2, db)).toEqual({ home: 0, draw: 0, away: 1 });
  });

  it("reports unavailable instead of throwing when there is no database", async () => {
    expect(await castVote(1, A, "home", null)).toEqual({ status: "unavailable" });
    expect(await readCounts(1, null)).toBeNull();
    expect(await readVote(1, A, null)).toBeNull();
  });

  it("reports unavailable when the database throws", async () => {
    const db = fakeDb();
    db.fail = true;
    expect(await castVote(1, A, "home", db)).toEqual({ status: "unavailable" });
    expect(await readCounts(1, db)).toBeNull();
    expect(await readVote(1, A, db)).toBeNull();
  });

  it("never writes a choice the table's CHECK would reject", async () => {
    const db = fakeDb();
    // The route rejects this first; this proves the store does not smuggle it in.
    await expect(castVote(1, A, "win" as never, db)).resolves.toEqual({ status: "unavailable" });
    expect(db.rows).toHaveLength(0);
  });

  it("reads back nothing for a visitor who has not voted", async () => {
    const db = fakeDb();
    expect(await readVote(9, A, db)).toBeNull();
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
