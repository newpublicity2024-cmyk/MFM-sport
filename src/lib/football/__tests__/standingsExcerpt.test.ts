import { describe, it, expect } from "vitest";
import type { ApiStandingRow } from "@/lib/api-football/types";
import { pickGroup, windowRows, standingsExcerpt, isGapRow } from "../standingsExcerpt";

function row(rank: number, teamId = rank * 100, group = "Group A"): ApiStandingRow {
  return {
    rank,
    team: { id: teamId, name: `Team ${rank}`, logo: "/t.png" },
    points: 60 - rank,
    goalsDiff: 0,
    group,
    form: "WDLWW",
    status: "same",
    description: null,
    all: { played: 10, win: 3, draw: 3, lose: 4, goals: { for: 10, against: 10 } },
  };
}
const table = (n: number) => Array.from({ length: n }, (_, i) => row(i + 1));
const ranks = (rows: ReturnType<typeof windowRows>) =>
  rows.map((r) => (isGapRow(r) ? "…" : r.rank));

describe("windowRows", () => {
  it("Kooora's case: ranks 15 and 16 in an 18-team table give rows 13–18", () => {
    expect(ranks(windowRows(table(18), 15, 16))).toEqual([13, 14, 15, 16, 17, 18]);
  });

  it("centres a six-row window on two nearby mid-table teams", () => {
    expect(ranks(windowRows(table(20), 8, 10))).toEqual([6, 7, 8, 9, 10, 11]);
  });

  it("clamps at the top and keeps six rows", () => {
    expect(ranks(windowRows(table(16), 1, 2))).toEqual([1, 2, 3, 4, 5, 6]);
    expect(ranks(windowRows(table(16), 2, 3))).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("clamps at the bottom and keeps six rows", () => {
    expect(ranks(windowRows(table(16), 15, 16))).toEqual([11, 12, 13, 14, 15, 16]);
  });

  it("shows two triplets with a gap when the teams are far apart", () => {
    expect(ranks(windowRows(table(20), 2, 15))).toEqual([1, 2, 3, "…", 14, 15, 16]);
  });

  it("clamps the triplets at the edges of the table", () => {
    expect(ranks(windowRows(table(20), 1, 20))).toEqual([1, 2, 3, "…", 18, 19, 20]);
  });

  it("merges triplets that would touch instead of drawing an empty gap", () => {
    // 4 → rows 3–5, 8 → rows 7–9: 6 is the only row between → contiguous run.
    expect(ranks(windowRows(table(20), 4, 8))).toEqual([3, 4, 5, 6, 7, 8, 9]);
  });

  it("returns the whole group when it has six rows or fewer", () => {
    expect(ranks(windowRows(table(4), 1, 4))).toEqual([1, 2, 3, 4]);
    expect(ranks(windowRows(table(6), 1, 6))).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("does not depend on the API's array order", () => {
    const shuffled = [...table(18)].reverse();
    expect(ranks(windowRows(shuffled, 15, 16))).toEqual([13, 14, 15, 16, 17, 18]);
  });

  it("accepts the two ranks in either order", () => {
    expect(ranks(windowRows(table(18), 16, 15))).toEqual(ranks(windowRows(table(18), 15, 16)));
  });
});

describe("pickGroup", () => {
  it("returns the group holding both teams", () => {
    const a = [row(1, 11, "A"), row(2, 12, "A"), row(3, 13, "A")];
    const b = [row(1, 21, "B"), row(2, 22, "B"), row(3, 23, "B")];
    expect(pickGroup([a, b], 22, 21)).toBe(b);
  });

  it("returns null when the teams are in different groups", () => {
    const a = [row(1, 11, "A"), row(2, 12, "A")];
    const b = [row(1, 21, "B"), row(2, 22, "B")];
    expect(pickGroup([a, b], 11, 21)).toBeNull();
  });

  it("returns null when there is no table at all", () => {
    expect(pickGroup([], 1, 2)).toBeNull();
  });
});

describe("standingsExcerpt", () => {
  it("windows the picked group around the two teams", () => {
    const res = standingsExcerpt([table(18)], 1500, 1600);
    expect(res).not.toBeNull();
    expect(ranks(res!.rows)).toEqual([13, 14, 15, 16, 17, 18]);
    expect(res!.group).toHaveLength(18);
  });

  it("is null for a cup with no table", () => {
    expect(standingsExcerpt([], 1, 2)).toBeNull();
  });
});
