# Mobile Homepage Sliders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the homepage, replace the long "everything is just listed" mobile layout with compact native scroll-snap sliders (vertical for the hero matches panel / matches section / video list, horizontal one-card-at-a-time for the league news blogs), and reorder the news section so the league filter comes before the blogs.

**Architecture:** Pure CSS scroll-snap (no new dependency) gated to `< lg` (below 1024px) so the existing `lg:` desktop layout is untouched. A shared `.no-scrollbar` utility hides scrollbars; sliders use `snap-*` classes with a fixed `max-h`/card-width sized to show N items plus a peek of the next. The league news section renders two layouts: the existing desktop grid (`hidden lg:grid`) and a new mobile column (`lg:hidden`) that orders filter → horizontal blog slider → ad → playlist banner. The article card markup is extracted into a shared `LeagueArticleCard` so the grid and the slider reuse it (DRY).

**Tech Stack:** Next.js 16 (App Router, client components), React 19, Tailwind CSS v3 (scroll-snap utilities), Vitest + @testing-library/react.

---

## Background (verified facts)

- **No carousel library** is installed. The codebase already does native horizontal scrolling with hidden scrollbars via inline classes — see [LeagueCarousel.tsx:22](../../../src/components/home/LeagueCarousel.tsx#L22) (`[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`). We DRY that into a `.no-scrollbar` utility.
- **"Mobile" = below `lg` (1024px)** — this is exactly where the homepage's multi-column desktop layout begins (every home section switches to `lg:grid-cols-*`). Sliders apply below `lg`; `lg:` overrides restore the current desktop behavior.
- **Hero matches panel** = [MatchesPanel.tsx](../../../src/components/home/MatchesPanel.tsx): accordion of league groups. Today groups with `priority <= 1` (Botola/Morocco + Europe) start **open** ([MatchesPanel.tsx:87-89](../../../src/components/home/MatchesPanel.tsx#L87-L89)). Uses `useLiveFixtures` (`@/hooks/useLiveFixtures`).
- **League news** = [LeagueNewsSection.tsx](../../../src/components/home/LeagueNewsSection.tsx): a 3-col desktop grid whose mobile (grid-cols-1) order is blogs(+ad) → filter → playlist. Blogs render in [NewsGrid2x2.tsx](../../../src/components/home/NewsGrid2x2.tsx) (3 articles + 1 `AdCarousel format="card"` when an ad exists, else 4 articles). The filter is [LeaguesPanel.tsx](../../../src/components/home/LeaguesPanel.tsx). The playlist promo is `LeaguePlaylistBanner`.
- **Video list** = [VideoList.tsx:17](../../../src/components/home/VideoList.tsx#L17): `max-h-[28rem]` (≈6 rows) on mobile, `lg:max-h-none` on desktop.
- **Matches section** = [HomeMatchesSection.tsx:58-68](../../../src/components/home/HomeMatchesSection.tsx#L58-L68): a flat `flex flex-col` list of up to 12 `HomeMatchRow`. Uses `useLiveFixtures`. The first live match auto-opens via `firstLiveId` — leave that behavior.
- **Card article type** `LeagueCardArticle` = `{ id: string; title: string; slug: string; heroUrl: string | null; categoryName?: string; publishedAt?: string }` ([cards.ts:21-27](../../../src/lib/home/cards.ts#L21-L27)).
- **Test conventions**: `*.test.tsx` under sibling `__tests__/`, Vitest + @testing-library/react (jsdom). Mock hooks with `vi.mock`. Cast `ApiFixture` stubs with `as never` (see [MatchCard.test.tsx:13-44](../../../src/components/football/__tests__/MatchCard.test.tsx#L13-L44)). Single-file run: `pnpm test:run <path-substring>`. Full suite: `pnpm test:run`. Typecheck (includes tests): `pnpm exec tsc --noEmit -p tsconfig.json`.

## Decisions (locked with owner)

- Slider style: **native swipe + peek** (scroll-snap, hidden scrollbars, a sliver of the next item shows). No arrows/dots.
- Breakpoint: **below `lg` (1024px)**.
- Hero matches panel: **all groups closed by default** (applies on every viewport — simplest, and the owner asked for "all closed").
- The league-news mobile ad stays a card-format `AdCarousel` (news-card creatives are 16:9), placed under the blog slider in an `aspect-video` wrapper. `LeaguePlaylistBanner` stays last on mobile (unchanged).

## File Structure

- **Modify** `src/app/(frontend)/styles.css` — add the `.no-scrollbar` utility.
- **Modify** `src/components/home/VideoList.tsx` — show ~5 rows, snap slider.
- **Modify** `src/components/home/HomeMatchesSection.tsx` — 8-row vertical snap slider on mobile.
- **Modify** `src/components/home/MatchesPanel.tsx` — all-closed default + 5-row vertical snap slider on mobile.
- **Create** `src/components/home/LeagueArticleCard.tsx` — extracted article card (shared by grid + slider).
- **Modify** `src/components/home/NewsGrid2x2.tsx` — use `LeagueArticleCard`.
- **Create** `src/components/home/ArticleSlider.tsx` — horizontal one-at-a-time blog slider.
- **Modify** `src/components/home/LeagueNewsSection.tsx` — desktop grid (`hidden lg:grid`) + mobile column (`lg:hidden`): filter → slider → ad → playlist.

---

### Task 1: `.no-scrollbar` utility

**Files:**
- Modify: `src/app/(frontend)/styles.css`

CSS has no unit-testable behavior, so this task has no test — it's verified by the component tasks that consume the class and by the final build.

- [ ] **Step 1: Append the utility**

At the END of [styles.css](../../../src/app/(frontend)/styles.css), add:

```css
@layer utilities {
  /* Hide the scrollbar while keeping scroll + scroll-snap. Used by the mobile
     homepage sliders (replaces the repeated inline scrollbar-hiding classes). */
  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
}
```

- [ ] **Step 2: Verify the project still builds its CSS / types**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no errors (CSS change doesn't affect types; this just confirms nothing else broke).

- [ ] **Step 3: Commit**

```bash
git add "src/app/(frontend)/styles.css"
git commit -m "feat(mobile): add no-scrollbar utility for sliders"
```

---

### Task 2: Video list shows 5 (mobile) as a snap slider

**Files:**
- Modify: `src/components/home/VideoList.tsx:17,21-30`
- Test: `src/components/home/__tests__/VideoList.test.tsx`

- [ ] **Step 1: Add the failing tests**

Append these two tests inside the existing `describe("VideoList", ...)` block in [VideoList.test.tsx](../../../src/components/home/__tests__/VideoList.test.tsx) (before its closing `});`):

```tsx
  it("constrains the mobile list to ~5 rows as a snap slider", () => {
    const { container } = render(
      <VideoList videos={videos} selectedId="vid1" locale="en" onSelect={() => {}} />,
    );
    const list = container.firstElementChild as HTMLElement;
    expect(list.className).toContain("max-h-[23rem]");
    expect(list.className).not.toContain("max-h-[28rem]");
    expect(list.className).toContain("snap-y");
    expect(list.className).toContain("no-scrollbar");
    expect(list.className).toContain("lg:max-h-none");
  });

  it("makes each video button a snap target", () => {
    const { container } = render(
      <VideoList videos={videos} selectedId="vid1" locale="en" onSelect={() => {}} />,
    );
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(2);
    buttons.forEach((b) => expect(b.className).toContain("snap-start"));
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:run src/components/home/__tests__/VideoList.test.tsx`
Expected: FAIL — current container has `max-h-[28rem]`, no `snap-y`/`no-scrollbar`/`snap-start`.

- [ ] **Step 3: Update the component**

In [VideoList.tsx](../../../src/components/home/VideoList.tsx), change the container className (line 17) from:

```tsx
    <div className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto rounded-xl border border-white/10 bg-white/5 p-2 lg:h-full lg:max-h-none">
```

to:

```tsx
    <div className="flex max-h-[23rem] snap-y snap-mandatory flex-col gap-2 overflow-y-auto no-scrollbar rounded-xl border border-white/10 bg-white/5 p-2 lg:h-full lg:max-h-none">
```

And add `snap-start` to each video `<button>` — change its className (line 26) from:

```tsx
            className={`flex items-stretch gap-2 rounded-lg p-1.5 text-start transition-colors ${
```

to:

```tsx
            className={`flex snap-start items-stretch gap-2 rounded-lg p-1.5 text-start transition-colors ${
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test:run src/components/home/__tests__/VideoList.test.tsx`
Expected: PASS (all VideoList tests green).

- [ ] **Step 5: Commit**

```bash
git add src/components/home/VideoList.tsx src/components/home/__tests__/VideoList.test.tsx
git commit -m "feat(mobile): video list shows 5 rows as a snap slider"
```

---

### Task 3: Matches section — 8-row vertical slider on mobile

**Files:**
- Modify: `src/components/home/HomeMatchesSection.tsx:57-69`
- Test: `src/components/home/__tests__/HomeMatchesSection.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `src/components/home/__tests__/HomeMatchesSection.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

// The section polls live fixtures; stub the hook so tests are deterministic.
vi.mock("@/hooks/useLiveFixtures", () => ({
  useLiveFixtures: () => ({ fixtures: [] }),
}));

import { HomeMatchesSection } from "@/components/home/HomeMatchesSection";

const labels = {
  liveNow: "LIVE",
  events: "Events",
  venue: "Venue",
  referee: "Referee",
  viewFullMatch: "View full match",
  loadingDetails: "Loading",
  noEvents: "No events",
};

// Minimal scheduled fixture (status NS => none live => none auto-open => no fetch).
function fixture(id: number) {
  return {
    fixture: {
      id,
      date: "2026-06-10T18:00:00Z",
      timestamp: id,
      venue: null,
      status: { long: "", short: "NS", elapsed: null },
      referee: null,
    },
    league: { id: 1, name: "L", country: "C", logo: "", flag: null, season: 2026, round: "R" },
    teams: {
      home: { id: 1, name: "Home", logo: "", winner: null },
      away: { id: 2, name: "Away", logo: "", winner: null },
    },
    goals: { home: null, away: null },
    score: {
      halftime: { home: null, away: null },
      fulltime: { home: null, away: null },
      extratime: { home: null, away: null },
      penalty: { home: null, away: null },
    },
  } as never;
}

describe("HomeMatchesSection", () => {
  const fixtures = [fixture(1), fixture(2), fixture(3)];

  it("wraps the match list in a mobile vertical snap slider (8 rows), unbounded on desktop", () => {
    const { container } = render(
      <HomeMatchesSection title="Matches" emptyLabel="none" locale="en" fixtures={fixtures} labels={labels} />,
    );
    const slider = container.querySelector("[data-matches-slider]") as HTMLElement;
    expect(slider).toBeTruthy();
    expect(slider.className).toContain("max-h-[32rem]");
    expect(slider.className).toContain("snap-y");
    expect(slider.className).toContain("no-scrollbar");
    expect(slider.className).toContain("lg:max-h-none");
    expect(slider.className).toContain("lg:overflow-visible");
  });

  it("makes each match row a snap target", () => {
    const { container } = render(
      <HomeMatchesSection title="Matches" emptyLabel="none" locale="en" fixtures={fixtures} labels={labels} />,
    );
    const slider = container.querySelector("[data-matches-slider]") as HTMLElement;
    const rows = slider.querySelectorAll(":scope > [data-match-row]");
    expect(rows.length).toBe(3);
    rows.forEach((r) => expect((r as HTMLElement).className).toContain("snap-start"));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:run src/components/home/__tests__/HomeMatchesSection.test.tsx`
Expected: FAIL — no `[data-matches-slider]` element exists yet.

- [ ] **Step 3: Update the component**

In [HomeMatchesSection.tsx](../../../src/components/home/HomeMatchesSection.tsx), replace the list block (lines 57-69, the `) : (` branch through its closing) — specifically change:

```tsx
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((f) => (
            <HomeMatchRow
              key={f.fixture.id}
              fixture={f}
              locale={locale}
              labels={labels}
              defaultOpen={f.fixture.id === firstLiveId}
            />
          ))}
        </div>
      )}
```

to:

```tsx
      ) : (
        <div
          data-matches-slider
          className="flex max-h-[32rem] snap-y snap-mandatory flex-col gap-2 overflow-y-auto no-scrollbar lg:max-h-none lg:overflow-visible"
        >
          {sorted.map((f) => (
            <div key={f.fixture.id} data-match-row className="snap-start">
              <HomeMatchRow
                fixture={f}
                locale={locale}
                labels={labels}
                defaultOpen={f.fixture.id === firstLiveId}
              />
            </div>
          ))}
        </div>
      )}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test:run src/components/home/__tests__/HomeMatchesSection.test.tsx`
Expected: PASS (2 passing).

- [ ] **Step 5: Commit**

```bash
git add src/components/home/HomeMatchesSection.tsx src/components/home/__tests__/HomeMatchesSection.test.tsx
git commit -m "feat(mobile): matches section is an 8-row vertical snap slider"
```

---

### Task 4: Hero matches panel — all closed + 5-row vertical slider on mobile

**Files:**
- Modify: `src/components/home/MatchesPanel.tsx:87-89,133-181`
- Test: `src/components/home/__tests__/MatchesPanel.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `src/components/home/__tests__/MatchesPanel.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/hooks/useLiveFixtures", () => ({
  useLiveFixtures: () => ({ fixtures: [] }),
}));

import { MatchesPanel } from "@/components/home/MatchesPanel";

const statusLabels = { finished: "FT", live: "LIVE", scheduled: "SCH" };

// Botola (id 200, country Morocco => priority 0, previously auto-open) + another league.
function fixture(id: number, leagueId: number, leagueName: string, country: string) {
  return {
    fixture: {
      id,
      date: "2026-06-10T18:00:00Z",
      timestamp: id,
      venue: null,
      status: { long: "", short: "NS", elapsed: null },
      referee: null,
    },
    league: { id: leagueId, name: leagueName, country, logo: "", flag: null, season: 2026, round: "R" },
    teams: {
      home: { id: 1, name: "Home", logo: "", winner: null },
      away: { id: 2, name: "Away", logo: "", winner: null },
    },
    goals: { home: null, away: null },
    score: {
      halftime: { home: null, away: null },
      fulltime: { home: null, away: null },
      extratime: { home: null, away: null },
      penalty: { home: null, away: null },
    },
  } as never;
}

const fixtures = [
  fixture(1, 200, "Botola Pro", "Morocco"),
  fixture(2, 39, "Premier League", "England"),
];

describe("MatchesPanel", () => {
  it("starts with ALL league groups collapsed (no auto-open)", () => {
    const { container } = render(
      <MatchesPanel fixtures={fixtures} locale="en" statusLabels={statusLabels} />,
    );
    // Every group header toggle is collapsed.
    const toggles = container.querySelectorAll("button[aria-expanded]");
    expect(toggles.length).toBeGreaterThan(0);
    toggles.forEach((t) => expect(t.getAttribute("aria-expanded")).toBe("false"));
  });

  it("renders the league groups inside a mobile vertical snap slider (5 rows)", () => {
    const { container } = render(
      <MatchesPanel fixtures={fixtures} locale="en" statusLabels={statusLabels} />,
    );
    const slider = container.querySelector("[data-leagues-slider]") as HTMLElement;
    expect(slider).toBeTruthy();
    expect(slider.className).toContain("max-h-[19rem]");
    expect(slider.className).toContain("snap-y");
    expect(slider.className).toContain("no-scrollbar");
    expect(slider.className).toContain("lg:max-h-none");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:run src/components/home/__tests__/MatchesPanel.test.tsx`
Expected: FAIL — Botola group auto-opens (aria-expanded "true"), and no `[data-leagues-slider]` exists.

- [ ] **Step 3: Make all groups closed by default**

In [MatchesPanel.tsx](../../../src/components/home/MatchesPanel.tsx), replace the `openIds` initializer (lines 87-89):

```tsx
  const [openIds, setOpenIds] = useState<Set<number>>(
    () => new Set(groupAndSort(fixtures).filter((g) => g.priority <= 1).map((g) => g.league.id)),
  );
```

with:

```tsx
  // All league groups start collapsed.
  const [openIds, setOpenIds] = useState<Set<number>>(() => new Set());
```

- [ ] **Step 4: Wrap the groups in the mobile slider**

Still in [MatchesPanel.tsx](../../../src/components/home/MatchesPanel.tsx), the render currently is (lines 129-181, abbreviated):

```tsx
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
              className="rounded-xl bg-background border border-border overflow-hidden"
            >
```

Make two edits:

1. Wrap the `groups.length === 0 ? ... : groups.map(...)` expression in a scroll-snap container. Replace the opening `{groups.length === 0 ? (` with:

```tsx
      <div
        data-leagues-slider
        className="flex flex-col gap-2 overflow-y-auto no-scrollbar snap-y snap-mandatory max-h-[19rem] lg:max-h-none lg:overflow-visible"
      >
      {groups.length === 0 ? (
```

2. Add the closing `</div>` for that wrapper. The groups block ends with `)}` (closing the ternary) right before the component's final `</div>`. Change the tail from:

```tsx
            </div>
          );
        })
      )}
    </div>
  );
}
```

to:

```tsx
            </div>
          );
        })
      )}
      </div>
    </div>
  );
}
```

3. Add `snap-start` to each group's outer div — change (around line 137-141):

```tsx
            <div
              key={group.league.id}
              className="rounded-xl bg-background border border-border overflow-hidden"
            >
```

to:

```tsx
            <div
              key={group.league.id}
              className="snap-start rounded-xl bg-background border border-border overflow-hidden"
            >
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test:run src/components/home/__tests__/MatchesPanel.test.tsx`
Expected: PASS (2 passing).

- [ ] **Step 6: Run the full suite (catch any regression from the open-state change)**

Run: `pnpm test:run`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/components/home/MatchesPanel.tsx src/components/home/__tests__/MatchesPanel.test.tsx
git commit -m "feat(mobile): hero matches panel all-closed + 5-row vertical slider"
```

---

### Task 5: Extract `LeagueArticleCard` (shared by grid + slider)

**Files:**
- Create: `src/components/home/LeagueArticleCard.tsx`
- Modify: `src/components/home/NewsGrid2x2.tsx`
- Test: `src/components/home/__tests__/LeagueArticleCard.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `src/components/home/__tests__/LeagueArticleCard.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LeagueArticleCard } from "@/components/home/LeagueArticleCard";
import type { LeagueCardArticle } from "@/lib/home/cards";

const article: LeagueCardArticle = {
  id: "1",
  title: "Big Match Recap",
  slug: "big-match-recap",
  heroUrl: "https://example.com/hero.jpg",
  categoryName: "Botola",
  publishedAt: "2026-05-13T12:00:00.000Z",
};

describe("LeagueArticleCard", () => {
  it("links the title to the localized article URL", () => {
    render(<LeagueArticleCard article={article} locale="en" />);
    const link = screen.getByRole("link", { name: /Big Match Recap/ });
    expect(link).toHaveAttribute("href", "/en/articles/big-match-recap");
  });

  it("shows the category badge", () => {
    render(<LeagueArticleCard article={article} locale="en" />);
    expect(screen.getByText("Botola")).toBeInTheDocument();
  });

  it("merges a custom className onto the article element", () => {
    const { container } = render(
      <LeagueArticleCard article={article} locale="en" className="w-[85%] snap-start" />,
    );
    const el = container.querySelector("article") as HTMLElement;
    expect(el.className).toContain("w-[85%]");
    expect(el.className).toContain("snap-start");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:run src/components/home/__tests__/LeagueArticleCard.test.tsx`
Expected: FAIL — cannot resolve `@/components/home/LeagueArticleCard`.

- [ ] **Step 3: Create the component** (markup lifted verbatim from `NewsGrid2x2`, plus a `className` passthrough)

```tsx
// src/components/home/LeagueArticleCard.tsx
import Image from "next/image";
import Link from "next/link";
import { cn, formatDate } from "@/lib/utils";
import type { LeagueCardArticle } from "@/lib/home/cards";

type Props = {
  article: LeagueCardArticle;
  locale: string;
  className?: string;
};

export function LeagueArticleCard({ article, locale, className }: Props) {
  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-border bg-background transition-colors hover:border-primary/30",
        className,
      )}
    >
      <div className="relative aspect-video overflow-hidden">
        {article.heroUrl ? (
          <Image
            src={article.heroUrl}
            alt={article.title}
            fill
            sizes="(max-width: 1024px) 100vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-secondary">
            <span className="text-xs text-muted-foreground">MFM Sport</span>
          </div>
        )}
        {article.categoryName && (
          <div className="absolute bottom-2 start-2 z-10 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
            {article.categoryName}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <h3 className="text-sm font-semibold leading-tight line-clamp-2 transition-colors group-hover:text-primary">
          <Link
            href={`/${locale}/articles/${article.slug}`}
            className="after:absolute after:inset-0 after:content-['']"
          >
            {article.title}
          </Link>
        </h3>
        {article.publishedAt && (
          <time
            dateTime={article.publishedAt}
            className="mt-auto pt-2 text-xs text-muted-foreground"
          >
            {formatDate(article.publishedAt, locale)}
          </time>
        )}
      </div>
    </article>
  );
}
```

- [ ] **Step 4: Refactor `NewsGrid2x2` to use it**

Replace the entire body of [NewsGrid2x2.tsx](../../../src/components/home/NewsGrid2x2.tsx) with:

```tsx
import { cn } from "@/lib/utils";
import { AdCarousel } from "@/components/ads/AdCarousel";
import { LeagueArticleCard } from "./LeagueArticleCard";
import type { AdItem } from "@/lib/payload/ads";
import type { LeagueCardArticle } from "@/lib/home/cards";

type Props = {
  articles: LeagueCardArticle[];
  locale: string;
  className?: string;
  ads?: AdItem[];
};

export function NewsGrid2x2({ articles, locale, className, ads = [] }: Props) {
  const hasAd = ads.length > 0;
  const shownArticles = hasAd ? articles.slice(0, 3) : articles.slice(0, 4);
  return (
    <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2", className)}>
      {shownArticles.map((article) => (
        <LeagueArticleCard key={article.id} article={article} locale={locale} />
      ))}
      {hasAd && <AdCarousel ads={ads} format="card" />}
    </div>
  );
}
```

- [ ] **Step 5: Run the test + typecheck**

Run: `pnpm test:run src/components/home/__tests__/LeagueArticleCard.test.tsx`
Expected: PASS (3 passing).

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/home/LeagueArticleCard.tsx src/components/home/NewsGrid2x2.tsx src/components/home/__tests__/LeagueArticleCard.test.tsx
git commit -m "refactor(home): extract LeagueArticleCard shared by grid and slider"
```

---

### Task 6: `ArticleSlider` (horizontal one-at-a-time blog slider)

**Files:**
- Create: `src/components/home/ArticleSlider.tsx`
- Test: `src/components/home/__tests__/ArticleSlider.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `src/components/home/__tests__/ArticleSlider.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ArticleSlider } from "@/components/home/ArticleSlider";
import type { LeagueCardArticle } from "@/lib/home/cards";

const articles: LeagueCardArticle[] = [
  { id: "1", title: "One", slug: "one", heroUrl: null },
  { id: "2", title: "Two", slug: "two", heroUrl: null },
  { id: "3", title: "Three", slug: "three", heroUrl: null },
];

describe("ArticleSlider", () => {
  it("renders nothing when there are no articles", () => {
    const { container } = render(<ArticleSlider articles={[]} locale="en" />);
    expect(container.firstChild).toBeNull();
  });

  it("is a horizontal snap container with one card per article", () => {
    const { container } = render(<ArticleSlider articles={articles} locale="en" />);
    const track = container.firstElementChild as HTMLElement;
    expect(track.className).toContain("snap-x");
    expect(track.className).toContain("overflow-x-auto");
    expect(track.className).toContain("no-scrollbar");
    const cards = container.querySelectorAll("article");
    expect(cards.length).toBe(3);
  });

  it("sizes each card to show one at a time with a peek (w-[85%], snap-start)", () => {
    const { container } = render(<ArticleSlider articles={articles} locale="en" />);
    container.querySelectorAll("article").forEach((c) => {
      expect((c as HTMLElement).className).toContain("w-[85%]");
      expect((c as HTMLElement).className).toContain("shrink-0");
      expect((c as HTMLElement).className).toContain("snap-start");
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:run src/components/home/__tests__/ArticleSlider.test.tsx`
Expected: FAIL — cannot resolve `@/components/home/ArticleSlider`.

- [ ] **Step 3: Create the component**

```tsx
// src/components/home/ArticleSlider.tsx
import { LeagueArticleCard } from "./LeagueArticleCard";
import type { LeagueCardArticle } from "@/lib/home/cards";

type Props = {
  articles: LeagueCardArticle[];
  locale: string;
};

// Mobile: one blog at a time, horizontally swipeable, with a peek of the next.
export function ArticleSlider({ articles, locale }: Props) {
  if (articles.length === 0) return null;
  return (
    <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto no-scrollbar">
      {articles.map((article) => (
        <LeagueArticleCard
          key={article.id}
          article={article}
          locale={locale}
          className="w-[85%] shrink-0 snap-start"
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test:run src/components/home/__tests__/ArticleSlider.test.tsx`
Expected: PASS (3 passing).

- [ ] **Step 5: Commit**

```bash
git add src/components/home/ArticleSlider.tsx src/components/home/__tests__/ArticleSlider.test.tsx
git commit -m "feat(mobile): horizontal one-at-a-time article slider"
```

---

### Task 7: League news section — mobile layout (filter → slider → ad → playlist)

**Files:**
- Modify: `src/components/home/LeagueNewsSection.tsx`
- Test: `src/components/home/__tests__/LeagueNewsSection.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `src/components/home/__tests__/LeagueNewsSection.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, within } from "@testing-library/react";

// Isolate the playlist banner (it renders its own image/markup we don't care about here).
vi.mock("@/components/home/LeaguePlaylistBanner", () => ({
  LeaguePlaylistBanner: () => <div data-testid="playlist" />,
}));

import { LeagueNewsSection } from "@/components/home/LeagueNewsSection";
import { LEAGUES } from "@/lib/home/leagues";
import type { LeagueCardArticle } from "@/lib/home/cards";

const firstLeagueId = LEAGUES[0]!.id;
const articlesByLeague: Record<string, LeagueCardArticle[]> = {
  [firstLeagueId]: [
    { id: "a1", title: "One", slug: "one", heroUrl: null },
    { id: "a2", title: "Two", slug: "two", heroUrl: null },
  ],
};

describe("LeagueNewsSection", () => {
  it("renders a desktop grid (hidden lg:grid) and a mobile column (lg:hidden)", () => {
    const { container } = render(
      <LeagueNewsSection title="News" locale="en" articlesByLeague={articlesByLeague} />,
    );
    const desktop = container.querySelector(".lg\\:grid");
    const mobile = container.querySelector(".lg\\:hidden");
    expect(desktop?.className).toContain("hidden");
    expect(mobile).toBeTruthy();
  });

  it("on mobile, the filter comes before the blog slider", () => {
    const { container } = render(
      <LeagueNewsSection title="News" locale="en" articlesByLeague={articlesByLeague} />,
    );
    const mobile = container.querySelector(".lg\\:hidden") as HTMLElement;
    // The horizontal blog slider lives in the mobile column.
    const slider = mobile.querySelector(".snap-x") as HTMLElement;
    expect(slider).toBeTruthy();
    // The filter (a league button) appears in the DOM before the slider.
    const firstFilterButton = mobile.querySelector("button") as HTMLElement;
    expect(firstFilterButton).toBeTruthy();
    const pos = firstFilterButton.compareDocumentPosition(slider);
    // eslint-disable-next-line no-bitwise
    expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); // slider follows the filter
  });

  it("renders the blog cards inside the mobile slider", () => {
    const { container } = render(
      <LeagueNewsSection title="News" locale="en" articlesByLeague={articlesByLeague} />,
    );
    const mobile = container.querySelector(".lg\\:hidden") as HTMLElement;
    const slider = mobile.querySelector(".snap-x") as HTMLElement;
    expect(within(slider).getAllByRole("article").length).toBe(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:run src/components/home/__tests__/LeagueNewsSection.test.tsx`
Expected: FAIL — there's currently no `.lg:hidden` mobile column and no `.snap-x` slider.

- [ ] **Step 3: Update the component**

Replace the entire body of [LeagueNewsSection.tsx](../../../src/components/home/LeagueNewsSection.tsx) with:

```tsx
"use client";

import { useState } from "react";
import { LeaguesPanel } from "./LeaguesPanel";
import { LeaguePlaylistBanner } from "./LeaguePlaylistBanner";
import { NewsGrid2x2 } from "./NewsGrid2x2";
import { ArticleSlider } from "./ArticleSlider";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { SectionShell } from "@/components/home/SectionShell";
import { AdCarousel } from "@/components/ads/AdCarousel";
import { LEAGUES } from "@/lib/home/leagues";
import type { LeagueCardArticle } from "@/lib/home/cards";
import type { AdItem } from "@/lib/payload/ads";

type Props = {
  title: string;
  locale: string;
  articlesByLeague: Record<string, LeagueCardArticle[]>;
  ads?: AdItem[];
};

export function LeagueNewsSection({ title, locale, articlesByLeague, ads = [] }: Props) {
  const [selectedId, setSelectedId] = useState<string>(LEAGUES[0]?.id ?? "");
  const articles = articlesByLeague[selectedId] ?? [];

  return (
    <SectionShell>
      <SectionHeader title={title} />

      {/* Desktop (lg+): unchanged 3-col grid. The 2x2 article grid spans cols 1-2
          (grid-rows-subgrid so its two card rows ARE the section's two rows), the
          leagues panel sits in row 1, and the playlist banner sits in row 2. */}
      <div className="hidden gap-4 lg:grid lg:grid-cols-3 lg:grid-rows-[auto_auto] lg:gap-x-4 lg:gap-y-3">
        <NewsGrid2x2
          className="lg:col-span-2 lg:row-span-2 lg:grid-rows-subgrid"
          articles={articles}
          locale={locale}
          ads={ads}
        />
        <LeaguesPanel
          className="lg:col-start-3 lg:row-start-1"
          leagues={LEAGUES}
          selectedId={selectedId}
          locale={locale}
          onSelect={setSelectedId}
        />
        <LeaguePlaylistBanner locale={locale} />
      </div>

      {/* Mobile (< lg): filter first, then a one-at-a-time blog slider, then the
          ad, then the playlist banner. */}
      <div className="flex flex-col gap-4 lg:hidden">
        <LeaguesPanel
          leagues={LEAGUES}
          selectedId={selectedId}
          locale={locale}
          onSelect={setSelectedId}
        />
        <ArticleSlider articles={articles} locale={locale} />
        {ads.length > 0 && (
          <div className="aspect-video">
            <AdCarousel ads={ads} format="card" />
          </div>
        )}
        <LeaguePlaylistBanner locale={locale} />
      </div>
    </SectionShell>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test:run src/components/home/__tests__/LeagueNewsSection.test.tsx`
Expected: PASS (3 passing).

- [ ] **Step 5: Typecheck + full suite**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no errors.

Run: `pnpm test:run`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/components/home/LeagueNewsSection.tsx src/components/home/__tests__/LeagueNewsSection.test.tsx
git commit -m "feat(mobile): news section orders filter then blog slider then ad"
```

---

### Task 8: Full verification + manual mobile check

- [ ] **Step 1: Lint, types, full tests**

Run: `pnpm lint`
Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Run: `pnpm test:run`
Expected: lint clean (warnings OK), no type errors, all tests pass.

- [ ] **Step 2: Production build**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 3: Manual mobile check**

Run: `pnpm dev`, open `http://localhost:3000/ar`, and using the browser devtools device toolbar at a phone width (e.g. 390px) confirm:
- Hero: the matches-by-league list is a compact vertical slider (~5 rows, swipe for more), **all groups collapsed**.
- News: the **league filter is on top**, blogs are a **horizontal swipe** (one card + a peek), the ad sits under the slider, playlist banner last.
- YouTube: the side list shows ~5 videos and scrolls for more.
- Matches: the list is a vertical slider (~8 rows) and scrolls for more.
Then widen past 1024px and confirm the **desktop layout is unchanged**.

---

## Self-Review

**Spec coverage:**
- Hero matches-by-league → vertical slider of 5, all closed (not first open) → Task 4 (`max-h-[19rem]` slider + `new Set()` default). ✅
- News section: filter before blogs → Task 7 (mobile column orders `LeaguesPanel` first). ✅
- Blogs as a horizontal slider, one at a time → Task 6 `ArticleSlider` (`snap-x`, `w-[85%]` peek) + Task 7. ✅
- Ad stays under the blog slider, as is → Task 7 (`AdCarousel format="card"` in an `aspect-video` wrapper, after the slider). ✅
- YouTube list 6 → 5 → Task 2 (`max-h-[23rem]`). ✅
- Matches section → vertical slider of 8 → Task 3 (`max-h-[32rem]` slider). ✅
- Desktop untouched (`< lg` only) → every slider uses `lg:max-h-none`/`lg:overflow-visible` or `lg:hidden`/`hidden lg:grid`. ✅
- Native swipe + peek, no deps → scroll-snap + `.no-scrollbar` (Task 1), peek via non-multiple `max-h` and `w-[85%]`. ✅

**Placeholder scan:** No TBD/TODO; every code step shows complete code; the only non-TDD task (Task 1, CSS) is justified (no behavior to unit-test) and is exercised by later component tests asserting `no-scrollbar`. ✅

**Type/name consistency:** `LeagueArticleCard` (props `article`/`locale`/`className`) defined in Task 5 and consumed by `NewsGrid2x2` (Task 5) and `ArticleSlider` (Task 6) identically. `LeagueCardArticle` fields match [cards.ts:21-27]. `AdCarousel format="card"` matches the shipped component. Data attributes `data-matches-slider`/`data-match-row` (Task 3) and `data-leagues-slider` (Task 4) are self-consistent within their tasks. ✅

**Open for discussion (easy to retune during execution):**
- Exact `max-h` values (`19rem`/`23rem`/`32rem`) are tuned to ~5/5/8 rows + a peek; adjust if a device shows 4 or 6.
- The mobile league filter stays a vertical list (only reordered first, per the request). If it feels long on phones, converting it to a horizontal chip bar is a small follow-up.
- Hero panel "all closed" applies on desktop too; if desktop should keep Botola open, gate the default by viewport.
