import type { ApiStandingRow } from "@/lib/api-football/types";

/** How many rows the excerpt shows when the two teams are near each other. */
export const EXCERPT_ROWS = 6;

export type ExcerptRow = ApiStandingRow | { gap: true };

export function isGapRow(row: ExcerptRow): row is { gap: true } {
  return "gap" in row;
}

/**
 * The group both teams belong to, or null when they are in different groups
 * (a knockout draw across groups) or the competition has no table at all.
 * Showing one team's group with the other absent would mislead more than it
 * informs, so the caller hides the block.
 */
export function pickGroup(
  groups: ApiStandingRow[][],
  homeTeamId: number,
  awayTeamId: number,
): ApiStandingRow[] | null {
  for (const group of groups) {
    const ids = new Set(group.map((r) => r.team.id));
    if (ids.has(homeTeamId) && ids.has(awayTeamId)) return group;
  }
  return null;
}

/**
 * The rows to show around two ranks.
 *
 * Close together (three places or fewer apart): a six-row window centred on
 * them, shifted rather than shrunk when it hits the top or bottom of the
 * table — Kooora's 15 v 16 becomes rows 13–18, and a 1 v 2 becomes 1–6.
 * Far apart: each team with its immediate neighbours, and a gap marker
 * between the two triplets so the reader knows rows were skipped.
 *
 * Works on positions within the group (1-based `rank`), not on array indexes,
 * because a group's ranks are contiguous but an API group is not guaranteed
 * to be sorted.
 */
export function windowRows(
  rows: ApiStandingRow[],
  rankA: number,
  rankB: number,
): ExcerptRow[] {
  const sorted = [...rows].sort((a, b) => a.rank - b.rank);
  const n = sorted.length;
  if (n === 0) return [];
  const byRank = (r: number) => sorted[r - 1]!;
  const hi = Math.min(rankA, rankB);
  const lo = Math.max(rankA, rankB);

  if (n <= EXCERPT_ROWS) return sorted;

  if (lo - hi <= 3) {
    let start = hi - 2;
    let end = start + EXCERPT_ROWS - 1;
    if (start < 1) {
      start = 1;
      end = EXCERPT_ROWS;
    }
    if (end > n) {
      end = n;
      start = n - EXCERPT_ROWS + 1;
    }
    const out: ExcerptRow[] = [];
    for (let r = start; r <= end; r++) out.push(byRank(r));
    return out;
  }

  const triplet = (centre: number): ApiStandingRow[] => {
    const start = Math.max(1, Math.min(centre - 1, n - 2));
    return [byRank(start), byRank(start + 1), byRank(start + 2)];
  };
  const top = triplet(hi);
  const bottom = triplet(lo);
  const lastTop = top[top.length - 1]!.rank;
  const firstBottom = bottom[0]!.rank;
  if (firstBottom <= lastTop + 2) {
    // The triplets touch, overlap, or skip a single row: a gap marker would
    // stand in for at most one row, so show the run instead.
    const out: ExcerptRow[] = [];
    for (let r = top[0]!.rank; r <= bottom[bottom.length - 1]!.rank; r++) out.push(byRank(r));
    return out;
  }
  return [...top, { gap: true }, ...bottom];
}

/**
 * The excerpt for a fixture, or null when there is nothing honest to show:
 * no table, the two teams in different groups, or a table nobody has played
 * in yet — before round one the API returns every row at zero, and six rows
 * of zeros tell the reader nothing.
 */
export function standingsExcerpt(
  groups: ApiStandingRow[][],
  homeTeamId: number,
  awayTeamId: number,
): { rows: ExcerptRow[]; group: ApiStandingRow[] } | null {
  const group = pickGroup(groups, homeTeamId, awayTeamId);
  if (!group) return null;
  if (!group.some((r) => r.all.played > 0)) return null;
  const rankOf = (id: number) => group.find((r) => r.team.id === id)!.rank;
  return { rows: windowRows(group, rankOf(homeTeamId), rankOf(awayTeamId)), group };
}
