# MFM Sport — Plan 3: Football Data Layer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate API-Football for live match data, add Competitions and Clubs CMS collections, and build matches, competition, and club pages with standings, fixtures, lineups, events, and statistics.

**Architecture:** A typed API-Football service layer fetches data server-side with ISR caching (60-120s). Competitions and Clubs are Payload collections with `apiFootballId` fields that map editorial entities to live data. Pages are hybrid — Payload editorial content + API-Football live data fetched in the same server component. All API calls go through a single HTTP client with auth, error handling, and graceful fallback when the API key is missing.

**Tech Stack:** API-Football REST API, Next.js ISR (revalidate), Payload collections with relationship fields, existing design tokens (win/loss/draw/live semantic colors), shadcn/ui Table component

---

## Depends On

Plans 1 (Foundation) + 2 (Editorial Pages) complete. Existing:
- Payload with Users, Media, Categories, Tags, Authors, Articles
- Query helpers in `src/lib/payload/queries.ts`
- Utilities: `formatDate`, `formatTime`, `getImageUrl`, `getImageAlt`, `cn`
- Components: ArticleCard, ArticleGrid, Pagination, SectionHeader, CategoryBadge
- i18n with AR/FR/EN, semantic football colors in Tailwind (win, loss, draw, live)

---

## File Structure

```
src/
  lib/
    api-football/
      types.ts                              # Task 1
      client.ts                             # Task 1
      fixtures.ts                           # Task 1
      standings.ts                          # Task 1
  collections/
    Competitions.ts                         # Task 2
    Clubs.ts                                # Task 2
  components/
    football/
      MatchCard.tsx                         # Task 4
      MatchList.tsx                         # Task 4
      StandingsTable.tsx                    # Task 5
      MatchEvents.tsx                       # Task 6
      MatchLineup.tsx                       # Task 6
      MatchStats.tsx                        # Task 6
  app/
    (frontend)/
      [locale]/
        matches/
          page.tsx                          # Task 7
          [id]/
            page.tsx                        # Task 8
        competition/
          [slug]/
            page.tsx                        # Task 9
        club/
          [slug]/
            page.tsx                        # Task 10
        page.tsx                            # Task 11 (modify)
messages/
  ar.json, fr.json, en.json                # Task 3 (modify)
src/payload.config.ts                       # Task 2 (modify)
next.config.ts                              # Task 1 (modify)
.env.example                                # Task 1 (modify)
```

---

## Task 1: API-Football Service Layer

**Files:**
- Create: `src/lib/api-football/types.ts`
- Create: `src/lib/api-football/client.ts`
- Create: `src/lib/api-football/fixtures.ts`
- Create: `src/lib/api-football/standings.ts`
- Modify: `next.config.ts` (add API-Football image domain)
- Modify: `.env.example` (add API_FOOTBALL_KEY)

- [ ] **Step 1: Create API-Football types**

Create `src/lib/api-football/types.ts`:

```ts
// API-Football response wrapper
export type ApiResponse<T> = {
  get: string;
  parameters: Record<string, string>;
  errors: any[];
  results: number;
  paging: { current: number; total: number };
  response: T;
};

// Fixture (match)
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

// Match event (goal, card, substitution)
export type ApiEvent = {
  time: { elapsed: number; extra: number | null };
  team: { id: number; name: string; logo: string };
  player: { id: number; name: string };
  assist: { id: number | null; name: string | null };
  type: string;
  detail: string;
  comments: string | null;
};

// Lineup
export type ApiLineup = {
  team: { id: number; name: string; logo: string; colors: any };
  formation: string;
  startXI: { player: { id: number; name: string; number: number; pos: string } }[];
  substitutes: { player: { id: number; name: string; number: number; pos: string } }[];
  coach: { id: number | null; name: string | null; photo: string | null };
};

// Team statistics for a match
export type ApiTeamStatistics = {
  team: { id: number; name: string; logo: string };
  statistics: { type: string; value: number | string | null }[];
};

// Standings
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

// Match status helpers
export type MatchStatus = "scheduled" | "live" | "finished" | "other";

export function getMatchStatus(shortStatus: string): MatchStatus {
  if (["TBD", "NS"].includes(shortStatus)) return "scheduled";
  if (["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"].includes(shortStatus))
    return "live";
  if (["FT", "AET", "PEN"].includes(shortStatus)) return "finished";
  return "other";
}
```

- [ ] **Step 2: Create API-Football HTTP client**

Create `src/lib/api-football/client.ts`:

```ts
import type { ApiResponse } from "./types";

const API_BASE = "https://v3.football.api-sports.io";

export async function fetchApi<T>(
  endpoint: string,
  params: Record<string, string | number>,
  revalidate: number = 60,
): Promise<T[]> {
  const apiKey = process.env.API_FOOTBALL_KEY;

  if (!apiKey) {
    console.warn(`[API-Football] No API_FOOTBALL_KEY configured — returning empty for ${endpoint}`);
    return [] as T[];
  }

  const url = new URL(endpoint, API_BASE);
  Object.entries(params).forEach(([key, value]) =>
    url.searchParams.set(key, String(value)),
  );

  const res = await fetch(url.toString(), {
    headers: {
      "x-apisports-key": apiKey,
    },
    next: { revalidate },
  });

  if (!res.ok) {
    console.error(`[API-Football] ${res.status} ${res.statusText} for ${endpoint}`);
    return [] as T[];
  }

  const data: ApiResponse<T[]> = await res.json();

  if (data.errors && Object.keys(data.errors).length > 0) {
    console.error("[API-Football] API errors:", data.errors);
    return [] as T[];
  }

  return data.response;
}
```

- [ ] **Step 3: Create fixtures endpoint helpers**

Create `src/lib/api-football/fixtures.ts`:

