# Competition Current-Season + Live Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the competition detail page show the real current season's standings/fixtures, a live countdown before kickoff, and auto-refreshing standings + scores while matches are live.

**Architecture:** A new `getCurrentSeason` resolver reads API-Football's `/leagues` endpoint (Redis-cached) to replace the stale stored season. A new `/api/standings` route plus client wrappers (`LiveStandings`, `LiveMatches`) poll only while a match in the competition is live. A `CompetitionCountdown` client component ticks down before the first match. The page (`competition/[slug]/page.tsx`) is rewired to use these and computes a `live` flag from the existing live-fixtures helper.

**Tech Stack:** Next.js 16 (App Router, RSC + route handlers), React 19 client components, TypeScript, Vitest, next-intl, Upstash Redis cache (`cachedJson`), API-Football v3.

## Global Constraints

- API access goes through `fetchApi` (`src/lib/api-football/client.ts`); it never throws and returns `[]` on error/no-key. All new helpers must fail open the same way.
- Cross-instance caching uses `cachedJson` from `src/lib/cache.ts` with `{ ttlSeconds, staleSeconds }`; gate on `hasUpstash()` exactly as `standings.ts`/`fixtures.ts` do.
- Per-request dedupe via React `cache()` on server data getters.
- Client pollers must use an `AbortController` + a `mountedRef`, swallow all errors including `AbortError`, and pause when `document.hidden` — same pattern as `src/components/home/HomeMatchRow.tsx`.
- i18n: add keys to `messages/ar.json`, `messages/fr.json`, `messages/en.json` under the existing `competition` namespace. Arabic is the live locale; fr/en retained.
- Tests run with `npx vitest run <path>` (config `vitest.config.ts`); import alias `@/` maps to `src/`. Test files live in `__tests__/` next to source.
- Commit after each task. Branch is `feat/competition-current-season-live` (already created).
- Localize team/league names only through the existing `localize` layer; do not add new dictionaries.

---

### Task 1: API-Football league/season types

**Files:**
- Modify: `src/lib/api-football/types.ts` (append new types)

**Interfaces:**
- Consumes: nothing.
- Produces: `ApiLeagueSeason` (`{ year: number; start: string; end: string; current: boolean; coverage?: unknown }`) and `ApiLeagueInfo` (`{ league: {...}; country: {...}; seasons: ApiLeagueSeason[] }`).

- [ ] **Step 1: Add the types**

Append to `src/lib/api-football/types.ts`:

```ts
export type ApiLeagueSeason = {
  year: number;
  start: string; // e.g. "2026-06-11"
  end: string; // e.g. "2026-07-19"
  current: boolean;
  coverage?: unknown;
};

export type ApiLeagueInfo = {
  league: { id: number; name: string; type: string; logo: string };
  country: { name: string; code: string | null; flag: string | null };
  seasons: ApiLeagueSeason[];
};
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api-football/types.ts
git commit -m "feat(api-football): add league/season info types"
```

---

### Task 2: Current-season resolver

**Files:**
- Create: `src/lib/api-football/season.ts`
- Test: `src/lib/api-football/__tests__/season.test.ts`

**Interfaces:**
- Consumes: `fetchApi` from `./client`, `cachedJson`/`hasUpstash` from `@/lib/cache`, `ApiLeagueInfo` from `./types`.
- Produces:
  - `type SeasonInfo = { season: number; start: string | null; end: string | null }`
  - `pickCurrentSeason(info: ApiLeagueInfo | undefined, fallback: number): SeasonInfo` — pure, exported for testing.
  - `getCurrentSeason(leagueId: number, fallback: number): Promise<SeasonInfo>` — cached, React-deduped.

- [ ] **Step 1: Write the failing test**

