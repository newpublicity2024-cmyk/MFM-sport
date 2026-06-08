# beIN-Style League Logo Strip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the top league carousel to match beIN Sports — show only the league **logos** (no names), as a horizontally-scrollable strip of ~48px contained crests.

**Architecture:** A single focused change to `LeagueCarousel`: drop the name-pill markup, render each league as a 48×48 `object-contain` logo link with 20px gaps and hidden-scrollbar horizontal scroll. The league name moves from visible text to the link's `aria-label`/`title` (accessibility + hover tooltip) so nothing visual is lost for screen-reader/keyboard users.

**Tech Stack:** Next.js 16 (`next/image`, `next/link`), Tailwind CSS v3, Vitest + @testing-library/react.

---

## Background (verified facts)

- **Our component** = [LeagueCarousel.tsx](../../../src/components/home/LeagueCarousel.tsx): each league is currently a pill (`rounded-full border bg-muted px-3 py-1.5`) containing a 20×20 logo **and** the league name (`<span>{league.name}</span>`). It's the first child of the hero `SectionShell` (the top strip). Props: `{ leagues: CarouselLeague[]; locale: string; label: string }`, where `CarouselLeague = { slug; name; logoUrl }`.
- **beIN's slider** (measured live at `beinsports.com/ar-mena`, top strip): a `display:flex` row of league crests — **logo 48×48px**, `object-fit: contain`, **border-radius 0** (square/natural, not circular), **no background/border/padding**, **20px gap**, **no text names**, container ~80px tall, horizontally scrollable. The crest `alt` carries the league name.
- We already have a **`.no-scrollbar`** utility (in [styles.css](../../../src/app/(frontend)/styles.css)) that hides the scrollbar while keeping scroll — use it instead of the current inline `[scrollbar-width:none]...` classes.
- **Only consumer** is [HeroSection.tsx:24](../../../src/components/home/HeroSection.tsx#L24); the `name` field is still passed and is a resolved locale string (from [page.tsx](../../../src/app/(frontend)/[locale]/page.tsx)). No type change is needed.
- **Existing test** = [LeagueCarousel.test.tsx](../../../src/components/home/__tests__/LeagueCarousel.test.tsx) asserts the name is **visible text** (`toHaveTextContent`, `getByText`). That changes — the name becomes the link's accessible name, not visible text. `getByRole("link", { name })` still works via `aria-label`.
- Test conventions: Vitest + @testing-library/react (+ jest-dom matchers like `toHaveAccessibleName`). Single-file run: `pnpm test:run <path>`. Typecheck (incl. tests): `pnpm exec tsc --noEmit -p tsconfig.json`.

## Decisions

- Logo size **48×48** (`h-12 w-12`), `object-contain`, natural/square (no rounding) — matching beIN.
- Gap **20px** (`gap-5`). Keep the existing bottom separator (`border-b pb-4`).
- Names removed visually; kept in `aria-label` + `title` (hover tooltip) on each link.
- Subtle hover affordance: `hover:scale-110`.

## File Structure

- **Modify** `src/components/home/LeagueCarousel.tsx` — logo-only markup.
- **Modify** `src/components/home/__tests__/LeagueCarousel.test.tsx` — assert logo-only + accessible-name behavior.

---

### Task 1: Logo-only league strip (TDD)

**Files:**
- Modify: `src/components/home/LeagueCarousel.tsx`
- Test: `src/components/home/__tests__/LeagueCarousel.test.tsx`

- [ ] **Step 1: Replace the test file to assert the new behavior**

Replace the ENTIRE contents of [LeagueCarousel.test.tsx](../../../src/components/home/__tests__/LeagueCarousel.test.tsx) with:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LeagueCarousel, type CarouselLeague } from "@/components/home/LeagueCarousel";

const leagues: CarouselLeague[] = [
  { slug: "botola-pro-1", name: "Botola Pro 1", logoUrl: "https://media.api-sports.io/football/leagues/200.png" },
  { slug: "bundesliga", name: "Bundesliga", logoUrl: "https://media.api-sports.io/football/leagues/78.png" },
  { slug: "premier-league", name: "Premier League", logoUrl: "https://media.api-sports.io/football/leagues/39.png" },
];