```ts
import type { ApiFixture } from "./types";
import { fetchApi } from "./client";

export async function getFixturesByDate(date: string): Promise<ApiFixture[]> {
  return fetchApi<ApiFixture>("/fixtures", { date }, 60);
}

export async function getFixtureById(id: number): Promise<ApiFixture | null> {
  const fixtures = await fetchApi<ApiFixture>("/fixtures", { id }, 60);
  return fixtures[0] || null;
}

export async function getFixturesByLeague(
  leagueId: number,
  season: number,
  options?: { from?: string; to?: string; last?: number; next?: number },
): Promise<ApiFixture[]> {
  const params: Record<string, string | number> = { league: leagueId, season };
  if (options?.from) params.from = options.from;
  if (options?.to) params.to = options.to;
  if (options?.last) params.last = options.last;
  if (options?.next) params.next = options.next;
  return fetchApi<ApiFixture>("/fixtures", params, 60);
}

export async function getFixturesByTeam(
  teamId: number,
  season: number,
  options?: { last?: number; next?: number },
): Promise<ApiFixture[]> {
  const params: Record<string, string | number> = { team: teamId, season };
  if (options?.last) params.last = options.last;
  if (options?.next) params.next = options.next;
  return fetchApi<ApiFixture>("/fixtures", params, 60);
}
```

- [ ] **Step 4: Create standings endpoint helper**

Create `src/lib/api-football/standings.ts`:

```ts
import type { ApiStandingsResponse, ApiStandingRow } from "./types";
import { fetchApi } from "./client";

export async function getStandings(
  leagueId: number,
  season: number,
): Promise<ApiStandingRow[]> {
  const response = await fetchApi<ApiStandingsResponse>(
    "/standings",
    { league: leagueId, season },
    60,
  );

  if (!response[0]?.league?.standings?.[0]) return [];
  return response[0].league.standings[0];
}
```

- [ ] **Step 5: Add API-Football image domain to next.config.ts**

Read `next.config.ts` and add `remotePatterns` for the API-Football CDN. Update the `images` config:

```ts
images: {
  remotePatterns: [
    {
      protocol: "https",
      hostname: "media.api-sports.io",
    },
  ],
  localPatterns: [
    {
      pathname: "/api/media/file/**",
    },
  ],
},
```

- [ ] **Step 6: Add API_FOOTBALL_KEY to .env.example**

Add to `.env.example`:

```env
# Football Data (API-Football)
API_FOOTBALL_KEY=
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/api-football/ next.config.ts .env.example
git commit -m "feat: add API-Football service layer with types, client, fixtures, standings"
```

---

## Task 2: Competitions + Clubs Collections

**Files:**
- Create: `src/collections/Competitions.ts`
- Create: `src/collections/Clubs.ts`
- Modify: `src/payload.config.ts`
- Modify: `src/lib/payload/queries.ts` (add competition/club queries)

- [ ] **Step 1: Create Competitions collection**

Create `src/collections/Competitions.ts`:

```ts
import type { CollectionConfig } from "payload";

export const Competitions: CollectionConfig = {
  slug: "competitions",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "type", "country", "apiFootballId"],
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      localized: true,
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
    },
    {
      name: "logo",
      type: "upload",
      relationTo: "media",
    },
    {
      name: "type",
      type: "select",
      required: true,
      options: [
        { label: "League", value: "league" },
        { label: "Cup", value: "cup" },
      ],
    },
    {
      name: "country",
      type: "text",
    },
    {
      name: "apiFootballId",
      type: "number",
      required: true,
      unique: true,
      admin: {
        description: "League ID from API-Football (e.g., 39 for Premier League)",
      },
    },
    {
      name: "season",
      type: "number",
      required: true,
      defaultValue: 2025,
      admin: {
        description: "Current season year (e.g., 2025 for 2025-26)",
      },
    },
    {
      name: "category",
      type: "relationship",
      relationTo: "categories",
      admin: {
        description: "Links this competition to a news category for article filtering",
      },
    },
  ],
};
```

- [ ] **Step 2: Create Clubs collection**

Create `src/collections/Clubs.ts`:

```ts
import type { CollectionConfig } from "payload";

export const Clubs: CollectionConfig = {
  slug: "clubs",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "country", "apiFootballId"],
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      localized: true,
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
    },
    {
      name: "logo",
      type: "upload",
      relationTo: "media",
    },
    {
      name: "apiFootballId",
      type: "number",
      unique: true,
      admin: {
        description: "Team ID from API-Football",
      },
    },
    {
      name: "competitions",
      type: "relationship",
      relationTo: "competitions",
      hasMany: true,
    },
    {
      name: "venue",
      type: "text",
      localized: true,
    },
    {
      name: "country",
      type: "text",
    },
  ],
};
```

- [ ] **Step 3: Register both in payload.config.ts**

Add imports and update collections array:

```ts
import { Competitions } from "./collections/Competitions";
import { Clubs } from "./collections/Clubs";

collections: [Users, Media, Categories, Tags, Authors, Articles, Competitions, Clubs],
```

- [ ] **Step 4: Add query helpers for competitions and clubs**

Add to `src/lib/payload/queries.ts`:

```ts
export async function getCompetitions(locale: string) {
  const payload = await getPayloadClient();
  return payload.find({
    collection: "competitions",
    locale,
    limit: 50,
    sort: "name",
    depth: 1,
  });
}

export async function getCompetitionBySlug(slug: string, locale: string) {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "competitions",
    where: { slug: { equals: slug } },
    locale,
    limit: 1,
    depth: 1,
  });
  return result.docs[0] || null;
}

export async function getClubBySlug(slug: string, locale: string) {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "clubs",
    where: { slug: { equals: slug } },
    locale,
    limit: 1,
    depth: 1,
  });
  return result.docs[0] || null;
}

export async function getArticlesByCompetition(
  competitionCategoryId: string | number,
  locale: string,
  limit: number = 6,
) {
  const payload = await getPayloadClient();
  return payload.find({
    collection: "articles",
    where: {
      categories: { equals: competitionCategoryId },
      status: { equals: "published" },
    },
    locale,
    limit,
    sort: "-publishedAt",
    depth: 2,
  });
}
```

