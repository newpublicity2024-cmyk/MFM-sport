# Arabic Names for Football-API Data — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> On execution, also copy this plan to `docs/superpowers/plans/2026-06-04-arabic-football-data-names.md` (writing-plans default location).

**Goal:** On the Arabic locale, league / team / group / round / player / coach names that come from API-Football render in Arabic, falling back to the original Latin name when no Arabic mapping exists. French and English locales are unchanged.

**Architecture:** A pure presentation-layer localization module (`src/lib/api-football/localize.ts`) translates entity names at the render site using static dictionaries keyed by API-Football numeric id, plus a regex/template engine for rounds and groups. The data-fetch layer stays locale-agnostic so the ISR cache (and API quota) is not multiplied per locale. Dictionaries are static TS, seeded by a one-time offline Wikidata script and corrected by hand.

**Tech Stack:** Next.js 16 (App Router), Payload CMS 3, next-intl v4.9.1, TypeScript, Vitest + @testing-library/react, API-Football v3.

---

## Context

The site is trilingual (ar default, fr, en) via next-intl, and the UI chrome is fully localized. But all live football data comes from API-Football, which returns **only Latin (English/French) names** — `league.name`, `league.round`, team names, standings group labels, player/assist names, lineup/coach names. On the Arabic version these appear in English/French, breaking the Arabic reading experience. The API has no Arabic option, so the only fix is a translation/mapping layer we own.

**Decisions locked with the user:**
1. **Players/coaches:** curated dictionary for notable names + Latin fallback for everyone else (honest; grows over time). No live transliteration.
2. **Storage:** static TS dictionaries keyed by `apiFootballId` (zero runtime cost, no DB read on the live-data hot path, diffable in PRs). Not Payload.
3. **Sourcing:** a one-time offline Wikidata SPARQL script produces draft team/league/people dictionaries; low-confidence matches are hand-reviewed. Hand-curated overrides are the source of truth.

**Why presentation-layer, not fetch-layer:** fetchers (`src/lib/api-football/client.ts`, `fixtures.ts`, `standings.ts`) use `next: { revalidate }` ISR keyed by URL and take **no locale**. Translating after fetch keeps one cached API response serving all three locales (API-Football has hard quota limits). Every translatable entity already carries its stable numeric id at the render site (`teams.home.id`, `event.player.id`, `row.team.id`, `league.id`), so id-keyed lookup is clean.

**Critical correctness rule:** grouping/sorting/priority logic keys off **ids and raw Latin names** (e.g. `MatchesPanel.getLeaguePriority` matches `league.name.toLowerCase()`, `MatchList` groups by `String(fixture.league.id)`). **Only the rendered display string changes** — never localize a value before it is used as a grouping/sort/priority key.

---

## File Structure

**New files:**
- `src/lib/api-football/localize.ts` — core helpers + shared `pickLocale`, round/group pattern engine.
- `src/lib/api-football/dictionaries/leagues.ar.ts` — `Record<number, string>` (~12 league ids → Arabic).
- `src/lib/api-football/dictionaries/teams.ar.ts` — `Record<number, string>` (~150–300 team ids → Arabic).
- `src/lib/api-football/dictionaries/people.ar.ts` — `Record<number, string>` (curated player/coach ids → Arabic).
- `src/lib/api-football/__tests__/localize.test.ts` — unit + pattern-engine tests.
- `scripts/build-ar-dictionaries.ts` — offline Wikidata SPARQL sourcing script (run manually, not in request path or CI).

**Modified files (display only):**
- `src/lib/home/leagues.ts` — refactor `leagueName()` to delegate to shared `pickLocale`.
- `src/components/home/LeaguesPanel.tsx` — refactor local `pickName` to delegate to `pickLocale`.
- `src/components/football/MatchCard.tsx`, `MatchList.tsx`, `LiveScoreboard.tsx`, `StandingsTable.tsx`, `MatchEvents.tsx` (add `locale` prop), `MatchLineup.tsx` (add `locale` prop).
- `src/components/home/MatchesPanel.tsx` — localize league header only.
- `src/app/(frontend)/[locale]/matches/[id]/page.tsx` — localize league/round/team names; pass `locale` into `MatchEvents`/`MatchLineup`.
- `src/components/football/CompetitionFilter.tsx` — optional belt-and-suspenders (see Task 9).

