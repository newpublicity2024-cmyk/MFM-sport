import type { ApiFixture, ApiStandingRow } from "@/lib/api-football/types";

/** A finished fixture. League 200 (Botola) is indexable; 999 is not. */
export function makeFixture(
  over: {
    id?: number;
    homeId?: number;
    awayId?: number;
    home?: number | null;
    away?: number | null;
    status?: string;
    leagueId?: number;
    date?: string;
    ts?: number;
  } = {},
): ApiFixture {
  const {
    id = 1, homeId = 968, awayId = 967, home = 1, away = 0, status = "FT",
    leagueId = 200, date = "2026-09-01T18:00:00+00:00", ts = 1,
  } = over;
  return {
    fixture: { id, date, timestamp: ts, venue: null, status: { long: "", short: status, elapsed: null }, referee: null },
    league: { id: leagueId, name: leagueId === 200 ? "Botola Pro" : "Some Cup", country: leagueId === 200 ? "Morocco" : "Elsewhere", logo: "/l.png", flag: null, season: 2026, round: "Regular Season - 1" },
    teams: {
      home: { id: homeId, name: `Team ${homeId}`, logo: "/h.png", winner: home != null && away != null ? home > away : null },
      away: { id: awayId, name: `Team ${awayId}`, logo: "/a.png", winner: home != null && away != null ? away > home : null },
    },
    goals: { home, away },
    score: { halftime: { home: null, away: null }, fulltime: { home, away }, extratime: { home: null, away: null }, penalty: { home: null, away: null } },
  };
}

export function makeRow(rank: number, teamId = rank * 100): ApiStandingRow {
  return {
    rank,
    team: { id: teamId, name: `Team ${rank}`, logo: "/t.png" },
    points: 60 - rank,
    goalsDiff: 10 - rank,
    group: "Botola Pro",
    form: "WDLWW",
    status: "same",
    description: null,
    all: { played: 10, win: 3, draw: 3, lose: 4, goals: { for: 10, against: 10 } },
  };
}

/** Physical-direction classes that break under dir="rtl"; logical ones (ms-, ps-, text-start) are fine. */
export const PHYSICAL_DIRECTION = /\b(?:left|right|text-left|text-right|ml-\d|mr-\d|pl-\d|pr-\d|float-left|float-right)\b/;