- [ ] **Step 5: Commit**

```bash
git add src/collections/Competitions.ts src/collections/Clubs.ts src/payload.config.ts src/lib/payload/queries.ts
git commit -m "feat: add Competitions and Clubs collections with query helpers"
```

---

## Task 3: i18n Messages for Football

**Files:**
- Modify: `messages/ar.json`, `messages/fr.json`, `messages/en.json`

- [ ] **Step 1: Add football messages to all 3 locale files**

Add these sections to each file (keep all existing keys):

**Arabic (`messages/ar.json`):**
```json
{
  "match": {
    "today": "مباريات اليوم",
    "upcoming": "المباريات القادمة",
    "recent": "النتائج الأخيرة",
    "noMatches": "لا توجد مباريات",
    "kickoff": "الانطلاق",
    "halfTime": "الشوط الأول",
    "fullTime": "نهاية المباراة",
    "live": "مباشر",
    "scheduled": "مقرر",
    "finished": "انتهت",
    "minute": "د",
    "lineup": "التشكيلة",
    "events": "الأحداث",
    "statistics": "الإحصائيات",
    "formation": "التشكيل",
    "coach": "المدرب",
    "startingXI": "التشكيلة الأساسية",
    "substitutes": "البدلاء",
    "goal": "هدف",
    "yellowCard": "بطاقة صفراء",
    "redCard": "بطاقة حمراء",
    "substitution": "تبديل",
    "var": "حكم الفيديو",
    "possession": "الاستحواذ",
    "shots": "التسديدات",
    "shotsOnTarget": "على المرمى",
    "corners": "الركنيات",
    "fouls": "الأخطاء",
    "offsides": "التسلل"
  },
  "competition": {
    "standings": "الترتيب",
    "fixtures": "المباريات",
    "results": "النتائج",
    "news": "أخبار",
    "team": "الفريق",
    "played": "لعب",
    "won": "فوز",
    "drawn": "تعادل",
    "lost": "خسارة",
    "goalsFor": "له",
    "goalsAgainst": "عليه",
    "goalDiff": "الفارق",
    "points": "نقاط",
    "form": "آخر 5",
    "allCompetitions": "جميع المسابقات"
  },
  "club": {
    "info": "معلومات",
    "venue": "الملعب",
    "recentMatches": "آخر المباريات",
    "upcomingMatches": "المباريات القادمة",
    "news": "أخبار الفريق"
  }
}
```

**French (`messages/fr.json`):**
```json
{
  "match": {
    "today": "Matchs du jour",
    "upcoming": "Matchs a venir",
    "recent": "Resultats recents",
    "noMatches": "Aucun match",
    "kickoff": "Coup d'envoi",
    "halfTime": "Mi-temps",
    "fullTime": "Termine",
    "live": "En direct",
    "scheduled": "Programme",
    "finished": "Termine",
    "minute": "min",
    "lineup": "Composition",
    "events": "Evenements",
    "statistics": "Statistiques",
    "formation": "Formation",
    "coach": "Entraineur",
    "startingXI": "Titulaires",
    "substitutes": "Remplacants",
    "goal": "But",
    "yellowCard": "Carton jaune",
    "redCard": "Carton rouge",
    "substitution": "Remplacement",
    "var": "VAR",
    "possession": "Possession",
    "shots": "Tirs",
    "shotsOnTarget": "Tirs cadres",
    "corners": "Corners",
    "fouls": "Fautes",
    "offsides": "Hors-jeu"
  },
  "competition": {
    "standings": "Classement",
    "fixtures": "Calendrier",
    "results": "Resultats",
    "news": "Actualites",
    "team": "Equipe",
    "played": "J",
    "won": "G",
    "drawn": "N",
    "lost": "P",
    "goalsFor": "BP",
    "goalsAgainst": "BC",
    "goalDiff": "Diff",
    "points": "Pts",
    "form": "Forme",
    "allCompetitions": "Toutes les competitions"
  },
  "club": {
    "info": "Infos",
    "venue": "Stade",
    "recentMatches": "Derniers matchs",
    "upcomingMatches": "Prochains matchs",
    "news": "Actualites du club"
  }
}
```

**English (`messages/en.json`):**
```json
{
  "match": {
    "today": "Today's Matches",
    "upcoming": "Upcoming Matches",
    "recent": "Recent Results",
    "noMatches": "No matches",
    "kickoff": "Kick-off",
    "halfTime": "Half Time",
    "fullTime": "Full Time",
    "live": "LIVE",
    "scheduled": "Scheduled",
    "finished": "Finished",
    "minute": "min",
    "lineup": "Lineup",
    "events": "Events",
    "statistics": "Statistics",
    "formation": "Formation",
    "coach": "Coach",
    "startingXI": "Starting XI",
    "substitutes": "Substitutes",
    "goal": "Goal",
    "yellowCard": "Yellow Card",
    "redCard": "Red Card",
    "substitution": "Substitution",
    "var": "VAR",
    "possession": "Possession",
    "shots": "Shots",
    "shotsOnTarget": "On Target",
    "corners": "Corners",
    "fouls": "Fouls",
    "offsides": "Offsides"
  },
  "competition": {
    "standings": "Standings",
    "fixtures": "Fixtures",
    "results": "Results",
    "news": "News",
    "team": "Team",
    "played": "P",
    "won": "W",
    "drawn": "D",
    "lost": "L",
    "goalsFor": "GF",
    "goalsAgainst": "GA",
    "goalDiff": "GD",
    "points": "Pts",
    "form": "Form",
    "allCompetitions": "All Competitions"
  },
  "club": {
    "info": "Info",
    "venue": "Venue",
    "recentMatches": "Recent Matches",
    "upcomingMatches": "Upcoming Matches",
    "news": "Club News"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add messages/
git commit -m "feat: add football i18n messages (match, competition, club)"
```

---

## Task 4: MatchCard + MatchList Components