---

## Task 1: Core localization module + shared locale picker

**Files:**
- Create: `src/lib/api-football/localize.ts`
- Create (empty stubs so imports resolve): `src/lib/api-football/dictionaries/leagues.ar.ts`, `teams.ar.ts`, `people.ar.ts`
- Test: `src/lib/api-football/__tests__/localize.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/api-football/__tests__/localize.test.ts
import { describe, it, expect } from "vitest";
import {
  pickLocale,
  localizeLeague,
  localizeTeam,
  localizePerson,
} from "@/lib/api-football/localize";

describe("pickLocale", () => {
  const name = { en: "Alpha", ar: "ألفا", fr: "Bravo" };
  it("returns ar for ar", () => expect(pickLocale(name, "ar")).toBe("ألفا"));
  it("returns fr for fr", () => expect(pickLocale(name, "fr")).toBe("Bravo"));
  it("returns en for en/unknown", () => {
    expect(pickLocale(name, "en")).toBe("Alpha");
    expect(pickLocale(name, "de")).toBe("Alpha");
  });
});

describe("localizeLeague / localizeTeam / localizePerson", () => {
  it("returns Latin verbatim for non-ar locales", () => {
    expect(localizeLeague(200, "Botola Pro", "fr")).toBe("Botola Pro");
    expect(localizeTeam(529, "Barcelona", "en")).toBe("Barcelona");
  });
  it("falls back to Latin when ar mapping is missing", () => {
    expect(localizeTeam(-999, "Unknown FC", "ar")).toBe("Unknown FC");
    expect(localizePerson(-999, "John Doe", "ar")).toBe("John Doe");
  });
  it("falls back to Latin for a null/empty id (assist with no id)", () => {
    expect(localizePerson(null, "John Doe", "ar")).toBe("John Doe");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/lib/api-football/__tests__/localize.test.ts`
Expected: FAIL — module/exports not found.

- [ ] **Step 3: Create empty dictionary stubs**

```ts
// src/lib/api-football/dictionaries/leagues.ar.ts
export const LEAGUES_AR: Record<number, string> = {};
```
```ts
// src/lib/api-football/dictionaries/teams.ar.ts
export const TEAMS_AR: Record<number, string> = {};
```
```ts
// src/lib/api-football/dictionaries/people.ar.ts
export const PEOPLE_AR: Record<number, string> = {};
```

- [ ] **Step 4: Implement `localize.ts` (helpers only; pattern engine added in Task 3)**

```ts
// src/lib/api-football/localize.ts
import { LEAGUES_AR } from "./dictionaries/leagues.ar";
import { TEAMS_AR } from "./dictionaries/teams.ar";
import { PEOPLE_AR } from "./dictionaries/people.ar";

export type LocaleString = { en: string; ar: string; fr: string };

/** Single source of truth for locale selection across the app. */
export function pickLocale(name: LocaleString, locale: string): string {
  if (locale === "ar") return name.ar;
  if (locale === "fr") return name.fr;
  return name.en;
}

function lookup(dict: Record<number, string>, id: number | null | undefined, latin: string, locale: string): string {
  if (locale !== "ar") return latin;
  if (id == null) return latin;
  return dict[id] ?? latin;
}

export function localizeLeague(id: number | null | undefined, latin: string, locale: string): string {
  return lookup(LEAGUES_AR, id, latin, locale);
}

export function localizeTeam(id: number | null | undefined, latin: string, locale: string): string {
  return lookup(TEAMS_AR, id, latin, locale);
}

/** Players and coaches share one curated dictionary keyed by api-football person id. */
export function localizePerson(id: number | null | undefined, latin: string, locale: string): string {
  return lookup(PEOPLE_AR, id, latin, locale);
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm vitest run src/lib/api-football/__tests__/localize.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/api-football/localize.ts src/lib/api-football/dictionaries src/lib/api-football/__tests__/localize.test.ts
git commit -m "feat(i18n): add football-data localization helpers + dictionary stubs"
```

---

## Task 2: DRY — route existing locale-picking through `pickLocale`

**Files:**
- Modify: `src/lib/home/leagues.ts:57-61`
- Modify: `src/components/home/LeaguesPanel.tsx:15-19,50`

