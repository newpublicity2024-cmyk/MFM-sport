// API-Football response wrapper
export type ApiResponse<T> = {
  get: string;
  parameters: Record<string, string>;
  errors: any[];
  results: number;
  paging: { current: number; total: number };
  response: T;
};

export type ApiFixture = {
  fixture: {
    id: number;
    date: string;
    timestamp: number;
    venue: { id: number | null; name: string | null; city: string | null } | null;
    status: { long: string; short: string; elapsed: number | null };
    referee: string | null;
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
    season: number;
    round: string;
  };
  teams: {
    home: { id: number; name: string; logo: string; winner: boolean | null };
    away: { id: number; name: string; logo: string; winner: boolean | null };
  };
  goals: { home: number | null; away: number | null };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
    extratime: { home: number | null; away: number | null };
    penalty: { home: number | null; away: number | null };
  };
  events?: ApiEvent[];
  lineups?: ApiLineup[];
  statistics?: ApiTeamStatistics[];
};

export type ApiEvent = {
  time: { elapsed: number; extra: number | null };
  team: { id: number; name: string; logo: string };
  player: { id: number; name: string };
  assist: { id: number | null; name: string | null };
  type: string;
  detail: string;
  comments: string | null;
};

export type ApiLineup = {
  team: { id: number; name: string; logo: string; colors: any };
  formation: string;
  startXI: { player: { id: number; name: string; number: number; pos: string } }[];
  substitutes: { player: { id: number; name: string; number: number; pos: string } }[];
  coach: { id: number | null; name: string | null; photo: string | null };
};

export type ApiTeamStatistics = {
  team: { id: number; name: string; logo: string };
  statistics: { type: string; value: number | string | null }[];
};

export type ApiStandingRow = {
  rank: number;
  team: { id: number; name: string; logo: string };
  points: number;
  goalsDiff: number;
  group: string;
  form: string | null;
  status: string;
  description: string | null;
  all: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: { for: number; against: number };
  };
};

export type ApiStandingsResponse = {
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string;
    season: number;
    standings: ApiStandingRow[][];
  };
};

export type MatchStatus = "scheduled" | "live" | "finished" | "other";

export function getMatchStatus(shortStatus: string): MatchStatus {
  if (["TBD", "NS"].includes(shortStatus)) return "scheduled";
  if (["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"].includes(shortStatus))
    return "live";
  if (["FT", "AET", "PEN"].includes(shortStatus)) return "finished";
  return "other";
}
