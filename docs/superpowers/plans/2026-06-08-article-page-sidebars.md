# Article Page Sidebars (World Cup calendar, news, 300×600 ad, newsletter) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two sticky sidebars to the opened-article page — a RIGHT rail with a World Cup 2026 matches calendar (5-row vertical scroll slider) above a latest-news slider (5 rows), and a LEFT rail with a 300×600 admin-managed vertical ad above a newsletter box — both visible only on `lg` (≥1024px) and up.

**Architecture:** The article page (`[locale]/articles/[slug]/page.tsx`) is restructured from a single centered column into a 3-column flex layout at `lg+`: left rail / centered article (`max-w-4xl`) / right rail. The outer flex container is pinned `dir="ltr"` so the ad rail is always physically LEFT and the matches rail always physically RIGHT regardless of the page's RTL/LTR locale; each of the three columns re-asserts the page direction on its own content. Rails are `lg:sticky lg:top-24` so they float as the article scrolls. The World Cup and news lists reuse the existing vertical scroll-snap slider pattern (`max-h-[…] overflow-y-auto no-scrollbar snap-y`) and the existing `MatchCard` component. The ad reuses `AdCarousel` with a new `"tower"` format (`aspect-[300/600]`) fed by a new `"article-sidebar"` Payload ad placement. The newsletter reuses the existing `NewsletterStrip`.

**Tech Stack:** Next.js 16 (App Router, server components), Payload CMS 3.84 (Postgres enum-backed `select` field), React 19, Tailwind v3 (arbitrary values + sticky), API-Football (`getFixturesByLeague`), Vitest + @testing-library/react.

**Key decisions already made (do not re-litigate):**
- Second right slider content = **latest news articles** (5 visible, scroll for more).
- Breakpoint = **lg (≥1024px)**. Below lg the article renders exactly as it does today (no rails).
- World Cup = **league id `1`, season `2026`** (the 2026 World Cup specifically — never a past edition).
- Physical sides are pinned: ad+newsletter LEFT, World Cup+news RIGHT, in every locale (achieved with `dir="ltr"` on the outer flex wrapper).
- Rail width `lg:w-[260px] xl:w-[300px]`; center `max-w-4xl`; outer wrapper `max-w-[1500px]`. Tradeoff: at the low end of `lg` (~1024px) the reading column is ~440px; it gets comfortable from ~1180px up. If the owner prefers, swapping the rails' `lg:` prefixes to `xl:` raises the threshold — but the plan ships `lg` as chosen.

---

## File Structure

**New files:**
- `src/lib/api-football/worldcup.ts` — World Cup constants + `getWorldCupFixtures()` helper.
- `src/components/articles/WorldCupCalendar.tsx` — presentational 5-row vertical match slider (reuses `MatchCard`).
- `src/components/articles/__tests__/WorldCupCalendar.test.tsx`
- `src/components/articles/SidebarNewsList.tsx` — presentational 5-row vertical latest-news slider.
- `src/components/articles/__tests__/SidebarNewsList.test.tsx`

**Modified files:**
- `src/lib/payload/ads.ts` — add `"article-sidebar"` to the `AdPlacement` union, `AD_PLACEMENTS`, and `emptyGroups()`.
- `src/lib/payload/__tests__/ads.test.ts` — expect the new placement key.
- `src/collections/Ads.ts` — add the `"article-sidebar"` option + 300×600 design hint.
- `src/components/ads/AdCarousel.tsx` — add `"tower"` format (`aspect-[300/600]`).
- `src/components/ads/__tests__/AdCarousel.test.tsx` — assert the tower ratio.
- `src/app/(frontend)/[locale]/articles/[slug]/page.tsx` — restructure into the 3-column layout and fetch/wire the rail data.

**Out-of-band (DB):**
- `ALTER TYPE "enum_ads_placement" ADD VALUE 'article-sidebar'` applied directly to prod Neon (Task 7).

---

### Task 1: Add the `article-sidebar` ad placement

**Files:**
- Modify: `src/lib/payload/ads.ts:7-39`
- Test: `src/lib/payload/__tests__/ads.test.ts:19-25`