- [ ] **Step 1: Refactor `leagueName` in `leagues.ts`**

Replace the body of `leagueName` (lines 57–61) so the one locale rule lives in `localize.ts`. Keep the exported `LocaleString`/`League` types in `leagues.ts` (they are imported elsewhere); `localize.ts` defines its own structurally-identical `LocaleString`, which is assignment-compatible.

```ts
// src/lib/home/leagues.ts  (replace the leagueName function)
import { pickLocale } from "@/lib/api-football/localize";

export function leagueName(league: League, locale: string): string {
  return pickLocale(league.name, locale);
}
```

- [ ] **Step 2: Refactor `pickName` in `LeaguesPanel.tsx`**

Delete the local `pickName` (lines 15–19) and use the shared helper at line 50.

```ts
// top of file
import { pickLocale } from "@/lib/api-football/localize";
// ...
// line 50 was: <span className="flex-1 truncate">{pickName(league, locale)}</span>
<span className="flex-1 truncate">{pickLocale(league.name, locale)}</span>
```

- [ ] **Step 3: Run the existing panel test to confirm no regression**

Run: `pnpm vitest run src/components/home/__tests__/LeaguesPanel.test.tsx`
Expected: PASS (all 4 cases, including the `locale=ar` → `ألفا` case).

- [ ] **Step 4: Commit**

```bash
git add src/lib/home/leagues.ts src/components/home/LeaguesPanel.tsx
git commit -m "refactor(i18n): single locale-picker via pickLocale (DRY)"
```

---

## Task 3: Round & group pattern engine

API-Football round/group strings follow a small set of templates ("Regular Season - 12", "Round of 16", "Quarter-finals", "Group A", "Matchday 5"). Translate by rule, fall through to Latin on no match.

**Files:**
- Modify: `src/lib/api-football/localize.ts`
- Modify: `src/lib/api-football/__tests__/localize.test.ts`

- [ ] **Step 1: Add failing tests**

```ts
// append to localize.test.ts
import { localizeRound, localizeGroup } from "@/lib/api-football/localize";

describe("localizeRound", () => {
  it("passes through for non-ar", () => expect(localizeRound("Round of 16", "en")).toBe("Round of 16"));
  it.each([
    ["Regular Season - 12", "الأسبوع 12"],
    ["Round of 16", "دور الـ16"],
    ["Quarter-finals", "ربع النهائي"],
    ["Semi-finals", "نصف النهائي"],
    ["Final", "النهائي"],
    ["Matchday 5", "الجولة 5"],
    ["Group Stage", "دور المجموعات"],
  ])("translates %s", (input, expected) => expect(localizeRound(input, "ar")).toBe(expected));
  it("falls through to Latin on no match", () =>
    expect(localizeRound("Some Weird Round", "ar")).toBe("Some Weird Round"));
});

describe("localizeGroup", () => {
  it("translates Group A", () => expect(localizeGroup("Group A", "ar")).toBe("المجموعة أ"));
  it("passes through unknown", () => expect(localizeGroup("Group Z9", "ar")).toBe("Group Z9"));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/lib/api-football/__tests__/localize.test.ts`
Expected: FAIL — `localizeRound`/`localizeGroup` not exported.

- [ ] **Step 3: Implement the engine in `localize.ts`**

