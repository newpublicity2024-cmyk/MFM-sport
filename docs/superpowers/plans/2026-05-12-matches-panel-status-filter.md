# Matches Panel Status Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three floating filter buttons (Ended / Live / Upcoming) to the homepage `MatchesPanel`, fold the standalone `LiveNowSection`'s live polling into the panel, and remove the now-redundant `<LiveNowSection>` from the homepage.

**Architecture:** `MatchesPanel` gains a sticky filter bar at its top with three pill buttons. Each button toggles a single-select filter on `getMatchStatus` of each fixture. The panel mounts the existing `useLiveFixtures` hook and merges live results into today's fixtures by `fixture.id`, so scores update in real time without a page reload. `HeroSection` forwards the new `statusLabels` prop. The homepage page component computes the labels via `next-intl` and drops `<LiveNowSection>`, the `liveFixtures` data load, and the `getLiveFixtures` import.

**Tech Stack:** React `useState` + `useMemo`, existing `useLiveFixtures` hook, `getMatchStatus` from `@/lib/api-football/types`, Tailwind CSS (`sticky top-0`, `backdrop-blur`), `next-intl` translation namespaces.

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `messages/en.json` | Add `home.matchStatus.{finished,live,scheduled}` |
| Modify | `messages/ar.json` | Add `home.matchStatus.{finished,live,scheduled}` |
| Modify | `messages/fr.json` | Add `home.matchStatus.{finished,live,scheduled}` |
| Modify | `src/components/home/MatchesPanel.tsx` | Add filter bar, status filter state, live-fixture merge via `useLiveFixtures` |
| Modify | `src/components/home/HeroSection.tsx` | Accept `statusLabels` prop and forward to `MatchesPanel` |
| Modify | `src/app/(frontend)/[locale]/page.tsx` | Compute `statusLabels`; remove `LiveNowSection`, `getLiveFixtures`, `liveFixtures` |

---

## Design Notes

**Filter button order:** "Ended" → "Live" → "Upcoming". Matches the user's spoken order ("ended games, the ongoing games, and the expected games").

**Filter UX:** Single-select **toggle**. No filter pressed = all fixtures shown. Clicking a button activates it; clicking it again deactivates (back to all); clicking another switches.

**"Floating":** `sticky top-0 z-10` with a translucent `bg-background/95 backdrop-blur` so the bar floats over the scrolling list inside the panel's wrapper (`lg:h-full overflow-y-auto`).

**Live polling:** `useLiveFixtures({ initial: [], intervalMs: 60000, enabled: true })`. The hook already polls `/api/fixtures/live` on mount and every 60s, and respects page visibility. We merge by `fixture.id`: any live fixture with the same id replaces the server-rendered version of that fixture. Live fixtures not present in today's set (rare cross-timezone edge case) are ignored — today's panel is for today's matches only.

**Empty filter state:** If a filter is active and no fixtures match, the panel shows the filter bar plus an empty-state message. If no fixtures exist for the day at all, the entire panel renders nothing.

---

### Task 1: Add Translation Keys

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/ar.json`
- Modify: `messages/fr.json`

- [ ] **Step 1: Update `messages/en.json`**

Locate the `"home"` block (currently lines 35-38). Replace it with:

```json
  "home": {
    "topNews": "Top News",
    "latestNews": "Latest News",
    "matchStatus": {
      "finished": "Ended",
      "live": "Live",
      "scheduled": "Upcoming"
    }
  },
```

Add a trailing comma to `latestNews` because `matchStatus` is now after it.

- [ ] **Step 2: Update `messages/ar.json`**

Replace the `"home"` block with:

```json
  "home": {
    "topNews": "أهم الأخبار",
    "latestNews": "آخر الأخبار",
    "matchStatus": {
      "finished": "منتهية",
      "live": "مباشر",
      "scheduled": "قادمة"
    }
  },