Create `src/lib/api-football/__tests__/season.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { pickCurrentSeason } from "@/lib/api-football/season";
import type { ApiLeagueInfo } from "@/lib/api-football/types";

function info(seasons: { year: number; current: boolean; start?: string; end?: string }[]): ApiLeagueInfo {
  return {
    league: { id: 1, name: "X", type: "Cup", logo: "" },
    country: { name: "World", code: null, flag: null },
    seasons: seasons.map((s) => ({
      year: s.year,
      start: s.start ?? `${s.year}-08-01`,
      end: s.end ?? `${s.year + 1}-05-31`,
      current: s.current,
    })),
  };
}

describe("pickCurrentSeason", () => {
  it("returns the season flagged current", () => {
    const r = pickCurrentSeason(info([{ year: 2024, current: false }, { year: 2025, current: true, start: "2025-08-09" }]), 2000);
    expect(r.season).toBe(2025);
    expect(r.start).toBe("2025-08-09");
  });

  it("falls back to max year when none flagged current", () => {
    const r = pickCurrentSeason(info([{ year: 2023, current: false }, { year: 2024, current: false }]), 2000);
    expect(r.season).toBe(2024);
  });

  it("falls back to the provided fallback when info is missing or empty", () => {
    expect(pickCurrentSeason(undefined, 2025)).toEqual({ season: 2025, start: null, end: null });
    expect(pickCurrentSeason(info([]), 2025).season).toBe(2025);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/api-football/__tests__/season.test.ts`
Expected: FAIL — cannot find module `season` / `pickCurrentSeason` is not a function.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/api-football/season.ts`:

```ts
import { cache } from "react";
import type { ApiLeagueInfo } from "./types";
import { fetchApi } from "./client";
import { cachedJson, hasUpstash } from "@/lib/cache";

export type SeasonInfo = { season: number; start: string | null; end: string | null };

// Pure selection logic, exported for testing. Prefer the season API-Football
// marks `current`; otherwise the latest year present; otherwise the fallback.
export function pickCurrentSeason(
  info: ApiLeagueInfo | undefined,
  fallback: number,
): SeasonInfo {
  const seasons = info?.seasons ?? [];
  if (seasons.length === 0) return { season: fallback, start: null, end: null };
  const current = seasons.find((s) => s.current);
  const chosen = current ?? seasons.reduce((a, b) => (b.year > a.year ? b : a));
  return { season: chosen.year, start: chosen.start ?? null, end: chosen.end ?? null };
}

