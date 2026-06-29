# Competition page: current-season + live data

**Date:** 2026-06-29
**Status:** Approved (design)
**Scope:** `src/app/(frontend)/[locale]/competition/[slug]/page.tsx` and supporting API-Football helpers/components.

## Problem

The competition detail page renders standings and fixtures for the season stored in
the Payload `Competitions.season` field (default `2025`, see
`src/collections/Competitions.ts`). For most leagues, season `2025` is the 2025-26
campaign that has already finished as of mid-2026, so the page shows **last season's
table presented as the current one**. The World Cup separately hardcodes
`WORLD_CUP_SEASON = 2026`.

The page is also fully static (ISR `revalidate = 900`), so during an active
tournament (e.g. World Cup in progress) standings and scores do not update.

## Goals

1. Query the **real current season** per competition, resolved from the calendar /
   API state rather than a stale DB value.
2. When a competition has not started (no table, nothing played), show **when it
   starts** with a live countdown.
3. When a competition is **live**, auto-refresh standings and show live match scores,
   updating regularly while the user watches.

## Non-goals

- Changing the World Cup helper (`worldcup.ts`) — season 2026 is currently correct.
- Changing the homepage `seasonForCompetition` helper (hero/carousel fixtures).
  Flagged as an optional follow-up; out of scope here.
- Localizing newly-fetched team/league names beyond the existing `localize` layer.

## Architecture

Each unit is independently testable and communicates through narrow props/params.

### 1. Current-season resolver — `src/lib/api-football/season.ts` (new)

```ts
export type SeasonInfo = { season: number; start: string | null; end: string | null };
export function getCurrentSeason(leagueId: number, fallback: number): Promise<SeasonInfo>;
```

- Calls API-Football `/leagues?id=<leagueId>` through `fetchApi`, wrapped in the
  existing Redis `cachedJson` (key `cur-season:<leagueId>`, `ttlSeconds: 21600`
  (6h), `staleSeconds: 21600`). Mirrors the cache pattern in `standings.ts`.
- From `response[0].seasons[]`, pick the entry with `current === true`; return its
  `year`, `start`, `end`.
- If no `current` entry exists (between editions/seasons) → return the entry with the
  max `year`, or `{ season: fallback, start: null, end: null }` if the response is
  empty / no API key.
- Wrapped in React `cache()` for per-request dedupe.

New types in `src/lib/api-football/types.ts`:

```ts
export type ApiLeagueSeason = {
  year: number;
  start: string;        // "2026-06-11"
  end: string;          // "2026-07-19"
  current: boolean;
  coverage?: unknown;
};
export type ApiLeagueInfo = {
  league: { id: number; name: string; type: string; logo: string };
  country: { name: string; code: string | null; flag: string | null };
  seasons: ApiLeagueSeason[];
};
```

### 2. Live standings auto-refresh

- **`src/app/api/standings/route.ts` (new):** `GET ?league=<id>&season=<n>` →
  `{ standings: ApiStandingRow[] }`. Validates both params are finite numbers (400
  otherwise). `export const revalidate = 30`. Delegates to existing `getStandings`.
- **`src/components/football/LiveStandings.tsx` (new, client):** wraps the existing
  presentational `StandingsTable` (which stays a pure server-renderable component).
  Props: `{ initial, leagueId, season, locale, labels, live }`.
  - Renders `StandingsTable` with current state (seeded from `initial`).
  - When `live === true`, polls `/api/standings?league=&season=` every 30s, updating
    state. Uses an `AbortController` + `mountedRef` cleanup (same pattern as
    `HomeMatchRow`). Pauses polling while `document.hidden`
    (`visibilitychange`), resumes on focus.
  - When `live === false`, renders statically and never polls.

### 3. Live match scores — `src/components/football/LiveMatches.tsx` (new, client)

- Shown only when `live === true`. Polls the existing `/api/fixtures/live` every 30s,
  filters `fixtures` to `f.league.id === leagueId`, and renders a "Live now" section
  via the existing `MatchList`/`MatchCard`. Same abort/visibility handling.
- Recent results and upcoming fixtures remain server-rendered (they don't tick).

### 4. Pre-start countdown — `src/components/football/CompetitionCountdown.tsx` (new, client)

- Props: `{ targetIso, labels }`. Ticks every second client-side, showing
  "Starts in {d}d {hh}:{mm}:{ss} — first match {formatted date}".
- `targetIso` chosen server-side as the earliest of `upcomingFixtures[0].date` or the
  season `start` (midnight UTC). If both absent, the section is not rendered and a
  simple "not started" line shows instead.

### 5. Page rewiring — `competition/[slug]/page.tsx`

- Resolve `{ season, start } = await getCurrentSeason(leagueId, competition.season)`.
- `const liveForLeague = await getLiveFixturesForLeagues([leagueId])`;
  `const live = liveForLeague.length > 0`.
- Fetch `standings(leagueId, season)`, recent (`last: 10`), upcoming (`next: 10`) as
  today (Promise.all), using the resolved `season`.
- `const hasPlayed = standings.length > 0 || recentFixtures.length > 0`.
  - If `hasPlayed`: render `LiveStandings` (passing `live`) for `league`-type comps;
    `LiveMatches` section when `live`; then static results + fixtures.
  - Else: render `CompetitionCountdown` from earliest upcoming fixture / season start.
- Lower `export const revalidate` from `900` to `120` so non-live page loads are also
  reasonably fresh; live freshness comes from client polling.

### 6. i18n — `messages/{ar,fr,en}.json` under `competition`

Add keys: `liveNow`, `startsIn`, `firstMatch`, `notStarted`, and unit labels
`days`, `hours`, `minutes`, `seconds`. Arabic is primary; fr/en retained.

## Data flow

```
page (server)
  getCurrentSeason(leagueId, comp.season) ──/leagues (cached 6h)──> season
  getLiveFixturesForLeagues([leagueId]) ──live:all (cached 30s)──> live?
  getStandings(leagueId, season), getFixturesByLeague(...) ──────> initial data
        │ hasPlayed                         │ !hasPlayed
        ▼                                   ▼
  LiveStandings(initial, live) ─poll/30s→ /api/standings   CompetitionCountdown(targetIso) ─tick/1s
  LiveMatches(live) ───────────poll/30s→ /api/fixtures/live
```

## Error handling

- `getCurrentSeason` and the new route fail open: missing key / API error → fallback
  season, empty standings (same as today's `fetchApi` behavior — never throws).
- Client pollers swallow errors (incl. `AbortError`) and keep the last good data, as
  `HomeMatchRow` does.
- Route returns 400 on non-numeric params; never proxies arbitrary leagues to the
  upstream beyond what the param specifies (read-only standings).

## Testing

- `season.test.ts`: picks the `current: true` season; falls back to max year when no
  current; falls back to `fallback` on empty response.
- `api/standings` route: 400 on bad params; returns `{ standings }` on valid params.
- `CompetitionCountdown` render: shows formatted remaining time for a future target.
- Existing `worldcup.test.ts` and others remain unchanged.

## Cost / quota

- One extra `/leagues` call per competition page, cached 6h → negligible.
- Live polling (`/api/standings`, `/api/fixtures/live`) runs **only during live
  matches** and pauses on hidden tabs. `/api/fixtures/live` reuses the already-cached
  `live:all` upstream call.