```

- [ ] **Step 3: Update `messages/fr.json`**

Replace the `"home"` block with:

```json
  "home": {
    "topNews": "A la une",
    "latestNews": "Dernieres actualites",
    "matchStatus": {
      "finished": "Terminés",
      "live": "En direct",
      "scheduled": "À venir"
    }
  },
```

- [ ] **Step 4: Validate JSON**

Run each:

```
node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8'))"
node -e "JSON.parse(require('fs').readFileSync('messages/ar.json','utf8'))"
node -e "JSON.parse(require('fs').readFileSync('messages/fr.json','utf8'))"
```

Expected: each exits 0 with no output.

- [ ] **Step 5: Commit**

```bash
git add messages/en.json messages/ar.json messages/fr.json
git commit -m "feat(i18n): add home.matchStatus keys for filter buttons"
```

---

### Task 2: Update `MatchesPanel` with Status Filter and Live Polling

**Files:**
- Modify: `src/components/home/MatchesPanel.tsx`

- [ ] **Step 1: Overwrite the file**

Replace the entire content of `src/components/home/MatchesPanel.tsx` with:

```tsx
"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { MatchCard } from "@/components/football/MatchCard";
import { useLiveFixtures } from "@/hooks/useLiveFixtures";
import { getMatchStatus, type ApiFixture, type MatchStatus } from "@/lib/api-football/types";

type FilterStatus = Exclude<MatchStatus, "other">;

type LeagueGroup = {
  league: ApiFixture["league"];
  fixtures: ApiFixture[];
  priority: number;
};

function getLeaguePriority(league: ApiFixture["league"]): number {
  const name = league.name.toLowerCase();
  const country = league.country.toLowerCase();
  if (name.includes("botola") || country === "morocco") return 0;
  if (
    country === "europe" ||
    name.includes("champions league") ||
    name.includes("europa league") ||
    name.includes("conference league")
  )
    return 1;
  return 2;
}

function groupAndSort(fixtures: ApiFixture[]): LeagueGroup[] {
  const map = new Map<number, LeagueGroup>();
  for (const f of fixtures) {
    const id = f.league.id;
    if (!map.has(id)) {
      map.set(id, {
        league: f.league,
        fixtures: [],
        priority: getLeaguePriority(f.league),
      });
    }
    map.get(id)!.fixtures.push(f);
  }
  return Array.from(map.values()).sort((a, b) => a.priority - b.priority);
}

const FILTER_ORDER: FilterStatus[] = ["finished", "live", "scheduled"];

type StatusLabels = {
  finished: string;
  live: string;
  scheduled: string;
};

type Props = {
  fixtures: ApiFixture[];
  locale: string;
  statusLabels: StatusLabels;
};