**Files:**
- Create: `src/components/football/MatchCard.tsx`
- Create: `src/components/football/MatchList.tsx`

- [ ] **Step 1: Create MatchCard**

Create `src/components/football/MatchCard.tsx`:

```tsx
import Image from "next/image";
import Link from "next/link";
import { cn, formatDate, formatTime } from "@/lib/utils";
import type { ApiFixture } from "@/lib/api-football/types";
import { getMatchStatus } from "@/lib/api-football/types";

type Props = {
  fixture: ApiFixture;
  locale: string;
};

export function MatchCard({ fixture, locale }: Props) {
  const status = getMatchStatus(fixture.fixture.status.short);
  const { home, away } = fixture.teams;
  const goals = fixture.goals;

  return (
    <Link
      href={`/${locale}/matches/${fixture.fixture.id}`}
      className="block rounded-lg bg-card border border-border p-3 hover:border-primary/30 transition-colors"
    >
      <div className="flex items-center justify-between gap-3">
        {/* Home team */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Image
            src={home.logo}
            alt={home.name}
            width={24}
            height={24}
            className="shrink-0"
          />
          <span className={cn("text-sm truncate", home.winner && "font-bold")}>
            {home.name}
          </span>
        </div>

        {/* Score / Time */}
        <div className="flex flex-col items-center shrink-0 min-w-[60px]">
          {status === "scheduled" ? (
            <span className="text-xs text-muted-foreground">
              {formatTime(fixture.fixture.date, locale)}
            </span>
          ) : (
            <div className="flex items-center gap-1 font-bold tabular-nums">
              <span>{goals.home ?? "-"}</span>
              <span className="text-muted-foreground">-</span>
              <span>{goals.away ?? "-"}</span>
            </div>
          )}
          <span
            className={cn(
              "text-[10px] font-medium mt-0.5",
              status === "live" && "text-live",
              status === "finished" && "text-muted-foreground",
              status === "scheduled" && "text-muted-foreground",
            )}
          >
            {status === "live" && fixture.fixture.status.elapsed
              ? `${fixture.fixture.status.elapsed}'`
              : status === "live"
                ? fixture.fixture.status.short
                : status === "finished"
                  ? "FT"
                  : formatDate(fixture.fixture.date, locale)}
          </span>
        </div>

        {/* Away team */}
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <span className={cn("text-sm truncate", away.winner && "font-bold")}>
            {away.name}
          </span>
          <Image
            src={away.logo}
            alt={away.name}
            width={24}
            height={24}
            className="shrink-0"
          />
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Create MatchList**

Create `src/components/football/MatchList.tsx`:

```tsx
import Image from "next/image";
import { MatchCard } from "./MatchCard";
import type { ApiFixture } from "@/lib/api-football/types";

type Props = {
  fixtures: ApiFixture[];
  locale: string;
  groupByLeague?: boolean;
};

export function MatchList({ fixtures, locale, groupByLeague = true }: Props) {
  if (fixtures.length === 0) return null;

  if (!groupByLeague) {
    return (
      <div className="space-y-2">
        {fixtures.map((f) => (
          <MatchCard key={f.fixture.id} fixture={f} locale={locale} />
        ))}
      </div>
    );
  }

  // Group fixtures by league
  const grouped = fixtures.reduce<Record<string, { league: ApiFixture["league"]; fixtures: ApiFixture[] }>>(
    (acc, fixture) => {
      const key = String(fixture.league.id);
      if (!acc[key]) {
        acc[key] = { league: fixture.league, fixtures: [] };
      }
      acc[key].fixtures.push(fixture);
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-6">
      {Object.values(grouped).map((group) => (
        <div key={group.league.id}>
          <div className="flex items-center gap-2 mb-2 px-1">
            <Image
              src={group.league.logo}
              alt={group.league.name}
              width={20}
              height={20}
            />
            <span className="text-sm font-medium text-muted-foreground">
              {group.league.name}
            </span>
          </div>
          <div className="space-y-1">
            {group.fixtures.map((f) => (
              <MatchCard key={f.fixture.id} fixture={f} locale={locale} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/football/MatchCard.tsx src/components/football/MatchList.tsx
git commit -m "feat: add MatchCard and MatchList components"
```

---

## Task 5: StandingsTable Component

**Files:**
- Create: `src/components/football/StandingsTable.tsx`

- [ ] **Step 1: Install shadcn table component**

```bash
pnpm dlx shadcn@latest add table
```

- [ ] **Step 2: Create StandingsTable**

Create `src/components/football/StandingsTable.tsx`:

```tsx
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ApiStandingRow } from "@/lib/api-football/types";

type Props = {
  standings: ApiStandingRow[];
  locale: string;
  labels: {
    team: string;
    played: string;
    won: string;
    drawn: string;
    lost: string;
    goalsFor: string;
    goalsAgainst: string;
    goalDiff: string;
    points: string;
    form: string;
  };
};

function FormBadges({ form }: { form: string | null }) {
  if (!form) return null;
  return (
    <div className="flex gap-0.5">
      {form.split("").map((char, i) => (
        <span
          key={i}
          className={cn(
            "w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white",
            char === "W" && "bg-win",
            char === "D" && "bg-draw",
            char === "L" && "bg-loss",
          )}
        >
          {char}
        </span>
      ))}
    </div>
  );
}

export function StandingsTable({ standings, locale, labels }: Props) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-secondary/50">
            <TableHead className="w-8 text-center">#</TableHead>
            <TableHead>{labels.team}</TableHead>
            <TableHead className="w-8 text-center">{labels.played}</TableHead>
            <TableHead className="w-8 text-center">{labels.won}</TableHead>
            <TableHead className="w-8 text-center">{labels.drawn}</TableHead>
            <TableHead className="w-8 text-center">{labels.lost}</TableHead>
            <TableHead className="w-8 text-center">{labels.goalsFor}</TableHead>
            <TableHead className="w-8 text-center">{labels.goalsAgainst}</TableHead>
            <TableHead className="w-8 text-center">{labels.goalDiff}</TableHead>
            <TableHead className="w-8 text-center font-bold">{labels.points}</TableHead>
            <TableHead className="hidden sm:table-cell">{labels.form}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {standings.map((row) => (
            <TableRow key={row.rank} className="hover:bg-secondary/30">
              <TableCell className="text-center text-xs font-medium text-muted-foreground">
                {row.rank}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Image
                    src={row.team.logo}
                    alt={row.team.name}
                    width={20}
                    height={20}
                    className="shrink-0"
                  />
                  <span className="text-sm font-medium truncate">{row.team.name}</span>
                </div>
              </TableCell>
              <TableCell className="text-center text-sm">{row.all.played}</TableCell>
              <TableCell className="text-center text-sm">{row.all.win}</TableCell>
              <TableCell className="text-center text-sm">{row.all.draw}</TableCell>
              <TableCell className="text-center text-sm">{row.all.lose}</TableCell>
              <TableCell className="text-center text-sm">{row.all.goals.for}</TableCell>
              <TableCell className="text-center text-sm">{row.all.goals.against}</TableCell>
              <TableCell className={cn("text-center text-sm", row.goalsDiff > 0 && "text-win", row.goalsDiff < 0 && "text-loss")}>
                {row.goalsDiff > 0 ? `+${row.goalsDiff}` : row.goalsDiff}
              </TableCell>
              <TableCell className="text-center text-sm font-bold">{row.points}</TableCell>
              <TableCell className="hidden sm:table-cell">
                <FormBadges form={row.form} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/football/StandingsTable.tsx src/components/ui/table.tsx
git commit -m "feat: add StandingsTable component with form badges"
```

---

## Task 6: Match Detail Components

**Files:**
- Create: `src/components/football/MatchEvents.tsx`
- Create: `src/components/football/MatchLineup.tsx`
- Create: `src/components/football/MatchStats.tsx`

- [ ] **Step 1: Create MatchEvents**

Create `src/components/football/MatchEvents.tsx`:

```tsx
import { cn } from "@/lib/utils";
import type { ApiEvent } from "@/lib/api-football/types";

type Props = {
  events: ApiEvent[];
  homeTeamId: number;
};

function EventIcon({ type, detail }: { type: string; detail: string }) {
  if (type === "Goal") return <span className="text-win">⚽</span>;
  if (type === "Card" && detail.includes("Yellow")) return <span className="text-draw">🟨</span>;
  if (type === "Card" && detail.includes("Red")) return <span className="text-loss">🟥</span>;
  if (type === "subst") return <span className="text-muted-foreground">🔄</span>;
  if (type === "Var") return <span className="text-muted-foreground">📺</span>;
  return <span>•</span>;
}

export function MatchEvents({ events, homeTeamId }: Props) {
  if (events.length === 0) return null;

  return (
    <div className="space-y-2">
      {events.map((event, i) => {
        const isHome = event.team.id === homeTeamId;
        return (
          <div
            key={i}
            className={cn(
              "flex items-center gap-2 text-sm py-1 px-2 rounded",
              isHome ? "justify-start" : "justify-end",
            )}
          >
            {isHome && (
              <>
                <span className="text-xs text-muted-foreground w-8 shrink-0">
                  {event.time.elapsed}&apos;{event.time.extra ? `+${event.time.extra}` : ""}
                </span>
                <EventIcon type={event.type} detail={event.detail} />
                <span className="font-medium">{event.player.name}</span>
                {event.assist.name && (
                  <span className="text-muted-foreground text-xs">({event.assist.name})</span>
                )}
              </>
            )}
            {!isHome && (
              <>
                {event.assist.name && (
                  <span className="text-muted-foreground text-xs">({event.assist.name})</span>
                )}
                <span className="font-medium">{event.player.name}</span>
                <EventIcon type={event.type} detail={event.detail} />
                <span className="text-xs text-muted-foreground w-8 shrink-0 text-end">
                  {event.time.elapsed}&apos;{event.time.extra ? `+${event.time.extra}` : ""}
                </span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create MatchLineup**

Create `src/components/football/MatchLineup.tsx`:

```tsx
import Image from "next/image";
import type { ApiLineup } from "@/lib/api-football/types";

type Props = {
  lineup: ApiLineup;
  labels: { startingXI: string; substitutes: string; coach: string; formation: string };
};