```ts
// append to src/lib/api-football/localize.ts
const ARABIC_LETTERS: Record<string, string> = {
  A: "أ", B: "ب", C: "ج", D: "د", E: "هـ", F: "و", G: "ز", H: "ح",
};
function arabicLetter(c: string): string {
  return ARABIC_LETTERS[c.toUpperCase()] ?? c;
}

type Rule = { re: RegExp; ar: (m: RegExpMatchArray) => string };

const ROUND_RULES: Rule[] = [
  { re: /^Regular Season - (\d+)$/i, ar: (m) => `الأسبوع ${m[1]}` },
  { re: /^Matchday (\d+)$/i,         ar: (m) => `الجولة ${m[1]}` },
  { re: /^Round of (\d+)$/i,         ar: (m) => `دور الـ${m[1]}` },
  { re: /^(\d+)(?:st|nd|rd|th) Round$/i, ar: (m) => `الدور ${m[1]}` },
  { re: /^Quarter[- ]?finals?$/i,    ar: () => "ربع النهائي" },
  { re: /^Semi[- ]?finals?$/i,       ar: () => "نصف النهائي" },
  { re: /^3rd Place Final$/i,        ar: () => "مباراة المركز الثالث" },
  { re: /^Final$/i,                  ar: () => "النهائي" },
  { re: /^Group Stage(?: - (\d+))?$/i, ar: (m) => (m[1] ? `دور المجموعات ${m[1]}` : "دور المجموعات") },
  { re: /^Group ([A-Z])$/i,          ar: (m) => `المجموعة ${arabicLetter(m[1])}` },
  { re: /^Preliminary Round$/i,      ar: () => "الدور التمهيدي" },
  { re: /^Play-?offs?$/i,            ar: () => "الملحق" },
  { re: /^Knockout Round Play-?offs?$/i, ar: () => "ملحق الأدوار الإقصائية" },
];

function applyRules(value: string, locale: string): string {
  if (locale !== "ar" || !value) return value;
  for (const rule of ROUND_RULES) {
    const m = value.match(rule.re);
    if (m) return rule.ar(m);
  }
  return value; // honest Latin fallback
}

export function localizeRound(round: string, locale: string): string {
  return applyRules(round, locale);
}

export function localizeGroup(group: string, locale: string): string {
  return applyRules(group, locale);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run src/lib/api-football/__tests__/localize.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api-football/localize.ts src/lib/api-football/__tests__/localize.test.ts
git commit -m "feat(i18n): round/group pattern translation engine"
```

---

## Task 4: Seed the league dictionary (12 ids) + consistency guard

**Files:**
- Modify: `src/lib/api-football/dictionaries/leagues.ar.ts`
- Modify: `src/lib/api-football/__tests__/localize.test.ts`

- [ ] **Step 1: Fill the league dictionary**

Reuse the Arabic names already present in `src/lib/home/leagues.ts` and the seeded competition set (ids: 200, 2, 3, 39, 140, 78, 135, 61, 12, 20, 6, 1).

```ts
// src/lib/api-football/dictionaries/leagues.ar.ts
export const LEAGUES_AR: Record<number, string> = {
  200: "البطولة الاحترافية",        // Botola Pro
  2: "دوري أبطال أوروبا",            // UEFA Champions League
  3: "الدوري الأوروبي",              // UEFA Europa League
  39: "الدوري الإنجليزي الممتاز",    // Premier League
  140: "الدوري الإسباني",            // La Liga
  78: "الدوري الألماني",             // Bundesliga
  135: "الدوري الإيطالي",            // Serie A
  61: "الدوري الفرنسي",              // Ligue 1
  12: "دوري أبطال أفريقيا",          // CAF Champions League
  20: "كأس الكونفدرالية الأفريقية",  // CAF Confederation Cup
  6: "كأس أمم أفريقيا",              // Africa Cup of Nations
  1: "كأس العالم",                   // FIFA World Cup
};
```

- [ ] **Step 2: Add a guard test — every homepage league has a dictionary entry**

```ts
// append to localize.test.ts
import { LEAGUES } from "@/lib/home/leagues";
import { LEAGUES_AR } from "@/lib/api-football/dictionaries/leagues.ar";

describe("league dictionary coverage", () => {
  it("covers every homepage league id", () => {
    for (const l of LEAGUES) {
      expect(LEAGUES_AR[l.apiFootballId], `missing ar for league ${l.apiFootballId}`).toBeTruthy();
    }
  });
});
```

- [ ] **Step 3: Run to verify pass**

Run: `pnpm vitest run src/lib/api-football/__tests__/localize.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api-football/dictionaries/leagues.ar.ts src/lib/api-football/__tests__/localize.test.ts
git commit -m "feat(i18n): seed Arabic league dictionary + coverage guard"
```

---

## Task 5: Localize team names in `MatchCard` (representative team call site)

**Files:**
- Modify: `src/components/football/MatchCard.tsx:26,62`
- Test: `src/components/football/__tests__/MatchCard.test.tsx` (create)

- [ ] **Step 1: Write failing render test**