- [ ] **Step 1: Update the failing test first**

In `src/lib/payload/__tests__/ads.test.ts`, change the placement-keys assertion (lines 19-25) to include the new key:

```ts
  it("returns an entry for every placement, empty when no docs", () => {
    const g = groupAds([]);
    expect(Object.keys(g).sort()).toEqual(
      [
        "article-sidebar",
        "hero-news",
        "news-card",
        "news-videos",
        "top-banner",
        "videos-matches",
      ].sort(),
    );
    expect(g["top-banner"]).toEqual([]);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/lib/payload/__tests__/ads.test.ts`
Expected: FAIL — received object is missing the `"article-sidebar"` key.

- [ ] **Step 3: Add the placement to `ads.ts`**

In `src/lib/payload/ads.ts`, add `"article-sidebar"` in all three spots:

```ts
export type AdPlacement =
  | "top-banner"
  | "hero-news"
  | "news-videos"
  | "videos-matches"
  | "news-card"
  | "article-sidebar";

export const AD_PLACEMENTS: AdPlacement[] = [
  "top-banner",
  "hero-news",
  "news-videos",
  "videos-matches",
  "news-card",
  "article-sidebar",
];
```

And in `emptyGroups()`:

```ts
function emptyGroups(): AdsByPlacement {
  return {
    "top-banner": [],
    "hero-news": [],
    "news-videos": [],
    "videos-matches": [],
    "news-card": [],
    "article-sidebar": [],
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/lib/payload/__tests__/ads.test.ts`
Expected: PASS (all 4 tests).

- [ ] **Step 5: Add the admin option in `Ads.ts`**

In `src/collections/Ads.ts`, append to `AD_PLACEMENTS` (after the `news-card` entry, line 10):

```ts
  { label: "News card (blog-sized, in the news grid)", value: "news-card" },
  { label: "Article page — Side rail (vertical 300×600)", value: "article-sidebar" },
] as const;
```

And extend the `image` field admin description (line 37-39) so the design size is documented:

```ts
      admin: {
        description:
          "Banners: design ~1600×376 (wide). News cards: design 16:9 (e.g. 600×400). Article side rail: design 300×600 (vertical).",
      },
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/payload/ads.ts src/lib/payload/__tests__/ads.test.ts src/collections/Ads.ts
git commit -m "feat(ads): add article-sidebar (300x600) placement"
```

---

### Task 2: Add the `tower` (300×600) format to AdCarousel

**Files:**
- Modify: `src/components/ads/AdCarousel.tsx:9-51`
- Test: `src/components/ads/__tests__/AdCarousel.test.tsx`

- [ ] **Step 1: Write the failing test**

In `src/components/ads/__tests__/AdCarousel.test.tsx`, add this test after the card-format test (after line 38):

```tsx
  it("tower format uses the fixed 300x600 vertical ratio", () => {
    const { container } = render(<AdCarousel ads={[ads[0]]} format="tower" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("aspect-[300/600]");
    expect(root.className).toContain("rounded-xl");
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/components/ads/__tests__/AdCarousel.test.tsx`
Expected: FAIL — TS error / `"tower"` not assignable to `format`, and `aspect-[300/600]` not found.

- [ ] **Step 3: Add the `tower` format**

In `src/components/ads/AdCarousel.tsx`, widen the `format` prop union (line 11) and the `rootClass`/`sizes` logic:

```tsx
type Props = {
  ads: AdItem[];
  format: "banner" | "card" | "tower";
  className?: string;
  intervalMs?: number;
};
```

Replace the `rootClass` block (lines 34-40) with:

```tsx
  const rootClass =
    format === "banner"
      ? // Standard 970x250 billboard: fixed ratio, capped at 970px wide, centered.
        "relative mx-auto w-full max-w-[970px] aspect-[970/250] overflow-hidden rounded-xl"
      : format === "tower"
        ? // Standard 300x600 half-page / tower. Design creatives at 300x600.
          "relative w-full aspect-[300/600] overflow-hidden rounded-xl border border-border bg-background"
        : // Standard 300x250 medium rectangle (6:5). Design creatives at 300x250.
          "relative w-full aspect-[300/250] overflow-hidden rounded-xl border border-border bg-background";
```