export function MatchLineup({ lineup, labels }: Props) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image src={lineup.team.logo} alt={lineup.team.name} width={24} height={24} />
          <span className="font-bold text-sm">{lineup.team.name}</span>
        </div>
        <span className="text-sm text-muted-foreground">
          {labels.formation}: {lineup.formation}
        </span>
      </div>

      {/* Starting XI */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-2">{labels.startingXI}</h4>
        <div className="grid grid-cols-1 gap-1">
          {lineup.startXI.map((p) => (
            <div key={p.player.id} className="flex items-center gap-2 text-sm py-0.5">
              <span className="w-6 text-center text-xs text-muted-foreground font-mono">
                {p.player.number}
              </span>
              <span>{p.player.name}</span>
              <span className="text-[10px] text-muted-foreground">{p.player.pos}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Substitutes */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-2">{labels.substitutes}</h4>
        <div className="grid grid-cols-1 gap-1">
          {lineup.substitutes.map((p) => (
            <div key={p.player.id} className="flex items-center gap-2 text-sm py-0.5 text-muted-foreground">
              <span className="w-6 text-center text-xs font-mono">{p.player.number}</span>
              <span>{p.player.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Coach */}
      {lineup.coach?.name && (
        <div className="text-sm text-muted-foreground">
          {labels.coach}: <span className="text-foreground">{lineup.coach.name}</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create MatchStats**

Create `src/components/football/MatchStats.tsx`:

```tsx
import { cn } from "@/lib/utils";
import type { ApiTeamStatistics } from "@/lib/api-football/types";

type Props = {
  statistics: ApiTeamStatistics[];
};

const STAT_KEYS = [
  "Ball Possession",
  "Total Shots",
  "Shots on Goal",
  "Corner Kicks",
  "Fouls",
  "Offsides",
  "Yellow Cards",
  "Red Cards",
  "Passes %",
];

function parseStatValue(value: number | string | null): number {
  if (value === null) return 0;
  if (typeof value === "string") return parseInt(value.replace("%", ""), 10) || 0;
  return value;
}

export function MatchStats({ statistics }: Props) {
  if (statistics.length < 2) return null;

  const [homeStats, awayStats] = statistics;

  return (
    <div className="space-y-3">
      {STAT_KEYS.map((key) => {
        const homeStat = homeStats.statistics.find((s) => s.type === key);
        const awayStat = awayStats.statistics.find((s) => s.type === key);
        if (!homeStat && !awayStat) return null;

        const homeVal = parseStatValue(homeStat?.value ?? null);
        const awayVal = parseStatValue(awayStat?.value ?? null);
        const total = homeVal + awayVal || 1;
        const homePercent = (homeVal / total) * 100;

        return (
          <div key={key}>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium">{homeStat?.value ?? 0}</span>
              <span className="text-muted-foreground text-xs">{key}</span>
              <span className="font-medium">{awayStat?.value ?? 0}</span>
            </div>
            <div className="flex h-1.5 rounded-full overflow-hidden bg-secondary">
              <div
                className={cn("rounded-full", homePercent > 50 ? "bg-primary" : "bg-muted-foreground")}
                style={{ width: `${homePercent}%` }}
              />
              <div
                className={cn("rounded-full", homePercent <= 50 ? "bg-primary" : "bg-muted-foreground")}
                style={{ width: `${100 - homePercent}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/football/MatchEvents.tsx src/components/football/MatchLineup.tsx src/components/football/MatchStats.tsx
git commit -m "feat: add MatchEvents, MatchLineup, MatchStats components"
```

---

## Task 7: Matches Page

**Files:**
- Create: `src/app/(frontend)/[locale]/matches/page.tsx`

- [ ] **Step 1: Create matches page**

Create `src/app/(frontend)/[locale]/matches/page.tsx`:

```tsx
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getFixturesByDate } from "@/lib/api-football/fixtures";
import { MatchList } from "@/components/football/MatchList";
import { SectionHeader } from "@/components/shared/SectionHeader";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string }>;
};

function formatApiDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "match" });
  return { title: `${t("today")} | MFM Sport` };
}

export default async function MatchesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { date } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "match" });

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const selectedDate = date || formatApiDate(today);

  const [todayFixtures, yesterdayFixtures, tomorrowFixtures] = await Promise.all([
    getFixturesByDate(formatApiDate(today)),
    getFixturesByDate(formatApiDate(yesterday)),
    getFixturesByDate(formatApiDate(tomorrow)),
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">{t("today")}</h1>

      {/* Date navigation */}
      <div className="flex gap-2 mb-8">
        {[
          { label: formatApiDate(yesterday), fixtures: yesterdayFixtures },
          { label: formatApiDate(today), fixtures: todayFixtures },
          { label: formatApiDate(tomorrow), fixtures: tomorrowFixtures },
        ].map(({ label }) => (
          <a
            key={label}
            href={`/${locale}/matches?date=${label}`}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              label === selectedDate
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </a>
        ))}
      </div>

      {/* Today's matches */}
      <section className="mb-10">
        <SectionHeader title={t("today")} />
        {todayFixtures.length > 0 ? (
          <MatchList fixtures={todayFixtures} locale={locale} />
        ) : (
          <p className="text-muted-foreground text-center py-8">{t("noMatches")}</p>
        )}
      </section>

      {/* Recent results */}
      {yesterdayFixtures.length > 0 && (
        <section className="mb-10">
          <SectionHeader title={t("recent")} />
          <MatchList fixtures={yesterdayFixtures} locale={locale} />
        </section>
      )}

      {/* Upcoming */}
      {tomorrowFixtures.length > 0 && (
        <section>
          <SectionHeader title={t("upcoming")} />
          <MatchList fixtures={tomorrowFixtures} locale={locale} />
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(frontend)/[locale]/matches/page.tsx"
git commit -m "feat: add matches page with today, recent, and upcoming fixtures"
```

---

## Task 8: Single Match Page

**Files:**
- Create: `src/app/(frontend)/[locale]/matches/[id]/page.tsx`

- [ ] **Step 1: Create single match page**

Create `src/app/(frontend)/[locale]/matches/[id]/page.tsx`:

```tsx
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getFixtureById } from "@/lib/api-football/fixtures";
import { getMatchStatus } from "@/lib/api-football/types";
import { cn, formatDate, formatTime } from "@/lib/utils";
import { MatchEvents } from "@/components/football/MatchEvents";
import { MatchLineup } from "@/components/football/MatchLineup";
import { MatchStats } from "@/components/football/MatchStats";
import { SectionHeader } from "@/components/shared/SectionHeader";

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const fixture = await getFixtureById(Number(id));
  if (!fixture) return { title: "Not Found" };
  return {
    title: `${fixture.teams.home.name} vs ${fixture.teams.away.name} | MFM Sport`,
  };
}

export default async function MatchPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const fixture = await getFixtureById(Number(id));
  if (!fixture) notFound();

  const t = await getTranslations({ locale, namespace: "match" });
  const status = getMatchStatus(fixture.fixture.status.short);
  const { home, away } = fixture.teams;
  const goals = fixture.goals;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* League info */}
      <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
        <Image src={fixture.league.logo} alt={fixture.league.name} width={20} height={20} />
        <span>{fixture.league.name}</span>
        <span>·</span>
        <span>{fixture.league.round}</span>
      </div>

      {/* Score header */}
      <div className="bg-card rounded-lg border border-border p-6 mb-8">
        <div className="flex items-center justify-between">
          {/* Home */}
          <div className="flex flex-col items-center gap-2 flex-1">
            <Image src={home.logo} alt={home.name} width={56} height={56} />
            <span className={cn("text-sm font-medium text-center", home.winner && "font-bold")}>
              {home.name}
            </span>
          </div>

          {/* Score */}
          <div className="flex flex-col items-center mx-4">
            {status === "scheduled" ? (
              <>
                <span className="text-2xl font-bold text-muted-foreground">vs</span>
                <span className="text-sm text-muted-foreground mt-1">
                  {formatTime(fixture.fixture.date, locale)}
                </span>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 text-4xl font-bold tabular-nums">
                  <span>{goals.home ?? 0}</span>
                  <span className="text-muted-foreground text-2xl">-</span>
                  <span>{goals.away ?? 0}</span>
                </div>
                <span
                  className={cn(
                    "text-xs font-medium mt-1 px-2 py-0.5 rounded",
                    status === "live" && "bg-live/20 text-live",
                    status === "finished" && "bg-secondary text-muted-foreground",
                  )}
                >
                  {status === "live"
                    ? `${t("live")} ${fixture.fixture.status.elapsed || ""}'`
                    : t("fullTime")}
                </span>
              </>
            )}
          </div>

          {/* Away */}
          <div className="flex flex-col items-center gap-2 flex-1">
            <Image src={away.logo} alt={away.name} width={56} height={56} />
            <span className={cn("text-sm font-medium text-center", away.winner && "font-bold")}>
              {away.name}
            </span>
          </div>
        </div>

        {/* Match info */}
        <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-4 text-xs text-muted-foreground justify-center">
          <span>{formatDate(fixture.fixture.date, locale)}</span>
          {fixture.fixture.venue?.name && <span>{fixture.fixture.venue.name}</span>}
          {fixture.fixture.referee && <span>{fixture.fixture.referee}</span>}
        </div>
      </div>

      {/* Events */}
      {fixture.events && fixture.events.length > 0 && (
        <section className="mb-8">
          <SectionHeader title={t("events")} />
          <div className="bg-card rounded-lg border border-border p-4">
            <MatchEvents events={fixture.events} homeTeamId={home.id} />
          </div>
        </section>
      )}

      {/* Statistics */}
      {fixture.statistics && fixture.statistics.length >= 2 && (
        <section className="mb-8">
          <SectionHeader title={t("statistics")} />
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="flex justify-between text-sm font-medium mb-4">
              <div className="flex items-center gap-2">
                <Image src={home.logo} alt={home.name} width={16} height={16} />
                <span>{home.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span>{away.name}</span>
                <Image src={away.logo} alt={away.name} width={16} height={16} />
              </div>
            </div>
            <MatchStats statistics={fixture.statistics} />
          </div>
        </section>
      )}

      {/* Lineups */}
      {fixture.lineups && fixture.lineups.length >= 2 && (
        <section className="mb-8">
          <SectionHeader title={t("lineup")} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fixture.lineups.map((lineup) => (
              <div key={lineup.team.id} className="bg-card rounded-lg border border-border p-4">
                <MatchLineup
                  lineup={lineup}
                  labels={{
                    startingXI: t("startingXI"),
                    substitutes: t("substitutes"),
                    coach: t("coach"),
                    formation: t("formation"),
                  }}
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(frontend)/[locale]/matches/[id]/"
git commit -m "feat: add single match page with score, events, stats, lineups"
```

---

## Task 9: Competition Page

**Files:**
- Create: `src/app/(frontend)/[locale]/competition/[slug]/page.tsx`

- [ ] **Step 1: Create competition page**

Create `src/app/(frontend)/[locale]/competition/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getCompetitionBySlug, getArticlesByCompetition } from "@/lib/payload/queries";
import { getStandings } from "@/lib/api-football/standings";
import { getFixturesByLeague } from "@/lib/api-football/fixtures";
import { StandingsTable } from "@/components/football/StandingsTable";
import { MatchList } from "@/components/football/MatchList";
import { ArticleGrid } from "@/components/articles/ArticleGrid";
import { SectionHeader } from "@/components/shared/SectionHeader";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const competition = await getCompetitionBySlug(slug, locale);
  if (!competition) return { title: "Not Found" };
  return { title: `${competition.name} | MFM Sport` };
}

export default async function CompetitionPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const competition = await getCompetitionBySlug(slug, locale);
  if (!competition) notFound();

  const tComp = await getTranslations({ locale, namespace: "competition" });
  const tMatch = await getTranslations({ locale, namespace: "match" });

  const leagueId = competition.apiFootballId;
  const season = competition.season;

  // Fetch standings, recent and upcoming fixtures in parallel
  const [standings, recentFixtures, upcomingFixtures, articles] = await Promise.all([
    competition.type === "league" ? getStandings(leagueId, season) : Promise.resolve([]),
    getFixturesByLeague(leagueId, season, { last: 10 }),
    getFixturesByLeague(leagueId, season, { next: 10 }),
    competition.category && typeof competition.category === "object"
      ? getArticlesByCompetition(competition.category.id, locale, 6)
      : Promise.resolve({ docs: [] }),
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <h1 className="text-2xl font-bold mb-6">{competition.name}</h1>

      {/* Standings (league only) */}
      {standings.length > 0 && (
        <section className="mb-10">
          <SectionHeader title={tComp("standings")} />
          <StandingsTable
            standings={standings}
            locale={locale}
            labels={{
              team: tComp("team"),
              played: tComp("played"),
              won: tComp("won"),
              drawn: tComp("drawn"),
              lost: tComp("lost"),
              goalsFor: tComp("goalsFor"),
              goalsAgainst: tComp("goalsAgainst"),
              goalDiff: tComp("goalDiff"),
              points: tComp("points"),
              form: tComp("form"),
            }}
          />
        </section>
      )}

      {/* Recent results */}
      {recentFixtures.length > 0 && (
        <section className="mb-10">
          <SectionHeader title={tComp("results")} />
          <MatchList fixtures={recentFixtures} locale={locale} groupByLeague={false} />
        </section>
      )}

      {/* Upcoming fixtures */}
      {upcomingFixtures.length > 0 && (
        <section className="mb-10">
          <SectionHeader title={tComp("fixtures")} />
          <MatchList fixtures={upcomingFixtures} locale={locale} groupByLeague={false} />
        </section>
      )}

      {/* Related news */}
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
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(frontend)/[locale]/competition/"
git commit -m "feat: add competition page with standings, fixtures, results, news"
```

---

## Task 10: Club Page

**Files:**
- Create: `src/app/(frontend)/[locale]/club/[slug]/page.tsx`

- [ ] **Step 1: Create club page**

Create `src/app/(frontend)/[locale]/club/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getClubBySlug } from "@/lib/payload/queries";
import { getPayloadClient } from "@/lib/payload/queries";
import { getFixturesByTeam } from "@/lib/api-football/fixtures";
import { getImageUrl } from "@/lib/utils";
import { MatchList } from "@/components/football/MatchList";
import { ArticleGrid } from "@/components/articles/ArticleGrid";
import { SectionHeader } from "@/components/shared/SectionHeader";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const club = await getClubBySlug(slug, locale);
  if (!club) return { title: "Not Found" };
  return { title: `${club.name} | MFM Sport` };
}

export default async function ClubPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const club = await getClubBySlug(slug, locale);
  if (!club) notFound();

  const tClub = await getTranslations({ locale, namespace: "club" });

  // Fetch fixtures and articles in parallel
  const payload = await getPayloadClient();

  const [recentFixtures, upcomingFixtures, articlesResult] = await Promise.all([
    club.apiFootballId
      ? getFixturesByTeam(club.apiFootballId, 2025, { last: 5 })
      : Promise.resolve([]),
    club.apiFootballId
      ? getFixturesByTeam(club.apiFootballId, 2025, { next: 5 })
      : Promise.resolve([]),
    payload.find({
      collection: "articles",
      where: {
        status: { equals: "published" },
      },
      locale,
      limit: 6,
      sort: "-publishedAt",
      depth: 2,
    }),
  ]);

  const logoUrl = getImageUrl(club.logo, "thumbnail");

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Club header */}
      <div className="flex items-center gap-4 mb-8">
        {logoUrl && (
          <Image src={logoUrl} alt={club.name} width={64} height={64} />
        )}
        <div>
          <h1 className="text-2xl font-bold">{club.name}</h1>
          <div className="flex gap-3 text-sm text-muted-foreground mt-1">
            {club.country && <span>{club.country}</span>}
            {club.venue && (
              <>
                <span>·</span>
                <span>{tClub("venue")}: {club.venue}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Recent matches */}
      {recentFixtures.length > 0 && (
        <section className="mb-10">
          <SectionHeader title={tClub("recentMatches")} />
          <MatchList fixtures={recentFixtures} locale={locale} groupByLeague={false} />
        </section>
      )}

      {/* Upcoming matches */}
      {upcomingFixtures.length > 0 && (
        <section className="mb-10">
          <SectionHeader title={tClub("upcomingMatches")} />
          <MatchList fixtures={upcomingFixtures} locale={locale} groupByLeague={false} />
        </section>
      )}

      {/* News */}
      {articlesResult.docs.length > 0 && (
        <section>
          <SectionHeader title={tClub("news")} />
          <ArticleGrid articles={articlesResult.docs} locale={locale} columns={3} />
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(frontend)/[locale]/club/"
git commit -m "feat: add club page with info, fixtures, and news"
```

---

## Task 11: Homepage Enhancement — Today's Matches

**Files:**
- Modify: `src/app/(frontend)/[locale]/page.tsx`

- [ ] **Step 1: Add today's matches to homepage**

Read the existing `src/app/(frontend)/[locale]/page.tsx` and add a matches section. Import the football components and add a section between the hero and top news:

Add imports:
```tsx
import { getFixturesByDate } from "@/lib/api-football/fixtures";
import { MatchList } from "@/components/football/MatchList";
```

Inside the component, after the `getArticles` call, add:
```tsx
const today = new Date().toISOString().split("T")[0];
const todayFixtures = await getFixturesByDate(today);
```

After the `<HeroSection>` and before the first `<NewsSection>`, add:
```tsx
{todayFixtures.length > 0 && (
  <section className="mt-10">
    <SectionHeader
      title={t("todayMatches")}
      href={`/${locale}/matches`}
      linkText={tCommon("readMore")}
    />
    <MatchList fixtures={todayFixtures.slice(0, 10)} locale={locale} />
  </section>
)}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(frontend)/[locale]/page.tsx"
git commit -m "feat: add today's matches section to homepage"
```

---

## Self-Review

**Spec coverage (from PROJECT_MEMORY.md §15, §18):**
- API-Football service layer with typed client: Task 1
- Fixtures by date/league/team: Task 1 (`fixtures.ts`)
- Standings: Task 1 (`standings.ts`)
- Competitions collection with apiFootballId: Task 2
- Clubs collection with apiFootballId: Task 2
- Matches page (today + upcoming + recent): Task 7
- Single match page (lineups, events, stats): Task 8
- Competition page (standings + fixtures + news): Task 9
- Club page (info + news + fixtures): Task 10
- Homepage with today's matches: Task 11
- ISR caching (revalidate 60s): Built into `fetchApi` client
- Graceful fallback when API key missing: Built into `fetchApi` client
- Football semantic colors (win/loss/draw/live): Used in StandingsTable, MatchCard, MatchEvents

**No gaps found.**

**Type consistency:** All components use `ApiFixture`, `ApiStandingRow`, `ApiEvent`, `ApiLineup`, `ApiTeamStatistics` from `types.ts`. Query helpers use consistent `locale: string` + Payload ID types. `getMatchStatus()` is used consistently across MatchCard and match page.

---

*Plan written 2026-04-20. Ready for execution.*