export function MatchesPanel({ fixtures, locale, statusLabels }: Props) {
  const [activeFilter, setActiveFilter] = useState<FilterStatus | null>(null);

  const { fixtures: liveFixtures } = useLiveFixtures({
    initial: [],
    intervalMs: 60000,
    enabled: true,
  });

  const merged = useMemo(() => {
    if (liveFixtures.length === 0) return fixtures;
    const liveMap = new Map(liveFixtures.map((f) => [f.fixture.id, f]));
    return fixtures.map((f) => liveMap.get(f.fixture.id) ?? f);
  }, [fixtures, liveFixtures]);

  const filtered = useMemo(() => {
    if (!activeFilter) return merged;
    return merged.filter(
      (f) => getMatchStatus(f.fixture.status.short) === activeFilter,
    );
  }, [merged, activeFilter]);

  const groups = useMemo(() => groupAndSort(filtered), [filtered]);

  const initialOpenIds = useMemo(
    () => new Set(groupAndSort(fixtures).filter((g) => g.priority <= 1).map((g) => g.league.id)),
    [fixtures],
  );
  const [openIds, setOpenIds] = useState<Set<number>>(initialOpenIds);

  function toggleLeague(id: number) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleFilter(status: FilterStatus) {
    setActiveFilter((prev) => (prev === status ? null : status));
  }

  if (fixtures.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="sticky top-0 z-10 flex gap-1.5 rounded-xl border border-border bg-background/95 p-1.5 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        {FILTER_ORDER.map((status) => {
          const isActive = activeFilter === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => toggleFilter(status)}
              aria-pressed={isActive}
              className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted"
              }`}
            >
              {statusLabels[status]}
            </button>
          );
        })}
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          {activeFilter ? statusLabels[activeFilter] : ""}
        </div>
      ) : (
        groups.map((group) => {
          const isOpen = openIds.has(group.league.id);
          const panelId = `matches-panel-${group.league.id}`;
          return (
            <div
              key={group.league.id}
              className="rounded-xl bg-card border border-border overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggleLeague(group.league.id)}
                className="flex w-full items-center gap-2 px-3 py-2.5 hover:bg-muted/50 transition-colors"
                aria-expanded={isOpen}
                aria-controls={panelId}
              >
                {group.league.logo && (
                  <Image
                    src={group.league.logo}
                    alt={group.league.name}
                    width={18}
                    height={18}
                    className="shrink-0"
                  />
                )}
                <span className="flex-1 text-start text-sm font-semibold truncate">
                  {group.league.name}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {group.fixtures.length}
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              {isOpen && (
                <div
                  id={panelId}
                  className="divide-y divide-border/50 border-t border-border/50"
                >
                  {group.fixtures.map((f) => (
                    <MatchCard key={f.fixture.id} fixture={f} locale={locale} />
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
```

Key changes vs. the previous version:
- New imports: `useMemo` from react, `useLiveFixtures` hook, `getMatchStatus` + `MatchStatus` type
- New `FilterStatus` type aliasing `MatchStatus` minus `"other"`
- New `statusLabels` prop typed as `StatusLabels`
- `useLiveFixtures({ initial: [], intervalMs: 60000, enabled: true })` polls every 60s
- `merged` memo replaces by-id any fixtures whose live version exists
- `filtered` memo applies the active status filter to `merged`
- `groups` is now memoized off `filtered` (previously computed bare)
- `initialOpenIds` is computed from the unfiltered `groupAndSort(fixtures)` so default-open state isn't affected by filter changes
- Sticky filter bar: `sticky top-0 z-10` + translucent `bg-background/95 backdrop-blur` over a rounded border
- Single-select toggle filter buttons with `aria-pressed`
- Early-return moved from `if (groups.length === 0)` to `if (fixtures.length === 0)` so the filter bar stays visible even when a filter empties the list
- Empty-state UI shown when filter excludes everything

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: Exit 0 for `MatchesPanel.tsx`. `HeroSection.tsx` and `page.tsx` will report transient errors about the missing `statusLabels` prop — that is EXPECTED until Tasks 3 and 4 ship.

- [ ] **Step 3: Commit**

```bash
git add src/components/home/MatchesPanel.tsx
git commit -m "feat(home): add status filter buttons and live polling to MatchesPanel"
```

---

### Task 3: Forward `statusLabels` Through `HeroSection`

**Files:**
- Modify: `src/components/home/HeroSection.tsx`

- [ ] **Step 1: Edit the Props type and the `<MatchesPanel>` call**

Open `src/components/home/HeroSection.tsx`. Make two surgical edits:

**Edit A** — Replace the `Props` type (currently lines 8-12):

```tsx
type Props = {
  featured: any;
  fixtures: ApiFixture[];
  locale: string;
};
```

with:

```tsx
type Props = {
  featured: any;
  fixtures: ApiFixture[];
  locale: string;
  statusLabels: {
    finished: string;
    live: string;
    scheduled: string;
  };
};
```

**Edit B** — Replace the function signature (currently `export function HeroSection({ featured, fixtures, locale }: Props) {`) with:

```tsx
export function HeroSection({ featured, fixtures, locale, statusLabels }: Props) {
```

**Edit C** — Replace the `<MatchesPanel ... />` call (currently `<MatchesPanel fixtures={fixtures} locale={locale} />`) with:

```tsx
<MatchesPanel fixtures={fixtures} locale={locale} statusLabels={statusLabels} />
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: `MatchesPanel.tsx` and `HeroSection.tsx` are now clean. `page.tsx` still reports a missing `statusLabels` prop on the `<HeroSection>` call — expected until Task 4.

- [ ] **Step 3: Commit**

```bash
git add src/components/home/HeroSection.tsx
git commit -m "feat(home): forward statusLabels prop through HeroSection"
```

---

### Task 4: Wire `statusLabels` from `page.tsx` and Remove `LiveNowSection`

**Files:**
- Modify: `src/app/(frontend)/[locale]/page.tsx`

- [ ] **Step 1: Overwrite the file**

Replace the entire content of `src/app/(frontend)/[locale]/page.tsx` with:

```tsx
import type { Metadata } from "next";
import type { Config } from "@/payload-types";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getArticles } from "@/lib/payload/queries";
import { getFixturesByDate } from "@/lib/api-football/fixtures";
import { HeroSection } from "@/components/home/HeroSection";
import { NewsSection } from "@/components/home/NewsSection";
import { NewsletterStrip } from "@/components/newsletter/NewsletterStrip";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return {
    title:
      locale === "ar"
        ? "MFM Sport - أخبار الكرة المغربية"
        : locale === "fr"
          ? "MFM Sport - Actualites du football marocain"
          : "MFM Sport - Moroccan Football News",
  };
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "home" });
  const tCommon = await getTranslations({ locale, namespace: "common" });
  const tArticle = await getTranslations({ locale, namespace: "article" });

  const today = new Date().toISOString().split("T")[0];
  const todayFixtures = await getFixturesByDate(today);

  const latest = await getArticles({ locale: locale as Config["locale"], page: 1, limit: 16 });
  const articles = latest.docs;

  const featured = articles[0];
  const topNews = articles.slice(1, 7);
  const moreNews = articles.slice(7, 13);

  const statusLabels = {
    finished: t("matchStatus.finished"),
    live: t("matchStatus.live"),
    scheduled: t("matchStatus.scheduled"),
  };

  if (!featured) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl font-bold text-primary mb-4">MFM Sport</h1>
        <p className="text-muted-foreground">{tArticle("noArticles")}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="sr-only">MFM Sport</h1>

      <HeroSection
        featured={featured}
        fixtures={todayFixtures}
        locale={locale}
        statusLabels={statusLabels}
      />

      <NewsSection
        title={t("topNews")}
        articles={topNews}
        locale={locale}
        viewAllHref={`/${locale}/articles`}
        viewAllText={tCommon("readMore")}
        columns={3}
      />

      <NewsSection
        title={t("latestNews")}
        articles={moreNews}
        locale={locale}
        viewAllHref={`/${locale}/articles`}
        viewAllText={tCommon("readMore")}
        columns={3}
      />

      <div className="mt-10">
        <NewsletterStrip locale={locale} />
      </div>
    </div>
  );
}
```

Key differences from current `page.tsx`:
- Removed import: `LiveNowSection`
- Removed import: `getLiveFixtures` from `@/lib/api-football/fixtures` (kept `getFixturesByDate`)
- Removed: `Promise.all` wrapping `getFixturesByDate(today)` + `getLiveFixtures()`; replaced with a single `await getFixturesByDate(today)` assigned directly to `todayFixtures`
- Removed: `liveFixtures` local variable and the `<LiveNowSection initial={liveFixtures} locale={locale} />` JSX
- Added: `statusLabels` computed from `t("matchStatus.*")` translations
- Added: `statusLabels={statusLabels}` prop on `<HeroSection>`

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: Exit 0 with no errors anywhere.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(frontend)/[locale]/page.tsx"
git commit -m "feat(home): compute matchStatus labels and remove LiveNowSection from homepage"
```

---

### Task 5: Visual Verification

- [ ] **Step 1: Confirm dev server is up**

A dev server may already be running on `localhost:3002`. If not, run `npm run dev`.

