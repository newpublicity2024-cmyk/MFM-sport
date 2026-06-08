# Responsive + Localized League Carousel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the beIN-style logos-only league strip on mobile, but on desktop restore the logo+name pills (names in the page's language) and add prev/next scroll arrows.

**Architecture:** `LeagueCarousel` becomes a small client component (arrows need `scrollBy`). One responsive list: each item shows the logo always; on `lg+` it also shows the league name and pill styling. Desktop-only arrow buttons scroll the strip. The league names come from `getCompetitions(locale)` (already wired) — but the DB only has Arabic-as-Latin and no fr/en, so a one-time data fix populates proper **ar/fr/en** names for the 12 competitions.

**Tech Stack:** Next.js 16 (client component, `next/image`, `next/link`), `lucide-react` icons, Tailwind CSS v3, Vitest + @testing-library/react, Payload/Postgres (Neon) for the localized names.

---

## Background (verified facts)

- **Current component** = [LeagueCarousel.tsx](../../../src/components/home/LeagueCarousel.tsx): beIN-style logos-only strip (48px `object-contain`, 20px gap, `no-scrollbar`, names only in `aria-label`/`title`). Server component. Used once in [HeroSection.tsx:24](../../../src/components/home/HeroSection.tsx#L24). Props `{ leagues: CarouselLeague[]; locale; label }`, `CarouselLeague = { slug; name; logoUrl }`.
- **Names data flow**: [page.tsx](../../../src/app/(frontend)/[locale]/page.tsx) builds `carouselLeagues` from `getCompetitions(locale)` ([queries.ts:246-255](../../../src/lib/payload/queries.ts#L246-L255), which passes `locale`). `Competitions.name` is `localized: true` ([Competitions.ts:10](../../../src/collections/Competitions.ts#L10)). So `c.name` is already locale-resolved — **no page.tsx change is needed**; we only need the DB to actually contain per-locale names.
- **DB reality (Neon project `polished-hat-07434434`, table `competitions_locales`)**: only `_locale='ar'` rows exist (12), and they hold **Latin** strings ("Premier League", "La Liga", …). No `fr`/`en` rows. With Payload `fallback: true`, fr/en fall back to those Latin ar values — so names never localize. The `_locales` enum is `{ar, fr, en}`. Table columns: `name` (varchar, NOT NULL), `id` (serial), `_locale` (enum), `_parent_id` (int → competitions.id).
- **The 12 competitions** (id / slug): 1 botola-pro-1, 2 caf-champions-league, 3 caf-confederation-cup, 4 africa-cup-of-nations, 5 world-cup-2026-competition, 6 premier-league, 7 la-liga, 8 bundesliga, 9 serie-a, 10 ligue-1, 11 uefa-champions-league, 12 uefa-europa-league.
- **`.no-scrollbar`** utility exists; `lucide-react` is installed (`ChevronDown` already used in [MatchesPanel.tsx](../../../src/components/home/MatchesPanel.tsx)).
- **Existing test** [LeagueCarousel.test.tsx](../../../src/components/home/__tests__/LeagueCarousel.test.tsx) asserts logos-only (no visible name). That must change — names are now visible on desktop (present in DOM inside a `hidden lg:inline` span).
- Test conventions: Vitest + @testing-library/react (+ jest-dom). jsdom doesn't implement `Element.scrollBy` (stub it). Single-file run: `pnpm test:run <path>`. Typecheck incl. tests: `pnpm exec tsc --noEmit -p tsconfig.json`. Migrations/data are applied out-of-band to Neon (project convention).

## Decisions

- Mobile (`< lg`): logos-only 48px strip, 20px gap, swipe (no arrows) — unchanged behavior.
- Desktop (`lg+`): logo (20px) + name pill (the old design) + prev/next arrows; `lg:px-10` so items clear the arrows.
- Arrows scroll by `0.8 × clientWidth`; left button `scrollBy({left: -amount})`, right `{left: +amount}` (physical, works in both LTR and RTL on modern browsers). Always visible on desktop (no end-disable — YAGNI).
- Localize the 12 competition names in the DB: `ar` → Arabic, `fr` → French, `en` → English. Applied via Neon MCP (controller), matching the out-of-band migration convention.

## File Structure

- **Modify** `src/components/home/LeagueCarousel.tsx` — responsive client component with arrows.
- **Modify** `src/components/home/__tests__/LeagueCarousel.test.tsx` — names-visible-on-desktop + arrows + responsive logo assertions.
- **Data (no file)** — `competitions_locales` ar/fr/en names via Neon (controller).

---

### Task 1: Responsive carousel with desktop names + arrows (TDD)

**Files:**
- Modify: `src/components/home/LeagueCarousel.tsx`
- Test: `src/components/home/__tests__/LeagueCarousel.test.tsx`

- [ ] **Step 1: Replace the test file**

Replace the ENTIRE contents of [LeagueCarousel.test.tsx](../../../src/components/home/__tests__/LeagueCarousel.test.tsx) with:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LeagueCarousel, type CarouselLeague } from "@/components/home/LeagueCarousel";

const leagues: CarouselLeague[] = [
  { slug: "botola-pro-1", name: "Botola Pro 1", logoUrl: "https://media.api-sports.io/football/leagues/200.png" },
  { slug: "bundesliga", name: "Bundesliga", logoUrl: "https://media.api-sports.io/football/leagues/78.png" },
  { slug: "premier-league", name: "Premier League", logoUrl: "https://media.api-sports.io/football/leagues/39.png" },
];

describe("LeagueCarousel", () => {
  it("renders one link per league with logo, name, and competition href", () => {
    render(<LeagueCarousel leagues={leagues} locale="en" label="Leagues" />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAttribute("href", "/en/competition/botola-pro-1");
    expect(links[0]).toHaveAccessibleName("Botola Pro 1");
  });

  it("renders the name in a desktop-only span (hidden on mobile)", () => {
    render(<LeagueCarousel leagues={leagues} locale="en" label="Leagues" />);
    const nameEl = screen.getByText("Bundesliga");
    expect(nameEl.className).toContain("hidden");
    expect(nameEl.className).toContain("lg:inline");
  });

  it("renders responsive logos (48px mobile, 20px desktop, contained)", () => {
    const { container } = render(<LeagueCarousel leagues={leagues} locale="en" label="Leagues" />);
    const imgs = container.querySelectorAll("img");
    expect(imgs).toHaveLength(3);
    imgs.forEach((img) => {
      expect(img.className).toContain("object-contain");
      expect(img.className).toContain("h-12");
      expect(img.className).toContain("lg:h-5");
    });
  });

  it("has desktop-only prev/next arrows that scroll the strip", () => {
    const scrollBy = vi.fn();
    // jsdom doesn't implement scrollBy; stub it on the element prototype.
    (HTMLElement.prototype as unknown as { scrollBy: unknown }).scrollBy = scrollBy;
    render(<LeagueCarousel leagues={leagues} locale="en" label="Leagues" />);
    const left = screen.getByRole("button", { name: /left/i });
    const right = screen.getByRole("button", { name: /right/i });
    // Arrows live in a desktop-only (lg:flex) wrapper.
    expect(left.parentElement?.className).toContain("lg:flex");
    expect(right.parentElement?.className).toContain("lg:flex");
    fireEvent.click(right);
    fireEvent.click(left);
    expect(scrollBy).toHaveBeenCalledTimes(2);
    // Each call passes a numeric horizontal delta.
    for (const call of scrollBy.mock.calls) {
      expect(typeof call[0].left).toBe("number");
    }
  });

  it("labels the nav and builds locale-aware hrefs", () => {
    render(<LeagueCarousel leagues={leagues} locale="ar" label="البطولات" />);
    expect(screen.getByRole("navigation", { name: "البطولات" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bundesliga" })).toHaveAttribute(
      "href",
      "/ar/competition/bundesliga",
    );
  });

  it("renders nothing when there are no leagues", () => {
    const { container } = render(
      <LeagueCarousel leagues={[]} locale="en" label="Leagues" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:run src/components/home/__tests__/LeagueCarousel.test.tsx`
Expected: FAIL — current component has no name span, no arrows, and logos aren't responsive (`lg:h-5` absent).

- [ ] **Step 3: Rewrite the component**

Replace the ENTIRE contents of [LeagueCarousel.tsx](../../../src/components/home/LeagueCarousel.tsx) with:

```tsx
"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type CarouselLeague = {
  slug: string;
  name: string;
  logoUrl: string;
};

type Props = {
  leagues: CarouselLeague[];
  locale: string;
  label: string;
};

// Mobile: beIN-style logos-only strip (swipe). Desktop (lg+): logo + name pills
// with prev/next scroll arrows. Names come from props (already localized by
// getCompetitions(locale)).
export function LeagueCarousel({ leagues, locale, label }: Props) {
  const scrollerRef = useRef<HTMLElement>(null);

  if (leagues.length === 0) return null;

  function scroll(direction: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  }

  return (
    <div className="relative mb-4 border-b border-border pb-4">
      {/* Desktop-only scroll arrows. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden items-center pb-4 lg:flex">
        <button
          type="button"
          aria-label="Scroll leagues left"
          onClick={() => scroll(-1)}
          className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-muted"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden items-center pb-4 lg:flex">
        <button
          type="button"
          aria-label="Scroll leagues right"
          onClick={() => scroll(1)}
          className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-muted"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <nav
        ref={scrollerRef}
        aria-label={label}
        className="flex gap-5 overflow-x-auto no-scrollbar lg:gap-2 lg:px-10"
      >
        {leagues.map((league) => (
          <Link
            key={league.slug}
            href={`/${locale}/competition/${league.slug}`}
            aria-label={league.name}
            title={league.name}
            className="flex shrink-0 items-center justify-center transition hover:scale-110 lg:gap-2 lg:rounded-full lg:border lg:border-border lg:bg-muted lg:px-3 lg:py-1.5 lg:hover:scale-100 lg:hover:border-primary/40 lg:hover:bg-primary/10"
          >
            <Image
              src={league.logoUrl}
              alt=""
              width={48}
              height={48}
              className="h-12 w-12 object-contain lg:h-5 lg:w-5"
            />
            <span className="hidden whitespace-nowrap text-sm font-medium lg:inline">
              {league.name}
            </span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test:run src/components/home/__tests__/LeagueCarousel.test.tsx`
Expected: PASS (6 passing).

- [ ] **Step 5: Typecheck + full suite**

Run: `pnpm exec tsc --noEmit -p tsconfig.json` (no errors — `CarouselLeague`/`Props` unchanged, so `HeroSection`/`page.tsx` are unaffected).
Run: `pnpm test:run` (all pass).

- [ ] **Step 6: Commit**

```bash
git add src/components/home/LeagueCarousel.tsx src/components/home/__tests__/LeagueCarousel.test.tsx
git commit -m "feat(home): desktop league pills with names + scroll arrows (mobile stays logos-only)"
```

---

### Task 2: Localize the 12 competition names in the DB (controller, Neon MCP)

> **Controller-handled** (writes to the production Neon DB, project `polished-hat-07434434`). Not a subagent task. Applied via `mcp__neon__run_sql_transaction`. This sets `ar` to Arabic and adds `fr`/`en` rows for all 12 competitions, so `getCompetitions(locale)` returns names in the chosen language everywhere `c.name` is shown (carousel + competition pages).

- [ ] **Step 1: Apply the localization transaction**

Run these statements as one transaction (`mcp__neon__run_sql_transaction`, `projectId: "polished-hat-07434434"`):

```sql
-- Fix Arabic (currently Latin) for all 12.
UPDATE competitions_locales SET name='البطولة الاحترافية'        WHERE _parent_id=1  AND _locale='ar';
UPDATE competitions_locales SET name='دوري أبطال إفريقيا'        WHERE _parent_id=2  AND _locale='ar';
UPDATE competitions_locales SET name='كأس الاتحاد الإفريقي'      WHERE _parent_id=3  AND _locale='ar';
UPDATE competitions_locales SET name='كأس أمم إفريقيا'           WHERE _parent_id=4  AND _locale='ar';
UPDATE competitions_locales SET name='كأس العالم 2026'           WHERE _parent_id=5  AND _locale='ar';
UPDATE competitions_locales SET name='الدوري الإنجليزي الممتاز'  WHERE _parent_id=6  AND _locale='ar';
UPDATE competitions_locales SET name='الدوري الإسباني'           WHERE _parent_id=7  AND _locale='ar';
UPDATE competitions_locales SET name='الدوري الألماني'           WHERE _parent_id=8  AND _locale='ar';
UPDATE competitions_locales SET name='الدوري الإيطالي'           WHERE _parent_id=9  AND _locale='ar';
UPDATE competitions_locales SET name='الدوري الفرنسي'            WHERE _parent_id=10 AND _locale='ar';
UPDATE competitions_locales SET name='دوري أبطال أوروبا'         WHERE _parent_id=11 AND _locale='ar';
UPDATE competitions_locales SET name='الدوري الأوروبي'           WHERE _parent_id=12 AND _locale='ar';

-- French.
INSERT INTO competitions_locales (name, _locale, _parent_id) VALUES
 ('Botola Pro 1','fr',1),
 ('Ligue des champions de la CAF','fr',2),
 ('Coupe de la confédération CAF','fr',3),
 ('Coupe d''Afrique des nations','fr',4),
 ('Coupe du monde 2026','fr',5),
 ('Premier League','fr',6),
 ('La Liga','fr',7),
 ('Bundesliga','fr',8),
 ('Serie A','fr',9),
 ('Ligue 1','fr',10),
 ('Ligue des champions de l''UEFA','fr',11),
 ('Ligue Europa','fr',12);

-- English.
INSERT INTO competitions_locales (name, _locale, _parent_id) VALUES
 ('Botola Pro 1','en',1),
 ('CAF Champions League','en',2),
 ('CAF Confederation Cup','en',3),
 ('Africa Cup of Nations','en',4),
 ('FIFA World Cup 2026','en',5),
 ('Premier League','en',6),
 ('La Liga','en',7),
 ('Bundesliga','en',8),
 ('Serie A','en',9),
 ('Ligue 1','en',10),
 ('UEFA Champions League','en',11),
 ('UEFA Europa League','en',12);
```

- [ ] **Step 2: Verify the data**

Run (`mcp__neon__run_sql`):

```sql
SELECT _parent_id, _locale, name FROM competitions_locales WHERE _parent_id IN (6,1,11) ORDER BY _parent_id, _locale;
```

Expected: each competition now has 3 rows (ar/en/fr) — e.g. id 6 → `ar: الدوري الإنجليزي الممتاز`, `en: Premier League`, `fr: Premier League`; id 1 → `ar: البطولة الاحترافية`; id 11 → `ar: دوري أبطال أوروبا`, `en: UEFA Champions League`, `fr: Ligue des champions de l'UEFA`. Also confirm the total count:

```sql
SELECT _locale, count(*) FROM competitions_locales GROUP BY _locale ORDER BY _locale;
```

Expected: `ar 12`, `en 12`, `fr 12`.

---

### Task 3: Build + live verification

- [ ] **Step 1: Production build**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 2: Manual check (after Task 2 data is applied)**

Run `pnpm dev` and confirm:
- **Desktop** (`≥1024px`) `http://localhost:3000/ar`: league pills show **logo + Arabic name**, with left/right arrow buttons that smooth-scroll the strip.
- `http://localhost:3000/fr` and `/en`: the same pills show **French** / **English** names respectively.
- **Mobile** (`<1024px`): only the 48px logos, no names, no arrows (swipe) — unchanged.
- Clicking a league still navigates to `/<locale>/competition/<slug>`.

---

## Self-Review

**Spec coverage:**
- "Keep mobile as is" → mobile renders logo only (name span `hidden`, no pill, no arrows `lg:flex`). ✅
- "Restore old desktop (names on the side)" → `lg:` pill styling + `lg:inline` name + 20px logo (`lg:h-5 lg:w-5`). ✅
- "Names according to the language chosen" → Task 2 populates ar/fr/en; `getCompetitions(locale)` + `c.name` already wired, so the displayed name follows the locale. ✅
- "Desktop slider missing arrows" → Task 1 adds desktop-only prev/next arrow buttons that `scrollBy`. ✅

**Placeholder scan:** No TBD/TODO; full component code, full test code, and exact SQL provided. ✅

**Type consistency:** `CarouselLeague` (`slug`/`name`/`logoUrl`) and `Props` are unchanged → `HeroSection`/`page.tsx` need no edits. The `scroll(direction)` helper and `scrollerRef` are internal and self-consistent. ✅

**Notes / easy tweaks during execution:**
- jsdom reports `clientWidth = 0`, so the arrow test asserts `scrollBy` is called with a numeric `left` (not the exact sign) — the direction logic is plain and review-visible.
- Arrow vertical centering uses `inset-y-0 ... pb-4` so the buttons center over the logo row (not the bottom separator).
- If any Arabic name should match a different house style, it's a one-line `UPDATE` — the names are data, not code.