Replace the `sizes` attribute on the `<Image>` (line 47) with:

```tsx
      sizes={format === "banner" ? "100vw" : "300px"}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/components/ads/__tests__/AdCarousel.test.tsx`
Expected: PASS (all tests including the new tower test).

- [ ] **Step 5: Commit**

```bash
git add src/components/ads/AdCarousel.tsx src/components/ads/__tests__/AdCarousel.test.tsx
git commit -m "feat(ads): add tower (300x600) AdCarousel format"
```

---

### Task 3: World Cup fixtures helper

**Files:**
- Create: `src/lib/api-football/worldcup.ts`
- Test: `src/lib/api-football/__tests__/worldcup.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/api-football/__tests__/worldcup.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { WORLD_CUP_LEAGUE_ID, WORLD_CUP_SEASON } from "@/lib/api-football/worldcup";

describe("world cup constants", () => {
  it("targets league 1, season 2026 (the 2026 World Cup)", () => {
    expect(WORLD_CUP_LEAGUE_ID).toBe(1);
    expect(WORLD_CUP_SEASON).toBe(2026);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/lib/api-football/__tests__/worldcup.test.ts`
Expected: FAIL — cannot find module `@/lib/api-football/worldcup`.

- [ ] **Step 3: Create the helper**

Create `src/lib/api-football/worldcup.ts`:

```ts
import { getFixturesByLeague } from "./fixtures";
import type { ApiFixture } from "./types";

// API-Football: league id 1 is the FIFA World Cup; season 2026 = the 2026 edition.
export const WORLD_CUP_LEAGUE_ID = 1;
export const WORLD_CUP_SEASON = 2026;

// Upcoming ("to be played") World Cup 2026 fixtures. `next` returns the soonest
// not-yet-played matches; we pull a generous window so the slider can scroll.
export async function getWorldCupFixtures(): Promise<ApiFixture[]> {
  return getFixturesByLeague(WORLD_CUP_LEAGUE_ID, WORLD_CUP_SEASON, { next: 50 });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/lib/api-football/__tests__/worldcup.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api-football/worldcup.ts src/lib/api-football/__tests__/worldcup.test.ts
git commit -m "feat(matches): world cup 2026 fixtures helper"
```

---

### Task 4: WorldCupCalendar component (right rail, top)

**Files:**
- Create: `src/components/articles/WorldCupCalendar.tsx`
- Test: `src/components/articles/__tests__/WorldCupCalendar.test.tsx`

A presentational server component: a titled box whose body is a vertical scroll-snap slider sized to show ~5 `MatchCard` rows, scroll for more. Returns `null` when there are no fixtures so the rail collapses gracefully.

- [ ] **Step 1: Write the failing test**

Create `src/components/articles/__tests__/WorldCupCalendar.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { WorldCupCalendar } from "@/components/articles/WorldCupCalendar";
import type { ApiFixture } from "@/lib/api-football/types";

function fixture(id: number): ApiFixture {
  return {
    fixture: {
      id,
      date: "2026-06-11T18:00:00+00:00",
      timestamp: 0,
      venue: { id: null, name: null, city: null },
      status: { long: "Not Started", short: "NS", elapsed: null },
      referee: null,
    },
    league: { id: 1, name: "World Cup", country: "World", logo: "", flag: null, season: 2026, round: "Group Stage" },
    teams: {
      home: { id: 1, name: "Morocco", logo: "https://logo/h.png", winner: null },
      away: { id: 2, name: "Spain", logo: "https://logo/a.png", winner: null },
    },
    goals: { home: null, away: null },
    score: { halftime: { home: null, away: null }, fulltime: { home: null, away: null }, extratime: { home: null, away: null }, penalty: { home: null, away: null } },
  } as unknown as ApiFixture;
}

describe("WorldCupCalendar", () => {
  it("renders nothing when there are no fixtures", () => {
    const { container } = render(
      <WorldCupCalendar fixtures={[]} locale="ar" title="مونديال 2026" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the title and a capped scroll slider of match rows", () => {
    const fixtures = [1, 2, 3, 4, 5, 6, 7].map(fixture);
    const { container, getByText } = render(
      <WorldCupCalendar fixtures={fixtures} locale="ar" title="مونديال 2026" />,
    );
    expect(getByText("مونديال 2026")).toBeTruthy();
    const slider = container.querySelector("[data-worldcup-slider]") as HTMLElement;
    expect(slider).toBeTruthy();
    expect(slider.className).toContain("overflow-y-auto");
    expect(slider.className).toContain("no-scrollbar");
    expect(slider.className).toContain("max-h-[19rem]");
    // One link per fixture (MatchCard renders an <a>).
    expect(slider.querySelectorAll("a").length).toBe(7);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/components/articles/__tests__/WorldCupCalendar.test.tsx`
