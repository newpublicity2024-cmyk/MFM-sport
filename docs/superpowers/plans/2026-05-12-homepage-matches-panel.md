# Homepage Matches Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three secondary article thumbnails in the hero section's right column with a collapsible matches panel showing today's fixtures organized by championship, and remove the standalone matches list that was below the hero.

**Architecture:** A new `MatchesPanel` client component groups `ApiFixture[]` by league, sorts leagues by priority (Botola Pro → European cups → rest), and renders each league as a collapsible accordion section that is open by default for top-priority leagues. `HeroSection` is updated to accept `fixtures` instead of `secondary` articles. The homepage `page.tsx` removes the standalone today's-matches section, passes `todayFixtures` into `HeroSection`, and adjusts article slicing so the 3 former "secondary" articles flow into the news grid.

**Tech Stack:** Next.js 15 App Router, React `useState` client component, Tailwind CSS, Lucide React icons (`ChevronDown`), existing `MatchCard` component, existing `ApiFixture` type.

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/components/home/MatchesPanel.tsx` | Client component: collapsible per-league accordions, priority sort |
| Modify | `src/components/home/HeroSection.tsx` | Accept `fixtures: ApiFixture[]`; render `MatchesPanel`; equal-height grid |
| Modify | `src/app/(frontend)/[locale]/page.tsx` | Remove `secondary` slice; adjust `topNews`/`moreNews` slicing; remove standalone matches section; pass `todayFixtures` to `HeroSection` |

---

## Current layout (reference)

```
[Hero article – lg:col-span-2, aspect-video] | [3× ArticleCard stacked]
[LiveNowSection]
[Today's Matches section]          ← REMOVED
[TopNews 6 articles]
[LatestNews 6 articles]
[Newsletter]
```

## Target layout

```
[Hero article – lg:col-span-2, h-full] | [MatchesPanel – collapsible by league]
[LiveNowSection]
[TopNews 6 articles]               ← starts from article index 1 (no more gap)
[LatestNews 6 articles]
[Newsletter]
```

---

### Task 1: Create `MatchesPanel` Component

**Files:**
- Create: `src/components/home/MatchesPanel.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { MatchCard } from "@/components/football/MatchCard";
import type { ApiFixture } from "@/lib/api-football/types";

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

type Props = {
  fixtures: ApiFixture[];
  locale: string;
};

export function MatchesPanel({ fixtures, locale }: Props) {
  const groups = groupAndSort(fixtures);

  // Priority 0 (Botola) and 1 (European cups) start open; rest start closed
  const [openIds, setOpenIds] = useState<Set<number>>(
    () => new Set(groups.filter((g) => g.priority <= 1).map((g) => g.league.id)),
  );

  function toggle(id: number) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 h-full">
      {groups.map((group) => {
        const isOpen = openIds.has(group.league.id);
        return (
          <div
            key={group.league.id}
            className="rounded-xl bg-card border border-border overflow-hidden"
          >
            <button
              onClick={() => toggle(group.league.id)}
              className="flex w-full items-center gap-2 px-3 py-2.5 hover:bg-muted/50 transition-colors"
              aria-expanded={isOpen}
            >
              {group.league.logo && (
                <Image
                  src={group.league.logo}
                  alt={group.league.name}
                  width={18}
                  height={18}
                  className="shrink-0"
                  unoptimized
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
              <div className="divide-y divide-border/50 border-t border-border/50">
                {group.fixtures.map((f) => (
                  <MatchCard key={f.fixture.id} fixture={f} locale={locale} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: Exit 0, no errors referencing `MatchesPanel.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/home/MatchesPanel.tsx
git commit -m "feat(home): add MatchesPanel with collapsible championship dropdowns"
```

---

### Task 2: Update `HeroSection` to Use `MatchesPanel`

**Files:**
- Modify: `src/components/home/HeroSection.tsx`

The current file (lines 1–67) accepts `secondary: any[]` and renders 3 `ArticleCard` stacked in the right column. We replace that with `fixtures: ApiFixture[]` and render `MatchesPanel`. We also change the height strategy: the section gets `lg:h-[500px]` so both columns share the same fixed height, the hero fills it with `h-full`, and the matches panel scrolls internally.

- [ ] **Step 1: Overwrite the file**

```tsx
import Image from "next/image";
import Link from "next/link";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import { formatDate, getArticleHeroUrl, getImageAlt } from "@/lib/utils";
import { MatchesPanel } from "@/components/home/MatchesPanel";
import type { ApiFixture } from "@/lib/api-football/types";

type Props = {
  featured: any;
  fixtures: ApiFixture[];
  locale: string;
};

export function HeroSection({ featured, fixtures, locale }: Props) {
  const heroImage = getArticleHeroUrl(featured, "hero");
  const heroAlt = getImageAlt(featured.featuredImage);
  const category = featured.categories?.[0];

  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:h-[500px]">
      {/* Main hero — fills grid cell height on desktop */}
      <article className="lg:col-span-2 group relative rounded-2xl overflow-hidden h-56 lg:h-full">
        {heroImage ? (
          <Image
            src={heroImage}
            alt={heroAlt}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 1024px) 100vw, 66vw"
            priority
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-secondary">
            <span className="text-muted-foreground">MFM Sport</span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-scrim/80 via-transparent to-transparent" />
        <div className="absolute bottom-0 start-0 end-0 p-6">
          {category && typeof category === "object" && (
            <div className="relative z-10 mb-2 inline-block">
              <CategoryBadge name={category.name} slug={category.slug} locale={locale} />
            </div>
          )}
          <h2 className="text-[clamp(1.5rem,3vw+1rem,2.25rem)] font-bold text-white leading-tight line-clamp-3">
            <Link
              href={`/${locale}/articles/${featured.slug}`}
              className="after:absolute after:inset-0 after:content-['']"
            >
              {featured.title}
            </Link>
          </h2>
          {featured.publishedAt && (
            <time dateTime={featured.publishedAt} className="mt-2 block text-sm text-white/70">
              {formatDate(featured.publishedAt, locale)}
            </time>
          )}
        </div>
      </article>

      {/* Matches panel — same height as hero, scrollable */}
      <div className="lg:h-full overflow-y-auto">
        <MatchesPanel fixtures={fixtures} locale={locale} />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: Exit 0. The `secondary` prop is gone; `fixtures` is typed as `ApiFixture[]`.

- [ ] **Step 3: Commit**

```bash
git add src/components/home/HeroSection.tsx
git commit -m "feat(home): replace secondary article column with MatchesPanel in HeroSection"
```

---

### Task 3: Update Homepage `page.tsx`

**Files:**
- Modify: `src/app/(frontend)/[locale]/page.tsx`

Current state (lines 29–103):
- `secondary = articles.slice(1, 4)` — no longer needed
- `topNews = articles.slice(4, 10)` — shift up to index 1
- `moreNews = articles.slice(10, 16)` — shift up to index 7
- `<HeroSection featured={featured} secondary={secondary} locale={locale} />` — swap `secondary` for `fixtures`
- Standalone today's matches section (lines 69–78) — remove entirely

- [ ] **Step 1: Remove `secondary` slice, shift `topNews` and `moreNews`, pass `todayFixtures` to hero, remove the standalone matches section**

Replace the `return` block (lines 62–102 in the original file). The full updated file:

```tsx
import type { Metadata } from "next";
import type { Config } from "@/payload-types";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getArticles } from "@/lib/payload/queries";
import { getFixturesByDate, getLiveFixtures } from "@/lib/api-football/fixtures";
import { LiveNowSection } from "@/components/football/LiveNowSection";
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
  const [todayFixtures, liveFixtures] = await Promise.all([
    getFixturesByDate(today),
    getLiveFixtures(),
  ]);

  // Fetch latest articles: featured + 6 top + 6 more = 13 needed; fetch 16 for headroom
  const latest = await getArticles({ locale: locale as Config["locale"], page: 1, limit: 16 });
  const articles = latest.docs;

  const featured = articles[0];
  const topNews = articles.slice(1, 7);
  const moreNews = articles.slice(7, 13);

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

      <HeroSection featured={featured} fixtures={todayFixtures} locale={locale} />

      <LiveNowSection initial={liveFixtures} locale={locale} />

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

Note: The `SectionHeader` import and `MatchList` import are also removed since they were only used in the standalone matches section.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: Exit 0. No unused-import errors (SectionHeader and MatchList are removed from page.tsx).

- [ ] **Step 3: Commit**

```bash
git add src/app/(frontend)/[locale]/page.tsx
git commit -m "feat(home): move today's matches into hero sidebar; remove standalone matches section"
```

---

### Task 4: Visual Verification

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

Open `http://localhost:3000/ar` (default Arabic locale).

- [ ] **Step 2: Check desktop layout**

At viewport ≥ 1024px verify:
- Hero image fills the left 2/3 at 500px height
- Matches panel fills the right 1/3 at the same 500px height with an internal scrollbar when content overflows
- Botola Pro league appears first, European cups second, all others after
- Priority leagues (Botola, European) are open by default; others are collapsed
- Clicking a league header toggles the fixture list
- Fixture count badge shows next to each league name

- [ ] **Step 3: Check mobile layout**

At viewport < 1024px verify:
- Hero image shows at `h-56` (224px), full width
- Matches panel stacks below with natural height (no overflow scroll, all content visible)
- Accordion toggle still works

- [ ] **Step 4: Check RTL (Arabic)**

On `/ar`:
- League logo is on the leading side (right in RTL)
- Chevron on the trailing side
- Hero title text is right-aligned

- [ ] **Step 5: Check that news sections appear directly below the LiveNowSection with no gap**

Verify the standalone "Today's Matches" heading is gone. Confirm TopNews section header appears immediately after LiveNowSection (or after the hero if no live matches exist).

- [ ] **Step 6: Check empty-fixtures edge case**

If `todayFixtures` is empty (no matches today), `MatchesPanel` returns `null` (handled by the `if (groups.length === 0) return null` guard). The right column will be empty. Verify no layout collapse — the hero should still render correctly in its `lg:col-span-2` cell.

---

## Self-Review

### Spec Coverage

| Requirement | Covered by |
|-------------|-----------|
| Replace two small blog thumbnails with matches section | Task 2 — `MatchesPanel` replaces `ArticleCard` column |
| Matches panel same height as hero | Task 2 — `lg:h-[500px]` on section, `h-full` on both columns |
| Dropdowns by championship | Task 1 — accordion per `league.id` group |
| Botola Pro first | Task 1 — `getLeaguePriority` returns 0 for Morocco/Botola |
| European championships second | Task 1 — `getLeaguePriority` returns 1 for Europe/UCL/UEL/UECL |
| Rest after | Task 1 — `getLeaguePriority` returns 2 for everything else |
| Remove standalone matches list below | Task 3 — section removed from page.tsx |
| News/blogs sections directly under hero | Task 3 — `NewsSection` immediately follows `LiveNowSection` |

### Placeholder Scan

None found — all steps include complete code.

### Type Consistency

- `MatchesPanel` accepts `fixtures: ApiFixture[]` ✓
- `HeroSection` prop `fixtures: ApiFixture[]` matches the call `<HeroSection fixtures={todayFixtures} />` ✓
- `todayFixtures` is `ApiFixture[]` from `getFixturesByDate()` ✓
- `groupAndSort` returns `LeagueGroup[]` used only inside `MatchesPanel` ✓
- `toggle(id: number)` matches `group.league.id: number` ✓
