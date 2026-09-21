import type { ApiFixture } from "@/lib/api-football/types";
import { hasFinalScore } from "@/lib/api-football/status";

export type Result = "W" | "D" | "L";

/** Goals for and against `teamId` in a fixture, or null when it has no final score. */
export function goalsFor(fixture: ApiFixture, teamId: number): { scored: number; conceded: number } | null {
  if (!hasFinalScore(fixture.fixture.status.short)) return null;
  const { home, away } = fixture.goals;
  if (home == null || away == null) return null;
  if (fixture.teams.home.id === teamId) return { scored: home, conceded: away };
  if (fixture.teams.away.id === teamId) return { scored: away, conceded: home };
  return null;
}

export function resultFor(fixture: ApiFixture, teamId: number): Result | null {
  const g = goalsFor(fixture, teamId);
  if (!g) return null;
  if (g.scored > g.conceded) return "W";
  if (g.scored < g.conceded) return "L";
  return "D";
}

export type FormStats = {
  /** Matches in which the team scored at least once. */
  scoredIn: number;
  /** Matches with three or more goals in total. */
  over25: number;
  /** Matches in which both teams scored. */
  bothScored: number;
  /** Denominator: the rendered fixtures that have a final score. */
  total: number;
};

/**
 * The three "x/N" rows under a team's recent results, computed from exactly
 * the fixtures the list renders. Kooora's card showed "scored in 5/4" above a
 * list in which the team had scored twice — the number and the list came from
 * different queries. Here they cannot disagree: one input, one pass.
 */
export function formStats(fixtures: ApiFixture[], teamId: number): FormStats {
  const stats: FormStats = { scoredIn: 0, over25: 0, bothScored: 0, total: 0 };
  for (const fx of fixtures) {
    const g = goalsFor(fx, teamId);
    if (!g) continue;
    stats.total += 1;
    if (g.scored > 0) stats.scoredIn += 1;
    if (g.scored + g.conceded > 2) stats.over25 += 1;
    if (g.scored > 0 && g.conceded > 0) stats.bothScored += 1;
  }
  return stats;
}

export type H2HSummary = {
  winsA: number;
  draws: number;
  winsB: number;
  goalsA: number;
  goalsB: number;
  /** Meetings with a final score — the counters always sum to this. */
  total: number;
};

/**
 * Per-team counters over a head-to-head list: wins for A, draws, wins for B,
 * and aggregate goals — regardless of which side was at home in each meeting.
 */
export function h2hSummary(fixtures: ApiFixture[], teamA: number, teamB: number): H2HSummary {
  const s: H2HSummary = { winsA: 0, draws: 0, winsB: 0, goalsA: 0, goalsB: 0, total: 0 };
  for (const fx of fixtures) {
    const a = goalsFor(fx, teamA);
    const b = goalsFor(fx, teamB);
    if (!a || !b) continue;
    s.total += 1;
    s.goalsA += a.scored;
    s.goalsB += b.scored;
    if (a.scored > b.scored) s.winsA += 1;
    else if (a.scored < b.scored) s.winsB += 1;
    else s.draws += 1;
  }
  return s;
}