Expected: FAIL — cannot find module `@/components/articles/WorldCupCalendar`.

- [ ] **Step 3: Create the component**

Create `src/components/articles/WorldCupCalendar.tsx`:

```tsx
import { MatchCard } from "@/components/football/MatchCard";
import type { ApiFixture } from "@/lib/api-football/types";

type Props = {
  fixtures: ApiFixture[];
  locale: string;
  title: string;
};

// Right-rail World Cup 2026 calendar: a titled card whose body is a vertical
// scroll-snap slider sized to ~5 rows. Each child is shrink-0 so flex-col never
// crushes the rows (see the homepage matches-slider gotcha).
export function WorldCupCalendar({ fixtures, locale, title }: Props) {
  if (fixtures.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-3 shadow-sm">
      <h2 className="mb-2 px-1 text-sm font-bold">{title}</h2>
      <div
        data-worldcup-slider
        className="flex flex-col gap-2 overflow-y-auto no-scrollbar snap-y snap-mandatory max-h-[19rem]"
      >
        {fixtures.map((f) => (
          <div key={f.fixture.id} className="shrink-0 snap-start">
            <MatchCard fixture={f} locale={locale} />
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/components/articles/__tests__/WorldCupCalendar.test.tsx`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/articles/WorldCupCalendar.tsx src/components/articles/__tests__/WorldCupCalendar.test.tsx
git commit -m "feat(article): world cup 2026 calendar rail slider"
```

---

### Task 5: SidebarNewsList component (right rail, bottom)

**Files:**
- Create: `src/components/articles/SidebarNewsList.tsx`
- Test: `src/components/articles/__tests__/SidebarNewsList.test.tsx`

A presentational server component: a titled box whose body is a vertical scroll-snap slider sized to show ~5 compact news rows (small 16:9 thumbnail + 2-line title), scroll for more. Returns `null` when empty.

- [ ] **Step 1: Write the failing test**

Create `src/components/articles/__tests__/SidebarNewsList.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SidebarNewsList } from "@/components/articles/SidebarNewsList";

const article = (id: number) => ({
  id,
  title: `Story ${id}`,
  slug: `story-${id}`,
  featuredImage: null,
  publishedAt: "2026-06-01T10:00:00.000Z",
});