export const getCurrentSeason = cache(
  async (leagueId: number, fallback: number): Promise<SeasonInfo> => {
    const params = { id: leagueId };
    const response = hasUpstash()
      ? await cachedJson(
          `cur-season:${leagueId}`,
          { ttlSeconds: 21600, staleSeconds: 21600 },
          () => fetchApi<ApiLeagueInfo>("/leagues", params, { cache: "no-store" }),
        )
      : await fetchApi<ApiLeagueInfo>("/leagues", params, 21600);
    return pickCurrentSeason(response[0], fallback);
  },
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/api-football/__tests__/season.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/api-football/season.ts src/lib/api-football/__tests__/season.test.ts
git commit -m "feat(api-football): resolve current season from /leagues endpoint"
```

---

### Task 3: Standings API route

**Files:**
- Create: `src/app/api/standings/route.ts`
- Test: `src/app/api/standings/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `getStandings` from `@/lib/api-football/standings`.
- Produces: `GET(req: Request)` returning `Response` JSON `{ standings: ApiStandingRow[] }`, or 400 `{ error }` on bad params. `export const revalidate = 30`.

- [ ] **Step 1: Write the failing test**

Create `src/app/api/standings/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-football/standings", () => ({
  getStandings: vi.fn().mockResolvedValue([{ rank: 1 }]),
}));

import { GET } from "@/app/api/standings/route";
import { getStandings } from "@/lib/api-football/standings";

describe("GET /api/standings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns standings for valid params", async () => {
    const res = await GET(new Request("http://x/api/standings?league=39&season=2025"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ standings: [{ rank: 1 }] });
    expect(getStandings).toHaveBeenCalledWith(39, 2025);
  });

  it("returns 400 when params are missing or non-numeric", async () => {
    const res = await GET(new Request("http://x/api/standings?league=abc"));
    expect(res.status).toBe(400);
    expect(getStandings).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/standings/__tests__/route.test.ts`
Expected: FAIL — cannot find module `route`.

- [ ] **Step 3: Write minimal implementation**

Create `src/app/api/standings/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getStandings } from "@/lib/api-football/standings";

export const revalidate = 30;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const league = Number(searchParams.get("league"));
  const season = Number(searchParams.get("season"));
  if (!Number.isFinite(league) || !Number.isFinite(season) || league <= 0 || season <= 0) {
    return NextResponse.json({ error: "league and season must be positive numbers" }, { status: 400 });
  }
  const standings = await getStandings(league, season);
  return NextResponse.json({ standings });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/standings/__tests__/route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/standings/route.ts src/app/api/standings/__tests__/route.test.ts
git commit -m "feat(api): add /api/standings route for live standings polling"
```

---

### Task 4: i18n keys for live/countdown UI

**Files:**
- Modify: `messages/ar.json`, `messages/fr.json`, `messages/en.json` (each under `competition`)

**Interfaces:**
- Consumes: nothing.
- Produces: translation keys `competition.liveNow`, `competition.startsIn`, `competition.firstMatch`, `competition.notStarted`, `competition.days`, `competition.hours`, `competition.minutes`, `competition.seconds`.

- [ ] **Step 1: Add keys to Arabic** (`messages/ar.json`, inside the `competition` object)

```json
    "liveNow": "مباشر الآن",
    "startsIn": "تنطلق خلال",
    "firstMatch": "أول مباراة",
    "notStarted": "لم تبدأ البطولة بعد",
    "days": "يوم",
    "hours": "س",
    "minutes": "د",
    "seconds": "ث"
```

- [ ] **Step 2: Add keys to French** (`messages/fr.json`, inside `competition`)

```json
    "liveNow": "En direct",
    "startsIn": "Débute dans",
    "firstMatch": "Premier match",
    "notStarted": "La compétition n'a pas encore commencé",
    "days": "j",
    "hours": "h",
    "minutes": "min",
    "seconds": "s"
```

- [ ] **Step 3: Add keys to English** (`messages/en.json`, inside `competition`)

```json
    "liveNow": "Live now",
    "startsIn": "Starts in",
    "firstMatch": "First match",
    "notStarted": "The competition hasn't started yet",
    "days": "d",
    "hours": "h",
    "minutes": "m",
    "seconds": "s"
```

> Note: ensure the preceding line in each `competition` object ends with a comma. `allCompetitions` is currently the last key — add a comma after it and append the new keys.

- [ ] **Step 4: Verify JSON parses**

Run: `node -e "['ar','fr','en'].forEach(l=>{const m=require('./messages/'+l+'.json');if(!m.competition.liveNow||!m.competition.startsIn)throw new Error(l);});console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 5: Commit**

```bash
git add messages/ar.json messages/fr.json messages/en.json
git commit -m "feat(i18n): add live/countdown keys to competition namespace"
```

---

### Task 5: CompetitionCountdown component

**Files:**
- Create: `src/components/football/CompetitionCountdown.tsx`
- Test: `src/components/football/__tests__/CompetitionCountdown.test.tsx`

**Interfaces:**
- Consumes: `formatDate` from `@/lib/utils`.
- Produces: default-less named export `CompetitionCountdown` with props `{ targetIso: string; locale: string; labels: { startsIn: string; firstMatch: string; days: string; hours: string; minutes: string; seconds: string } }`.

- [ ] **Step 1: Write the failing test**

Create `src/components/football/__tests__/CompetitionCountdown.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { CompetitionCountdown } from "@/components/football/CompetitionCountdown";

const labels = { startsIn: "Starts in", firstMatch: "First match", days: "d", hours: "h", minutes: "m", seconds: "s" };

afterEach(cleanup);

describe("CompetitionCountdown", () => {
  it("renders the remaining days for a future target", () => {
    vi.setSystemTime(new Date("2026-06-01T00:00:00Z"));
    render(<CompetitionCountdown targetIso="2026-06-11T18:00:00Z" locale="en" labels={labels} />);
    expect(screen.getByText(/Starts in/)).toBeTruthy();
    expect(screen.getByText(/10d/)).toBeTruthy();
    vi.useRealTimers();
  });

  it("shows the kickoff date", () => {
    vi.setSystemTime(new Date("2026-06-01T00:00:00Z"));
    render(<CompetitionCountdown targetIso="2026-06-11T18:00:00Z" locale="en" labels={labels} />);
    expect(screen.getByText(/First match/)).toBeTruthy();
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/football/__tests__/CompetitionCountdown.test.tsx`
Expected: FAIL — cannot find module `CompetitionCountdown`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/football/CompetitionCountdown.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { formatDate } from "@/lib/utils";

type Labels = {
  startsIn: string;
  firstMatch: string;
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
};

type Props = { targetIso: string; locale: string; labels: Labels };

function remaining(target: number, now: number) {
  const ms = Math.max(0, target - now);
  const s = Math.floor(ms / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

export function CompetitionCountdown({ targetIso, locale, labels }: Props) {
  const target = new Date(targetIso).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const r = remaining(target, now);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="rounded-xl border border-border bg-muted/40 p-6 text-center">
      <p className="text-sm text-muted-foreground">{labels.startsIn}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums" dir="ltr">
        {r.days}
        {labels.days} {pad(r.hours)}
        {labels.hours}:{pad(r.minutes)}
        {labels.minutes}:{pad(r.seconds)}
        {labels.seconds}
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        {labels.firstMatch}: {formatDate(targetIso, locale)}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/football/__tests__/CompetitionCountdown.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/football/CompetitionCountdown.tsx src/components/football/__tests__/CompetitionCountdown.test.tsx
git commit -m "feat(competition): add pre-start countdown component"
```

---

### Task 6: LiveStandings client wrapper

**Files:**
- Create: `src/components/football/LiveStandings.tsx`
- Test: `src/components/football/__tests__/LiveStandings.test.tsx`

**Interfaces:**
- Consumes: `StandingsTable` from `./StandingsTable` (props `{ standings, locale, labels }`), `ApiStandingRow` from `@/lib/api-football/types`.
- Produces: named export `LiveStandings` with props `{ initial: ApiStandingRow[]; leagueId: number; season: number; locale: string; labels: <StandingsTable labels>; live: boolean; pollMs?: number }`. `StandingsTable`'s `labels` shape is reused verbatim (`team, played, won, drawn, lost, goalsFor, goalsAgainst, goalDiff, points, form`).

- [ ] **Step 1: Write the failing test**

Create `src/components/football/__tests__/LiveStandings.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { LiveStandings } from "@/components/football/LiveStandings";
import type { ApiStandingRow } from "@/lib/api-football/types";

const labels = {
  team: "Team", played: "P", won: "W", drawn: "D", lost: "L",
  goalsFor: "GF", goalsAgainst: "GA", goalDiff: "GD", points: "Pts", form: "Form",
};

function row(name: string, points: number): ApiStandingRow {
  return {
    rank: 1, team: { id: 1, name, logo: "" }, points, goalsDiff: 0, group: "",
    form: null, status: "", description: null,
    all: { played: 1, win: 1, draw: 0, lose: 0, goals: { for: 1, against: 0 } },
  };
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });

describe("LiveStandings", () => {
  it("renders the initial standings", () => {
    render(<LiveStandings initial={[row("Alpha", 3)]} leagueId={1} season={2026} locale="en" labels={labels} live={false} />);
    expect(screen.getByText("Alpha")).toBeTruthy();
  });

  it("does not poll when not live", () => {
    render(<LiveStandings initial={[row("Alpha", 3)]} leagueId={1} season={2026} locale="en" labels={labels} live={false} pollMs={10} />);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("polls and updates when live", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true, json: async () => ({ standings: [row("Beta", 6)] }),
    });
    render(<LiveStandings initial={[row("Alpha", 3)]} leagueId={1} season={2026} locale="en" labels={labels} live pollMs={10} />);
    await waitFor(() => expect(screen.getByText("Beta")).toBeTruthy());
    expect(fetch).toHaveBeenCalledWith("/api/standings?league=1&season=2026", expect.anything());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/football/__tests__/LiveStandings.test.tsx`
Expected: FAIL — cannot find module `LiveStandings`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/football/LiveStandings.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { StandingsTable } from "./StandingsTable";
import type { ApiStandingRow } from "@/lib/api-football/types";

type Labels = React.ComponentProps<typeof StandingsTable>["labels"];

type Props = {
  initial: ApiStandingRow[];
  leagueId: number;
  season: number;
  locale: string;
  labels: Labels;
  live: boolean;
  pollMs?: number;
};

export function LiveStandings({ initial, leagueId, season, locale, labels, live, pollMs = 30000 }: Props) {
  const [standings, setStandings] = useState(initial);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!live) return;
    let abort: AbortController | null = null;

    async function tick() {
      if (typeof document !== "undefined" && document.hidden) return;
      abort?.abort();
      abort = new AbortController();
      try {
        const res = await fetch(`/api/standings?league=${leagueId}&season=${season}`, { signal: abort.signal });
        if (!res.ok) return;
        const json = (await res.json()) as { standings: ApiStandingRow[] };
        if (mountedRef.current && Array.isArray(json.standings) && json.standings.length > 0) {
          setStandings(json.standings);
        }
      } catch {
        // swallow (incl. AbortError) — keep last good standings
      }
    }

    const id = setInterval(tick, pollMs);
    void tick();
    return () => { clearInterval(id); abort?.abort(); };
  }, [live, leagueId, season, pollMs]);

  return <StandingsTable standings={standings} locale={locale} labels={labels} />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/football/__tests__/LiveStandings.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/football/LiveStandings.tsx src/components/football/__tests__/LiveStandings.test.tsx
git commit -m "feat(competition): live-polling standings wrapper"
```

---

### Task 7: LiveMatches client wrapper

**Files:**
- Create: `src/components/football/LiveMatches.tsx`
- Test: `src/components/football/__tests__/LiveMatches.test.tsx`

**Interfaces:**
- Consumes: `MatchList` from `./MatchList` (props `{ fixtures, locale, groupByLeague }`), `ApiFixture` from `@/lib/api-football/types`. Polls existing `GET /api/fixtures/live` → `{ fixtures: ApiFixture[] }`.
- Produces: named export `LiveMatches` with props `{ leagueId: number; locale: string; pollMs?: number }`. Renders nothing when no live fixtures for the league.

- [ ] **Step 1: Write the failing test**

Create `src/components/football/__tests__/LiveMatches.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { LiveMatches } from "@/components/football/LiveMatches";
import type { ApiFixture } from "@/lib/api-football/types";

function fixture(id: number, leagueId: number, home: string): ApiFixture {
  return {
    fixture: { id, date: "2026-06-11T18:00:00Z", timestamp: 0, venue: null, status: { long: "First Half", short: "1H", elapsed: 10 }, referee: null },
    league: { id: leagueId, name: "WC", country: "World", logo: "", flag: null, season: 2026, round: "Group" },
    teams: { home: { id: 1, name: home, logo: "", winner: null }, away: { id: 2, name: "Away", logo: "", winner: null } },
    goals: { home: 1, away: 0 },
    score: { halftime: { home: null, away: null }, fulltime: { home: null, away: null }, extratime: { home: null, away: null }, penalty: { home: null, away: null } },
  };
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });

describe("LiveMatches", () => {
  it("renders live fixtures filtered to the league", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true, json: async () => ({ fixtures: [fixture(10, 1, "Alpha"), fixture(11, 99, "Other")] }),
    });
    render(<LiveMatches leagueId={1} locale="en" pollMs={10} />);
    await waitFor(() => expect(screen.getByText("Alpha")).toBeTruthy());
    expect(screen.queryByText("Other")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/football/__tests__/LiveMatches.test.tsx`
Expected: FAIL — cannot find module `LiveMatches`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/football/LiveMatches.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { MatchList } from "./MatchList";
import type { ApiFixture } from "@/lib/api-football/types";

type Props = { leagueId: number; locale: string; pollMs?: number };

export function LiveMatches({ leagueId, locale, pollMs = 30000 }: Props) {
  const [fixtures, setFixtures] = useState<ApiFixture[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    let abort: AbortController | null = null;

    async function tick() {
      if (typeof document !== "undefined" && document.hidden) return;
      abort?.abort();
      abort = new AbortController();
      try {
        const res = await fetch("/api/fixtures/live", { signal: abort.signal });
        if (!res.ok) return;
        const json = (await res.json()) as { fixtures: ApiFixture[] };
        if (mountedRef.current) {
          setFixtures((json.fixtures ?? []).filter((f) => f.league.id === leagueId));
        }
      } catch {
        // swallow (incl. AbortError)
      }
    }

    const id = setInterval(tick, pollMs);
    void tick();
    return () => { clearInterval(id); abort?.abort(); };
  }, [leagueId, pollMs]);

  if (fixtures.length === 0) return null;
  return <MatchList fixtures={fixtures} locale={locale} groupByLeague={false} />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/football/__tests__/LiveMatches.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/components/football/LiveMatches.tsx src/components/football/__tests__/LiveMatches.test.tsx
git commit -m "feat(competition): live-polling matches section"
```

---

### Task 8: Rewire the competition page

**Files:**
- Modify: `src/app/(frontend)/[locale]/competition/[slug]/page.tsx`

**Interfaces:**
- Consumes: `getCurrentSeason` (Task 2), `getLiveFixturesForLeagues` from `@/lib/api-football/fixtures`, `LiveStandings` (Task 6), `LiveMatches` (Task 7), `CompetitionCountdown` (Task 5), new i18n keys (Task 4).
- Produces: the rendered page. No exports consumed elsewhere.

- [ ] **Step 1: Update imports and `revalidate`**

In `src/app/(frontend)/[locale]/competition/[slug]/page.tsx`:

Replace the fixtures/standings/component imports block (lines 7-12) with:

```tsx
import { getStandings } from "@/lib/api-football/standings";
import { getFixturesByLeague, getLiveFixturesForLeagues } from "@/lib/api-football/fixtures";
import { getCurrentSeason } from "@/lib/api-football/season";
import { StandingsTable } from "@/components/football/StandingsTable";
import { LiveStandings } from "@/components/football/LiveStandings";
import { LiveMatches } from "@/components/football/LiveMatches";
import { CompetitionCountdown } from "@/components/football/CompetitionCountdown";
import { MatchList } from "@/components/football/MatchList";
import { ArticleGrid } from "@/components/articles/ArticleGrid";
import { SectionHeader } from "@/components/shared/SectionHeader";
```

Change `export const revalidate = 900;` to `export const revalidate = 120;` (keep the surrounding comment, updating the minutes note to 2 min).

- [ ] **Step 2: Replace season resolution + data fetch**

Replace the body block from `const leagueId = competition.apiFootballId;` through the end of the `Promise.all` (currently lines 39-49) with:

```tsx
  const leagueId = competition.apiFootballId;
  const { season, start: seasonStart } = await getCurrentSeason(leagueId, competition.season);

  const [standings, recentFixtures, upcomingFixtures, liveForLeague, articles] = await Promise.all([
    competition.type === "league" ? getStandings(leagueId, season) : Promise.resolve([]),
    getFixturesByLeague(leagueId, season, { last: 10 }),
    getFixturesByLeague(leagueId, season, { next: 10 }),
    getLiveFixturesForLeagues([leagueId]),
    competition.category && typeof competition.category === "object"
      ? getArticlesByCompetition(competition.category.id, locale as Config["locale"], 6)
      : Promise.resolve({ docs: [] }),
  ]);

  const live = liveForLeague.length > 0;
  const hasPlayed = standings.length > 0 || recentFixtures.length > 0;
  const countdownTarget = upcomingFixtures[0]?.fixture.date
    ?? (seasonStart ? `${seasonStart}T00:00:00Z` : null);

  const standingsLabels = {
    team: tComp("team"), played: tComp("played"), won: tComp("won"),
    drawn: tComp("drawn"), lost: tComp("lost"), goalsFor: tComp("goalsFor"),
    goalsAgainst: tComp("goalsAgainst"), goalDiff: tComp("goalDiff"),
    points: tComp("points"), form: tComp("form"),
  };
```

- [ ] **Step 3: Replace the JSX body**

Replace the `return ( ... )` block (currently lines 51-103) with:

```tsx
  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">{competition.name}</h1>

      {!hasPlayed && countdownTarget && (
        <section className="mb-10">
          <CompetitionCountdown
            targetIso={countdownTarget}
            locale={locale}
            labels={{
              startsIn: tComp("startsIn"),
              firstMatch: tComp("firstMatch"),
              days: tComp("days"),
              hours: tComp("hours"),
              minutes: tComp("minutes"),
              seconds: tComp("seconds"),
            }}
          />
        </section>
      )}

      {!hasPlayed && !countdownTarget && (
        <p className="mb-10 text-muted-foreground">{tComp("notStarted")}</p>
      )}

      {live && (
        <section className="mb-10">
          <SectionHeader title={tComp("liveNow")} />
          <LiveMatches leagueId={leagueId} locale={locale} />
        </section>
      )}

      {standings.length > 0 && (
        <section className="mb-10">
          <SectionHeader title={tComp("standings")} />
          {live ? (
            <LiveStandings
              initial={standings}
              leagueId={leagueId}
              season={season}
              locale={locale}
              labels={standingsLabels}
              live
            />
          ) : (
            <StandingsTable standings={standings} locale={locale} labels={standingsLabels} />
          )}
        </section>
      )}

      {recentFixtures.length > 0 && (
        <section className="mb-10">
          <SectionHeader title={tComp("results")} />
          <MatchList fixtures={recentFixtures} locale={locale} groupByLeague={false} />
        </section>
      )}

      {upcomingFixtures.length > 0 && (
        <section className="mb-10">
          <SectionHeader title={tComp("fixtures")} />
          <MatchList fixtures={upcomingFixtures} locale={locale} groupByLeague={false} />
        </section>
      )}

      {articles.docs.length > 0 && (
        <section>
          <SectionHeader
            title={tComp("news")}
            href={competition.category && typeof competition.category === "object"
              ? `/${locale}/category/${competition.category.slug}` : undefined}
            linkText={tComp("news")}
          />
          <ArticleGrid articles={articles.docs} locale={locale} columns={3} />
        </section>
      )}
    </div>
  );
```

- [ ] **Step 4: Typecheck, lint, and run the football tests**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx vitest run src/components/football src/lib/api-football src/app/api/standings`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(frontend)/[locale]/competition/[slug]/page.tsx"
git commit -m "feat(competition): use current season + live standings/scores + countdown"
```

---

### Task 9: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all suites PASS (including pre-existing `worldcup.test.ts`, `localize.test.ts`, etc.).

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: build succeeds; `/[locale]/competition/[slug]` compiles with no type errors.

- [ ] **Step 3: Manual smoke (optional, requires `API_FOOTBALL_KEY` in `.env`)**

Run: `npm run dev`, open `/ar/competition/<a-league-slug>`. Confirm the standings reflect the current season (not 2025-26 if that season has ended), and a not-yet-started competition shows the countdown.

- [ ] **Step 4: No commit** (verification only).

---

## Self-Review

**Spec coverage:**
- Current-season resolver → Tasks 1, 2. ✔ (replaces `competition.season` in Task 8)
- Live standings auto-refresh (`/api/standings` + `LiveStandings`) → Tasks 3, 6, 8. ✔
- Live match scores (`LiveMatches`) → Tasks 7, 8. ✔
- Pre-start countdown → Tasks 4, 5, 8. ✔
- Page rewiring + `revalidate` 900→120 → Task 8. ✔
- i18n keys → Task 4. ✔
- Tests (season, route, countdown) → Tasks 2, 3, 5 (plus 6, 7 added). ✔
- Fail-open/cache/poll constraints → Global Constraints + each component. ✔
- Out of scope (worldcup.ts, homepage season helper) → respected; not touched. ✔

**Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to" — all steps contain concrete code and commands. ✔

**Type consistency:** `SeasonInfo`/`pickCurrentSeason`/`getCurrentSeason` (Task 2) used verbatim in Task 8. `LiveStandings` labels reuse `StandingsTable`'s `labels` prop type (Task 6) and Task 8 passes the matching `standingsLabels` object. `/api/standings` response `{ standings }` (Task 3) matches `LiveStandings` fetch parse (Task 6). `/api/fixtures/live` response `{ fixtures }` matches `LiveMatches` parse (Task 7). ✔