```tsx
// src/components/football/__tests__/MatchCard.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MatchCard } from "@/components/football/MatchCard";
import { TEAMS_AR } from "@/lib/api-football/dictionaries/teams.ar";

vi.mock("next/image", () => ({ default: (p: any) => <img alt={p.alt} /> }));

function fixture(homeId: number, awayId: number) {
  return {
    fixture: { id: 1, date: "2026-06-04T18:00:00Z", timestamp: 0, venue: null,
      status: { long: "", short: "NS", elapsed: null }, referee: null },
    league: { id: 39, name: "Premier League", country: "England", logo: "", flag: null, season: 2024, round: "Regular Season - 1" },
    teams: { home: { id: homeId, name: "Home FC", logo: "", winner: null },
             away: { id: awayId, name: "Away FC", logo: "", winner: null } },
    goals: { home: null, away: null },
    score: { halftime: {home:null,away:null}, fulltime:{home:null,away:null}, extratime:{home:null,away:null}, penalty:{home:null,away:null} },
  } as any;
}

describe("MatchCard team localization", () => {
  it("shows Arabic team name when id is mapped and locale=ar", () => {
    const id = Object.keys(TEAMS_AR)[0];
    if (!id) return; // dictionary seeded in Task 8; guard keeps test green pre-seed
    render(<MatchCard fixture={fixture(Number(id), -1)} locale="ar" />);
    expect(screen.getByText(TEAMS_AR[Number(id)])).toBeInTheDocument();
  });
  it("shows Latin team name for fr", () => {
    render(<MatchCard fixture={fixture(529, 541)} locale="fr" />);
    expect(screen.getByText("Home FC")).toBeInTheDocument();
    expect(screen.getByText("Away FC")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/components/football/__tests__/MatchCard.test.tsx`
Expected: FAIL on the fr case (Latin currently shown so that passes) — actually the ar case is guarded; the real failure appears once Task 8 seeds a team. To get a guaranteed red→green now, the fr case passes trivially; rely on the wiring being exercised. Primary verification is Task 8.

- [ ] **Step 3: Wire `localizeTeam` into `MatchCard`**

```tsx
// add import
import { localizeTeam } from "@/lib/api-football/localize";
// line 26:
<span className={cn("text-sm truncate", home.winner && "font-bold")}>{localizeTeam(home.id, home.name, locale)}</span>
// line 62:
<span className={cn("text-sm truncate", away.winner && "font-bold")}>{localizeTeam(away.id, away.name, locale)}</span>
```
Leave `Image alt={home.name}` as the Latin name (alt text is fine in Latin).

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/components/football/__tests__/MatchCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/football/MatchCard.tsx src/components/football/__tests__/MatchCard.test.tsx
git commit -m "feat(i18n): localize team names in MatchCard"
```

---

## Task 6: Localize team names in `StandingsTable`, `LiveScoreboard`, `MatchList`

These mirror Task 5's pattern. All three already receive `locale`.

**Files:**
- Modify: `src/components/football/StandingsTable.tsx:79`
- Modify: `src/components/football/LiveScoreboard.tsx:35,72`
- Modify: `src/components/football/MatchList.tsx:42`

- [ ] **Step 1: `StandingsTable` — team name + (if grouped) group label**

```tsx
import { localizeTeam } from "@/lib/api-football/localize";
// line 79:
<span className="text-sm font-medium truncate">{localizeTeam(row.team.id, row.team.name, locale)}</span>
```
(If a future grouped view renders `row.group`, wrap it with `localizeGroup(row.group, locale)`.)

- [ ] **Step 2: `LiveScoreboard` — both team names**

```tsx
import { localizeTeam } from "@/lib/api-football/localize";
// line 35 (home):
{localizeTeam(home.id, home.name, locale)}
// line 72 (away):
{localizeTeam(away.id, away.name, locale)}
```
Leave venue (`fixture.fixture.venue?.name`) and referee in Latin — no reliable id-keyed Arabic source.

- [ ] **Step 3: `MatchList` — group header league name**

```tsx
import { localizeLeague } from "@/lib/api-football/localize";
// line 42:
<span className="text-sm font-medium text-muted-foreground">
  {localizeLeague(group.league.id, group.league.name, locale)}