describe("SidebarNewsList", () => {
  it("renders nothing when there are no articles", () => {
    const { container } = render(
      <SidebarNewsList articles={[]} locale="ar" title="آخر الأخبار" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the title and a capped scroll slider linking each story", () => {
    const articles = [1, 2, 3, 4, 5, 6].map(article);
    const { container, getByText } = render(
      <SidebarNewsList articles={articles} locale="ar" title="آخر الأخبار" />,
    );
    expect(getByText("آخر الأخبار")).toBeTruthy();
    const slider = container.querySelector("[data-sidebar-news-slider]") as HTMLElement;
    expect(slider).toBeTruthy();
    expect(slider.className).toContain("overflow-y-auto");
    expect(slider.className).toContain("no-scrollbar");
    expect(slider.className).toContain("max-h-[22rem]");
    const links = slider.querySelectorAll("a");
    expect(links.length).toBe(6);
    expect(links[0].getAttribute("href")).toBe("/ar/articles/story-1");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/components/articles/__tests__/SidebarNewsList.test.tsx`
Expected: FAIL — cannot find module `@/components/articles/SidebarNewsList`.

- [ ] **Step 3: Create the component**

Create `src/components/articles/SidebarNewsList.tsx`:

```tsx
import Image from "next/image";
import Link from "next/link";
import { formatDate, getArticleHeroUrl, getImageAlt } from "@/lib/utils";

type SidebarArticle = {
  id: number | string;
  title: string;
  slug: string;
  featuredImage?: unknown;
  publishedAt?: string;
};

type Props = {
  articles: SidebarArticle[];
  locale: string;
  title: string;
};

// Right-rail latest-news list: a titled card whose body is a vertical scroll
// slider of compact rows (small thumbnail + 2-line title), ~5 visible. Each row
// is shrink-0 so flex-col never crushes it.
export function SidebarNewsList({ articles, locale, title }: Props) {
  if (articles.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-3 shadow-sm">
      <h2 className="mb-2 px-1 text-sm font-bold">{title}</h2>
      <div
        data-sidebar-news-slider
        className="flex flex-col gap-2 overflow-y-auto no-scrollbar snap-y snap-mandatory max-h-[22rem]"
      >
        {articles.map((a) => {
          const imageUrl = getArticleHeroUrl(a, "card");
          return (
            <Link
              key={a.id}
              href={`/${locale}/articles/${a.slug}`}
              className="group flex shrink-0 snap-start gap-2 rounded-lg border border-border bg-background p-2 transition-colors hover:border-primary/30"
            >
              <div className="relative aspect-video w-20 shrink-0 overflow-hidden rounded-md bg-secondary">
                {imageUrl && (
                  <Image
                    src={imageUrl}
                    alt={getImageAlt(a.featuredImage)}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-2 text-xs font-semibold leading-tight transition-colors group-hover:text-primary">
                  {a.title}
                </h3>
                {a.publishedAt && (
                  <time
                    dateTime={a.publishedAt}
                    className="mt-1 block text-[10px] text-muted-foreground"
                  >
                    {formatDate(a.publishedAt, locale)}
                  </time>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/components/articles/__tests__/SidebarNewsList.test.tsx`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/articles/SidebarNewsList.tsx src/components/articles/__tests__/SidebarNewsList.test.tsx
git commit -m "feat(article): latest-news rail slider"
```

---

### Task 6: Restructure the article page into a 3-column layout

**Files:**
- Modify: `src/app/(frontend)/[locale]/articles/[slug]/page.tsx`

This wires everything: fetch the three data sources, wrap the existing article card in a centered column, and add the two sticky rails. The existing card markup (lines 119-236) is preserved verbatim — only its wrappers change.

- [ ] **Step 1: Add imports**

In `src/app/(frontend)/[locale]/articles/[slug]/page.tsx`, add to the import block (after line 26):

```tsx
import { getArticles } from "@/lib/payload/queries";
import { getWorldCupFixtures } from "@/lib/api-football/worldcup";
import { getAds } from "@/lib/payload/ads";
import { WorldCupCalendar } from "@/components/articles/WorldCupCalendar";
import { SidebarNewsList } from "@/components/articles/SidebarNewsList";
import { AdCarousel } from "@/components/ads/AdCarousel";
import { NewsletterStrip } from "@/components/newsletter/NewsletterStrip";
```

(Note: `getArticleBySlug`, `resolveArticleBySlug`, etc. are already imported from `@/lib/payload/queries` on lines 8-13; add `getArticles` to that existing named import instead of duplicating if your linter prefers — either compiles.)

- [ ] **Step 2: Fetch the rail data**

In `ArticlePage`, after the `author` line (line 115) and before the `return`, add:

```tsx
  const loc = locale as Config["locale"];
  const dir = locale === "ar" ? "rtl" : "ltr";

  const [worldCupFixtures, latestNews, ads] = await Promise.all([
    getWorldCupFixtures(),
    getArticles({ locale: loc, limit: 12 }),
    getAds(loc),
  ]);
  // Exclude the article being read; show up to a dozen so the 5-row slider scrolls.
  const sidebarNews = latestNews.docs.filter((a) => a.id !== article.id).slice(0, 12);

  const tWorldCup = locale === "ar" ? "مونديال 2026" : locale === "fr" ? "Coupe du monde 2026" : "World Cup 2026";
  const tLatest = locale === "ar" ? "آخر الأخبار" : locale === "fr" ? "Dernières actualités" : "Latest news";
```

- [ ] **Step 3: Replace the outer wrapper with the 3-column layout**

Replace the opening wrapper (lines 117-119):

```tsx
  return (
    <article className="container py-8 max-w-4xl">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6 lg:p-8">
```

with (note: `<article>` becomes the centered middle column; the outer flex is pinned `dir="ltr"` to keep the ad rail physically LEFT and the matches rail physically RIGHT in every locale):

```tsx
  return (
    <div
      dir="ltr"
      className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:flex lg:items-start lg:gap-6 lg:px-8"
    >
      {/* LEFT rail — 300×600 ad + newsletter. Sticky; lg+ only. */}
      <aside
        dir={dir}
        className="hidden shrink-0 space-y-4 lg:sticky lg:top-24 lg:block lg:w-[260px] xl:w-[300px]"
      >
        {ads["article-sidebar"].length > 0 && (
          <AdCarousel ads={ads["article-sidebar"]} format="tower" />
        )}
        <NewsletterStrip locale={locale} />
      </aside>

      {/* CENTER — the article. */}
      <article dir={dir} className="mx-auto w-full min-w-0 max-w-4xl">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6 lg:p-8">
```

- [ ] **Step 4: Replace the closing wrapper + add the RIGHT rail**

Replace the closing tags (lines 236-237):

```tsx
      </div>
    </article>
  );
```

with:

```tsx
        </div>
      </article>

      {/* RIGHT rail — World Cup 2026 calendar + latest news. Sticky; lg+ only. */}
      <aside
        dir={dir}
        className="hidden shrink-0 space-y-4 lg:sticky lg:top-24 lg:block lg:w-[260px] xl:w-[300px]"
      >
        <WorldCupCalendar fixtures={worldCupFixtures} locale={locale} title={tWorldCup} />
        <SidebarNewsList articles={sidebarNews} locale={locale} title={tLatest} />
      </aside>
    </div>
  );
```

- [ ] **Step 5: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: exit 0, no errors. (Watch for: `ads["article-sidebar"]` requires Task 1 done; `format="tower"` requires Task 2 done.)

- [ ] **Step 6: Run the full test suite**

Run: `pnpm vitest run`
Expected: all tests pass (the new component/ads/carousel tests + the existing suite).

- [ ] **Step 7: Build**

Run: `pnpm build`
Expected: exit 0. The article route compiles as a dynamic server component.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(frontend)/[locale]/articles/[slug]/page.tsx"
git commit -m "feat(article): 3-column layout with world cup + news + ad + newsletter rails"
```

---

### Task 7: Apply the DB enum migration to prod (out-of-band)

The `placement` column is a Postgres enum (`enum_ads_placement`). Payload runs with `push: false` and `/src/migrations` is gitignored — schema changes are applied directly to Neon, NOT on deploy (see project memory `project_finalization_floater_ads`). Until this runs, the new "Article page — Side rail" option will error if selected in `/admin`, and `getAds` will still work (it just returns an empty `article-sidebar` group). So this is required before an ad can actually be assigned to the rail.

- [ ] **Step 1: Confirm the enum type name**

The Payload-generated enum for a `select` field is `enum_<collection>_<field>` → `enum_ads_placement`. Confirm against the live DB before altering:

```sql
SELECT enumlabel FROM pg_enum e
JOIN pg_type t ON t.oid = e.enumtypid
WHERE t.typname = 'enum_ads_placement'
ORDER BY e.enumsortorder;
```

Expected: the 5 current values. If the type name differs, adjust the next step accordingly.

- [ ] **Step 2: Add the enum value**

Apply to prod Neon (project `polished-hat-07434434`, "mfm project") via the Neon MCP `run_sql_transaction` when reconnected, or via `psql`/the Neon SQL console:

```sql
ALTER TYPE "enum_ads_placement" ADD VALUE IF NOT EXISTS 'article-sidebar';
```

- [ ] **Step 3: Verify**

Re-run the Step-1 `SELECT`. Expected: `article-sidebar` now appears in the list.

> **Note for executor:** If the Neon MCP is still disconnected and no DB access is available in-session, STOP and flag this to the owner as a one-line manual step (the SQL above). Do not block the rest of the plan — the layout, news rail, World Cup rail, and newsletter all ship and work without it; only the ad creative assignment waits on this.

---

### Task 8: Manual verification + ship

- [ ] **Step 1: Local smoke test**

Run: `pnpm dev`, open an article at `/ar/articles/<slug>` on a ≥1280px viewport.
Expected:
- LEFT rail: a 300×600 ad box (or, if no `article-sidebar` ad seeded yet, just the newsletter box) above the newsletter.
- CENTER: the article, unchanged, centered.
- RIGHT rail: "مونديال 2026" calendar (5 match rows, scrolls) above "آخر الأخبار" (5 news rows, scrolls).
- Scroll the page: both rails stay pinned (sticky) under the header.
- Narrow the window below 1024px: both rails disappear, the article reverts to its current single-column look.
- Switch to `/en/articles/<slug>`: ad rail still physically LEFT, matches rail still physically RIGHT; rail text in English.

- [ ] **Step 2: Push + PR + merge**

```bash
git push -u origin HEAD
```
Open a PR to `main` via the GitHub MCP, then squash-merge once green.

- [ ] **Step 3: Verify the Vercel production deploy**

Confirm the `mfm-sport-kappa.vercel.app` alias promotes to the merge commit in `READY` state and spot-check a live article page.

---

## Self-Review

**Spec coverage:**
- "calendar of the matches to be played, just for the World Cup" → Task 3 (`getWorldCupFixtures`, league 1 / season 2026, `next` = upcoming) + Task 4 (`WorldCupCalendar`). ✅
- "2026 World Cup not some previous one" → `WORLD_CUP_SEASON = 2026`, asserted in Task 3 test. ✅
- "floating vertical slider of 5 elements that stays as we scroll" → Task 4 `max-h-[19rem]` 5-row scroll-snap slider inside a `lg:sticky` rail. ✅
- "under it a vertical slider also with five elements" = latest news → Task 5 `SidebarNewsList` (`max-h-[22rem]`, 5 rows). ✅
- "on the right side / right padding" → RIGHT `<aside>` in Task 6, pinned right via outer `dir="ltr"`. ✅
- "left padding: a vertical ad banner 300×600" → Task 1 placement + Task 2 `tower` format + LEFT `<aside>` `AdCarousel format="tower"`. ✅
- "under it a section reserved for the newsletter" → `NewsletterStrip` in the LEFT rail. ✅
- "added in the left padding of the article page" → confirmed, LEFT rail. ✅
- Admin-managed (the ad) → `article-sidebar` Payload placement (Task 1) + enum migration (Task 7). ✅

**Placeholder scan:** No TBD/TODO; every code step shows full code. ✅

**Type consistency:** `getWorldCupFixtures(): Promise<ApiFixture[]>` feeds `WorldCupCalendar`'s `fixtures: ApiFixture[]`. `ads["article-sidebar"]: AdItem[]` feeds `AdCarousel format="tower"`. `getArticles(...).docs` filtered → `SidebarNewsList`'s `articles` (structural `{id,title,slug,featuredImage?,publishedAt?}`). Placement key `"article-sidebar"` identical across `ads.ts`, `Ads.ts`, `emptyGroups`, page, and the SQL. ✅

**Known tradeoff (documented, not a gap):** at ~1024px the center column is ~440px wide; comfortable from ~1180px. Owner can raise rails to `xl:` if preferred.