describe("LeagueCarousel", () => {
  it("renders one logo-only link per league, pointing at its competition page", () => {
    render(<LeagueCarousel leagues={leagues} locale="en" label="Leagues" />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAttribute("href", "/en/competition/botola-pro-1");
    // The name is the link's accessible name (aria-label) + hover title...
    expect(links[0]).toHaveAccessibleName("Botola Pro 1");
    expect(links[0]).toHaveAttribute("title", "Botola Pro 1");
    // ...but it is NOT shown as visible text (logos only, like beIN).
    expect(screen.queryByText("Botola Pro 1")).toBeNull();
    expect(screen.queryByText("Bundesliga")).toBeNull();
  });

  it("renders each league as a ~48px contained logo image", () => {
    const { container } = render(<LeagueCarousel leagues={leagues} locale="en" label="Leagues" />);
    const imgs = container.querySelectorAll("img");
    expect(imgs).toHaveLength(3);
    imgs.forEach((img) => {
      expect(img.className).toContain("object-contain");
      expect(img.className).toContain("h-12");
      expect(img.className).toContain("w-12");
    });
  });

  it("is a no-scrollbar horizontal strip with 20px gaps", () => {
    const { container } = render(<LeagueCarousel leagues={leagues} locale="en" label="Leagues" />);
    const nav = container.querySelector("nav") as HTMLElement;
    expect(nav.className).toContain("overflow-x-auto");
    expect(nav.className).toContain("no-scrollbar");
    expect(nav.className).toContain("gap-5");
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
Expected: FAIL — the current component renders the name as visible text (so `queryByText("Botola Pro 1")` is non-null) and the logo is 20px without `object-contain`/`h-12`/`w-12`, and the nav lacks `no-scrollbar`/`gap-5`.

- [ ] **Step 3: Rewrite the component (logos only)**

Replace the ENTIRE contents of [LeagueCarousel.tsx](../../../src/components/home/LeagueCarousel.tsx) with:

```tsx
import Image from "next/image";
import Link from "next/link";

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

// beIN-style top strip: league crests only (no names), ~48px, horizontally
// scrollable. The league name lives in each link's aria-label + title (hover
// tooltip) for accessibility — it is never rendered as visible text.
export function LeagueCarousel({ leagues, locale, label }: Props) {
  if (leagues.length === 0) return null;

  return (
    <nav
      aria-label={label}
      className="mb-4 flex gap-5 overflow-x-auto border-b border-border pb-4 no-scrollbar"
    >
      {leagues.map((league) => (
        <Link
          key={league.slug}
          href={`/${locale}/competition/${league.slug}`}
          aria-label={league.name}
          title={league.name}
          className="flex shrink-0 items-center justify-center transition-transform hover:scale-110"
        >
          <Image
            src={league.logoUrl}
            alt=""
            width={48}
            height={48}
            className="h-12 w-12 object-contain"
          />
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test:run src/components/home/__tests__/LeagueCarousel.test.tsx`
Expected: PASS (5 passing).

- [ ] **Step 5: Typecheck + full suite**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no errors (the `CarouselLeague` type is unchanged, so `HeroSection`/`page.tsx` are unaffected).

Run: `pnpm test:run`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/home/LeagueCarousel.tsx src/components/home/__tests__/LeagueCarousel.test.tsx
git commit -m "feat(home): beIN-style league strip — logos only, no names"
```

---

### Task 2: Visual verification

- [ ] **Step 1: Production build**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 2: Manual check**

Run: `pnpm dev`, open `http://localhost:3000/ar`. At the top of the hero section confirm:
- The league strip shows **only logos** (~48px), evenly spaced (~20px gap), no text names, no pill borders/backgrounds.
- It scrolls horizontally with no visible scrollbar; hovering a logo shows the league name as a tooltip and slightly enlarges it.
- Clicking a logo still navigates to `/ar/competition/<slug>`.
Check `http://localhost:3000/ar` (RTL) and an LTR locale (`/en`) — the strip should look right in both directions.

---

## Self-Review

**Spec coverage:**
- "Display only the logos, not their names" → name span removed; name only in `aria-label`/`title`; test asserts `queryByText(name)` is null while `toHaveAccessibleName` holds. ✅
- "Similar to beIN (study the dimensions)" → 48×48 `object-contain` square logos, 20px gap (`gap-5`), no pill bg/border, horizontal scroll — matching the measured beIN values. ✅
- "Edit the leagues slider at the top" → `LeagueCarousel`, the first element in the hero `SectionShell`. ✅

**Placeholder scan:** No TBD/TODO; full code in every step. ✅

**Type consistency:** `CarouselLeague` (`slug`/`name`/`logoUrl`) and the `Props` shape are unchanged, so `HeroSection` and `page.tsx` need no edits. `name` is reused for `aria-label`/`title`. ✅

**Notes / easy tweaks during execution:**
- Logo size is fixed at 48px (beIN's). If it feels large on small phones, `h-10 w-10 sm:h-12 sm:w-12` is a one-line change.
- The bottom separator (`border-b pb-4`) is kept from the current design; remove if a borderless strip is preferred.
- Some league crests have transparent backgrounds; on the white section surface they read fine (same as beIN). If any specific logo looks faint, that's a per-asset issue, not a layout one.