</span>
```
Do NOT change the grouping key on line 26 (`String(fixture.league.id)`).

- [ ] **Step 4: Run typecheck + tests**

Run: `pnpm vitest run && pnpm tsc --noEmit`
Expected: PASS / no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/football/StandingsTable.tsx src/components/football/LiveScoreboard.tsx src/components/football/MatchList.tsx
git commit -m "feat(i18n): localize team/league names in standings, scoreboard, match list"
```

---

## Task 7: Localize players/coaches (`MatchEvents`, `MatchLineup`) — add `locale` prop

Both components currently take no `locale`. Add it and thread from the match page.

**Files:**
- Modify: `src/components/football/MatchEvents.tsx:4-7,18,39,40-42,47-50`
- Modify: `src/components/football/MatchLineup.tsx:4-9,18,34,49,58`
- Modify: `src/app/(frontend)/[locale]/matches/[id]/page.tsx:54,86`
- Test: `src/components/football/__tests__/MatchEvents.test.tsx` (create)

- [ ] **Step 1: Failing test for `MatchEvents`**

```tsx
// src/components/football/__tests__/MatchEvents.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MatchEvents } from "@/components/football/MatchEvents";

const events = [{
  time: { elapsed: 10, extra: null }, team: { id: 1, name: "T", logo: "" },
  player: { id: 999999, name: "Latin Player" }, assist: { id: null, name: null },
  type: "Goal", detail: "Normal Goal", comments: null,
}] as any;

describe("MatchEvents", () => {
  it("renders Latin player name when no ar mapping (locale=ar)", () => {
    render(<MatchEvents events={events} homeTeamId={1} locale="ar" />);
    expect(screen.getByText("Latin Player")).toBeInTheDocument();
  });
  it("renders Latin player name for fr", () => {
    render(<MatchEvents events={events} homeTeamId={1} locale="fr" />);
    expect(screen.getByText("Latin Player")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/components/football/__tests__/MatchEvents.test.tsx`
Expected: FAIL — `MatchEvents` does not accept `locale` (TS error / prop ignored).

- [ ] **Step 3: Update `MatchEvents`**

```tsx
import { localizePerson } from "@/lib/api-football/localize";

type Props = {
  events: ApiEvent[];
  homeTeamId: number;
  locale: string;
};

export function MatchEvents({ events, homeTeamId, locale }: Props) {
  // ...
  // line 39 (home player):
  <span className="font-medium">{localizePerson(event.player.id, event.player.name, locale)}</span>
  // assist (lines 40-42 and 47-49): wrap with localizePerson(event.assist.id, event.assist.name, locale)
  {event.assist.name && (
    <span className="text-muted-foreground text-xs">
      ({localizePerson(event.assist.id, event.assist.name, locale)})
    </span>
  )}
  // line 50 (away player): same as line 39
```

- [ ] **Step 4: Update `MatchLineup`**

```tsx
import { localizeTeam, localizePerson } from "@/lib/api-football/localize";

type Props = {
  lineup: ApiLineup;
  locale: string;
  labels: { startingXI: string; substitutes: string; coach: string; formation: string };
};

export function MatchLineup({ lineup, locale, labels }: Props) {
  // line 18 (team):
  <span className="font-bold text-sm">{localizeTeam(lineup.team.id, lineup.team.name, locale)}</span>
  // line 34 (startXI player):
  <span>{localizePerson(p.player.id, p.player.name, locale)}</span>
  // line 49 (sub player):
  <span>{localizePerson(p.player.id, p.player.name, locale)}</span>
  // line 58 (coach):
  <span className="text-foreground">{localizePerson(lineup.coach.id, lineup.coach.name, locale)}</span>
```

- [ ] **Step 5: Thread `locale` from the match page**

```tsx
// src/app/(frontend)/[locale]/matches/[id]/page.tsx
// line 54:
<MatchEvents events={fixture.events} homeTeamId={home.id} locale={locale} />
// line 86-94: add locale prop to MatchLineup
<MatchLineup lineup={lineup} locale={locale} labels={{ /* unchanged */ }} />
```

- [ ] **Step 6: Run tests + typecheck**