- [ ] **Step 2: Desktop AR (RTL) layout**

Open `http://localhost:3002/ar` at viewport ≥ 1024px. Verify:
- The matches panel renders on the leading (right in RTL) side of the hero
- Three pill buttons appear at the top of the panel: "منتهية", "مباشر", "قادمة" (Ended, Live, Upcoming)
- Buttons remain visible while scrolling the panel's internal list (sticky)
- Clicking "مباشر" filters the league list to only show leagues that have at least one live match. Clicking it again clears the filter.
- Clicking "قادمة" then "منتهية" switches the filter (no two buttons active at once)
- When a filter is active and yields zero matches, the dashed empty-state box appears below the filter bar
- `<LiveNowSection>` is gone — no "مباشر الآن" heading + pulsing dot section below the hero anymore

- [ ] **Step 3: Desktop EN (LTR) layout**

Open `http://localhost:3002/en`. Verify the same behavior with English labels "Ended", "Live", "Upcoming", and that the panel is on the trailing (right) side of the hero.

- [ ] **Step 4: Desktop FR (LTR) layout**

Open `http://localhost:3002/fr`. Verify "Terminés", "En direct", "À venir" labels render and the layout is identical to EN.

- [ ] **Step 5: Mobile layout**

At viewport < 1024px (e.g., 390×844). Verify:
- The hero stacks above the matches panel
- Filter bar still appears at the top of the matches panel
- Each filter button is touchable (≥ 32px tall)
- No horizontal overflow

- [ ] **Step 6: Live polling**

Open dev tools, Network tab. Observe a `GET /api/fixtures/live` request firing on mount and again roughly every 60 seconds while the tab is foregrounded. Backgrounding the tab pauses requests (visibility check in `useLiveFixtures`).

- [ ] **Step 7: Console / hydration**

Reload `/ar`. Check the browser console for hydration warnings or any errors. The component is `"use client"` and uses `useState`/`useMemo` with deterministic initializers; expect zero hydration mismatch warnings.

---

## Self-Review

### Spec Coverage

| Requirement | Covered by |
|-------------|-----------|
| Three floating buttons in the matches section | Task 2 — sticky filter bar with three pill buttons |
| Sort/filter by status: ended, ongoing, expected | Task 2 — `FILTER_ORDER` = `["finished", "live", "scheduled"]`, filter logic uses `getMatchStatus` |
| Live games appear inside the section (not below) | Task 2 — `useLiveFixtures` merged by id; live fixtures are part of the panel's data |
| Same-day scope | Task 4 — `getFixturesByDate(today)` still drives the base set; live merge only updates existing today fixtures |
| Remove the standalone Live Now section | Task 4 — `LiveNowSection` import, `getLiveFixtures` import, `liveFixtures` var, and JSX all deleted |

### Placeholder Scan

No "TBD", "TODO", "implement later", or hand-wavy phrasing. Every code change is a literal replacement.

### Type Consistency

- `statusLabels: { finished: string; live: string; scheduled: string }` is identical across `MatchesPanel` Props, `HeroSection` Props, and the object literal in `page.tsx`.
- `FilterStatus = Exclude<MatchStatus, "other">` is defined in `MatchesPanel.tsx` and used only there; matches the keys in `StatusLabels` and in `FILTER_ORDER`.
- `useLiveFixtures` is imported from `@/hooks/useLiveFixtures` with the same option shape used by `LiveNowSection` previously.
- `getMatchStatus` and `MatchStatus` come from `@/lib/api-football/types` — confirmed by `Grep`.

### Risk Notes

- The `MatchStatus` "other" bucket (statuses like `PST`, `CANC`, `ABD`, etc.) will not match any filter. When a filter is active, "other" fixtures are hidden. When no filter is active they show up. This matches user intent.
- The 60s polling interval is the same as the old `LiveNowSection` had — no behavior change for live updates.
- Adding `useMemo` for the initial `openIds` set means the default-open leagues are stable across re-renders. Filter changes do not re-collapse user-opened leagues.
