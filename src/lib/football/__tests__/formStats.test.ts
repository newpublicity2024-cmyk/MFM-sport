import { describe, it, expect } from "vitest";
import type { ApiFixture } from "@/lib/api-football/types";
import { formStats, h2hSummary, resultFor, goalsFor } from "../formStats";

const NC = 1; // "Nueva Chicago"
const PAT = 2; // "Patronato"

function fx(
  homeId: number,
  awayId: number,
  home: number | null,
  away: number | null,
  status = "FT",
  ts = 1,
): ApiFixture {
  return {
    fixture: { id: ts, date: "2026-09-01T00:00:00Z", timestamp: ts, venue: null, status: { long: "", short: status, elapsed: null }, referee: null },
    league: { id: 1, name: "L", country: "Argentina", logo: "/l.png", flag: null, season: 2026, round: "" },
    teams: { home: { id: homeId, name: `T${homeId}`, logo: "/h.png", winner: null }, away: { id: awayId, name: `T${awayId}`, logo: "/a.png", winner: null } },
    goals: { home, away },
    score: { halftime: { home: null, away: null }, fulltime: { home, away }, extratime: { home: null, away: null }, penalty: { home: null, away: null } },
  };
}

// Patronato's last five as Kooora rendered them (kooora2.png): 0-0, 0-0,
// 0-1 (L), 2-0 (W), 3-3 (D). They scored in two of them; Kooora's stat row
// said 5/4.
const PATRONATO_LAST_5 = [
  fx(PAT, 9, 0, 0),
  fx(8, PAT, 0, 0),
  fx(PAT, 7, 0, 1),
  fx(PAT, 6, 2, 0),
  fx(PAT, 5, 3, 3),
];

describe("formStats", () => {
  it("counts from exactly the rendered fixtures — Kooora's 5/4 becomes 2/5", () => {
    expect(formStats(PATRONATO_LAST_5, PAT)).toEqual({ scoredIn: 2, over25: 1, bothScored: 1, total: 5 });
  });

  it("never lets a numerator exceed the denominator", () => {
    const s = formStats(PATRONATO_LAST_5, PAT);
    for (const k of ["scoredIn", "over25", "bothScored"] as const) expect(s[k]).toBeLessThanOrEqual(s.total);
  });

  it("drops fixtures without a final score from the denominator", () => {
    const withPostponed = [...PATRONATO_LAST_5, fx(PAT, 4, null, null, "PST"), fx(PAT, 3, 1, 0, "1H")];
    expect(formStats(withPostponed, PAT).total).toBe(5);
  });

  it("reads the team's goals from whichever side it played", () => {
    expect(goalsFor(fx(PAT, 9, 2, 1), PAT)).toEqual({ scored: 2, conceded: 1 });
    expect(goalsFor(fx(9, PAT, 2, 1), PAT)).toEqual({ scored: 1, conceded: 2 });
    expect(goalsFor(fx(8, 9, 2, 1), PAT)).toBeNull();
  });

  it("is all zeros with total 0 for an empty list", () => {
    expect(formStats([], PAT)).toEqual({ scoredIn: 0, over25: 0, bothScored: 0, total: 0 });
  });
});

describe("resultFor", () => {
  it("returns W/D/L from the team's perspective and null without a final score", () => {
    expect(resultFor(fx(PAT, 9, 2, 0), PAT)).toBe("W");
    expect(resultFor(fx(9, PAT, 2, 0), PAT)).toBe("L");
    expect(resultFor(fx(9, PAT, 1, 1), PAT)).toBe("D");
    expect(resultFor(fx(9, PAT, null, null, "NS"), PAT)).toBeNull();
    expect(resultFor(fx(9, PAT, 1, 0, "2H"), PAT)).toBeNull();
  });

  it("treats AET and PEN as final scores", () => {
    expect(resultFor(fx(PAT, 9, 2, 1, "AET"), PAT)).toBe("W");
    expect(resultFor(fx(PAT, 9, 1, 1, "PEN"), PAT)).toBe("D");
  });
});

describe("h2hSummary", () => {
  // Kooora's five meetings (kooora2.png): NC wins 2, draws 2, PAT wins 1; goals 6–3.
  const meetings = [
    fx(PAT, NC, 1, 2, "FT", 5), // NC away win
    fx(NC, PAT, 1, 1, "FT", 4),
    fx(PAT, NC, 0, 0, "FT", 3),
    fx(NC, PAT, 2, 0, "FT", 2), // NC home win
    fx(PAT, NC, 2, 0, "FT", 1), // PAT home win
  ];

  it("counts per team, not per home/away, and sums goals", () => {
    expect(h2hSummary(meetings, NC, PAT)).toEqual({ winsA: 2, draws: 2, winsB: 1, goalsA: 5, goalsB: 4, total: 5 });
  });

  it("counters always sum to the meetings with a final score", () => {
    const s = h2hSummary([...meetings, fx(NC, PAT, null, null, "PST")], NC, PAT);
    expect(s.winsA + s.draws + s.winsB).toBe(s.total);
    expect(s.total).toBe(5);
  });

  it("swaps symmetrically when the teams are given in the other order", () => {
    const ab = h2hSummary(meetings, NC, PAT);
    const ba = h2hSummary(meetings, PAT, NC);
    expect(ba).toEqual({ winsA: ab.winsB, draws: ab.draws, winsB: ab.winsA, goalsA: ab.goalsB, goalsB: ab.goalsA, total: ab.total });
  });
});