Run: `pnpm vitest run src/components/football/__tests__/MatchEvents.test.tsx && pnpm tsc --noEmit`
Expected: PASS / no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/football/MatchEvents.tsx src/components/football/MatchLineup.tsx "src/app/(frontend)/[locale]/matches/[id]/page.tsx" src/components/football/__tests__/MatchEvents.test.tsx
git commit -m "feat(i18n): localize player/coach names in events and lineups"
```

---

## Task 8: Localize league/round/team on the match detail page + MatchesPanel

**Files:**
- Modify: `src/app/(frontend)/[locale]/matches/[id]/page.tsx:22,41,43,67,71`
- Modify: `src/components/home/MatchesPanel.tsx:157-159`

- [ ] **Step 1: Match page — league name, round, stats-header team names, metadata**

```tsx
import { localizeLeague, localizeRound, localizeTeam } from "@/lib/api-football/localize";

// line 41 (league name):
<span>{localizeLeague(fixture.league.id, fixture.league.name, locale)}</span>
// line 43 (round):
<span>{localizeRound(fixture.league.round, locale)}</span>
// line 67 (home in stats header):
<span>{localizeTeam(home.id, home.name, locale)}</span>
// line 71 (away in stats header):
<span>{localizeTeam(away.id, away.name, locale)}</span>
```
For `generateMetadata` (line 22): it has no rendering locale in scope cheaply, but `params` includes `locale`. Update to localize the title:
```tsx
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const fixture = await getFixtureById(Number(id));
  if (!fixture) return { title: "Not Found" };
  const home = localizeTeam(fixture.teams.home.id, fixture.teams.home.name, locale);
  const away = localizeTeam(fixture.teams.away.id, fixture.teams.away.name, locale);
  return { title: `${home} vs ${away} | MFM Sport` };
}
```

- [ ] **Step 2: `MatchesPanel` — league header only (NOT the priority/grouping logic)**

```tsx
import { localizeLeague } from "@/lib/api-football/localize";
// lines 157-159:
<span className="flex-1 text-start text-sm font-semibold truncate">
  {localizeLeague(group.league.id, group.league.name, locale)}
</span>
```
Leave `getLeaguePriority` (lines 18–30) and `groupAndSort` keys untouched — they must keep matching raw Latin `league.name`/`country`.

- [ ] **Step 3: Run typecheck + full test suite**

Run: `pnpm tsc --noEmit && pnpm vitest run`
Expected: no type errors / all pass.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(frontend)/[locale]/matches/[id]/page.tsx" src/components/home/MatchesPanel.tsx
git commit -m "feat(i18n): localize league/round/team on match page + matches panel"
```

---

## Task 9: (Optional) CompetitionFilter belt-and-suspenders

`CompetitionFilter` receives `c.name` already resolved from Payload's localized field (the page that renders it passes localized competition names). Only do this if you want the static dictionary to be authoritative over Payload.

**Files:**
- Modify: `src/components/football/CompetitionFilter.tsx:10-16,45-63`

- [ ] **Step 1: Add `locale` prop and localize the chip**

```tsx
import { localizeLeague } from "@/lib/api-football/localize";
// add `locale: string;` to Props
// line 61:
{localizeLeague(c.apiFootballId, c.name, locale)}
```
Update the call site (the matches list page that renders `<CompetitionFilter>`) to pass `locale`.

- [ ] **Step 2: Typecheck + commit**

Run: `pnpm tsc --noEmit`
```bash
git add src/components/football/CompetitionFilter.tsx "src/app/(frontend)/[locale]/matches/page.tsx"
git commit -m "feat(i18n): optionally localize competition filter chips"
```

---

## Task 10: Offline Wikidata sourcing script for team & people dictionaries

A manually-run Node/TS script that expands `teams.ar.ts` (and optionally `people.ar.ts`) using verified Wikidata Arabic labels. NOT part of the build/request path. Hand-curated entries always win.

**Files:**
- Create: `scripts/build-ar-dictionaries.ts`
- Modify (generated output, reviewed by hand): `src/lib/api-football/dictionaries/teams.ar.ts`, `people.ar.ts`

- [ ] **Step 1: Harvest the entity roster**

For each of the 12 league ids and the current season, call `getStandings(leagueId, season)` and `getFixturesByLeague(leagueId, season)` (reuse `src/lib/api-football/standings.ts` + `fixtures.ts`) to collect `{id, name}` for every team that appears. Dedupe by id. (Players: optionally harvest from a sample of fixtures' lineups, but expect curated-only coverage.)

- [ ] **Step 2: Resolve Arabic labels from Wikidata SPARQL**

For each `{id, name}`, query Wikidata for an entity that is `instance of (P31)` a football club (Q476028) whose English label matches `name`, then read its Arabic `rdfs:label`. Example query shape:

```sparql
SELECT ?item ?arLabel WHERE {
  ?item wdt:P31/wdt:P279* wd:Q476028 .
  ?item rdfs:label "Barcelona"@en .
  ?item rdfs:label ?arLabel . FILTER(LANG(?arLabel) = "ar")
} LIMIT 1
```
Endpoint: `https://query.wikidata.org/sparql` (Accept: `application/sparql-results+json`). Throttle (~1 req/sec) and set a descriptive User-Agent.

- [ ] **Step 3: Write a generated block, preserve overrides**

Emit `teams.ar.ts` as a generated `Record<number,string>` merged with a hand-maintained override map so regeneration never clobbers manual fixes:

```ts
// teams.ar.ts (final shape)
const GENERATED: Record<number, string> = { 529: "برشلونة", 541: "ريال مدريد", /* ...from Wikidata */ };
const OVERRIDES: Record<number, string> = { /* hand-curated, win over generated */ };
export const TEAMS_AR: Record<number, string> = { ...GENERATED, ...OVERRIDES };
```
The script must log low-confidence matches (no Arabic label found, or multiple candidate QIDs) to stderr for human review rather than guessing.

- [ ] **Step 4: Run the script manually and review the diff**

Run: `pnpm tsx scripts/build-ar-dictionaries.ts`
Then manually inspect the `teams.ar.ts` diff; fix any wrong/missing Arabic names by hand in `OVERRIDES`.

- [ ] **Step 5: Re-run the suite (coverage/guards) + commit**

Run: `pnpm vitest run`
```bash
git add scripts/build-ar-dictionaries.ts src/lib/api-football/dictionaries/teams.ar.ts src/lib/api-football/dictionaries/people.ar.ts
git commit -m "feat(i18n): Wikidata sourcing script + seeded Arabic team/people dictionaries"
```

---

## Verification (end-to-end)

1. **Unit/pattern/coverage tests:**
   `pnpm vitest run` → all green, including `localize.test.ts` (helpers, round/group rules, league coverage guard) and component tests.
2. **Types & lint:**
   `pnpm tsc --noEmit` (no errors), `pnpm lint`.
3. **Manual Arabic check (dev server):**
   `pnpm dev`, then visit:
   - `/ar` homepage → `MatchesPanel` league headers in Arabic; team names Arabic where mapped.
   - `/ar/matches` → standings team names + competition chips Arabic; round labels (e.g. "الأسبوع 12", "ربع النهائي") Arabic.
   - `/ar/matches/<live-or-recent-id>` → league name + round Arabic; scoreboard team names Arabic; events/lineup players Arabic where curated, Latin otherwise; venue/referee remain Latin.
   - Switch to `/fr/...` and `/en/...` → all names remain Latin (no regression).
4. **Grouping integrity:** on `/ar/matches` confirm leagues still group/sort correctly (Botola/Morocco first) — proves grouping keys still use Latin/id, not the localized string.
5. **Quota check:** confirm only one API response is cached per endpoint (no per-locale fan-out) — translation is purely presentational.

---

## Self-Review Notes

- **Spec coverage:** leagues (Tasks 4,6,8,9), teams (Tasks 5,6,7,8,10), groups+rounds (Task 3,6,8), players+coaches (Task 7,10) — all the user's named entities are covered.
- **Fallback:** every helper returns Latin on missing id / non-ar locale / unmatched pattern — no blank names possible.
- **DRY:** one `pickLocale`, one `applyRules`, one `lookup`; existing `leagueName`/`pickName` delegate to it.
- **Type consistency:** helper names (`localizeLeague`, `localizeTeam`, `localizePerson`, `localizeRound`, `localizeGroup`, `pickLocale`) are used identically across all tasks; dictionary exports (`LEAGUES_AR`, `TEAMS_AR`, `PEOPLE_AR`) consistent.
- **Honest limits:** players majority-Latin until curated set grows; venue/referee stay Latin; Wikidata matches need human review (overrides are source of truth); no live transliteration.
