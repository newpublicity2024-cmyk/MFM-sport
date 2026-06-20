# Arabic-only site + News-by-league carousel

Date: 2026-06-20

Two independent, approved changes to the live MFM Sport site.

## Part 1 — Arabic-only (soft-disable fr/en, keep data)

**Goal:** Visitors only ever see the Arabic site. Existing French/English translation
data is preserved (reversible) — we only stop *exposing* fr/en on the front end.

**Changes**
- `src/i18n/routing.ts`: `locales: ["ar"]`, `defaultLocale: "ar"` (keep
  `localeDetection: false`). next-intl now only knows Arabic; `/` keeps redirecting
  to `/ar`.
- `src/middleware.ts`: before the intl middleware, 301-redirect any path whose first
  segment is `fr` or `en` to the same path under `ar` (e.g. `/fr/articles/x` →
  `/ar/articles/x`, `/en` → `/ar`), preserving the query string. Keep the existing
  legacy-redirect lookup and `/admin`+`/api` passthrough.
- `src/components/layout/Header.tsx`: remove the `<LanguageSwitcher>` usage. The
  component file is left in the repo (unmounted) so it's trivial to restore.
- `src/app/sitemap.ts`: `LOCALES = ["ar"]` so we stop advertising fr/en URLs.

**Deliberately NOT doing**
- No change to Payload `localization` (ar/fr/en stays) — protects the localized
  `slug` schema and keeps the 200 fr/en translations intact. Admin language tabs
  stay (internal only).
- `html lang`/`dir` already derive from the locale → always `ar`/`rtl` now.

## Part 2 — News-by-league carousel (desktop)

**Goal:** Turn the desktop blog block into a carousel that shows 4 cards at a time
and pages through up to 20 per league tab, with dots only (no arrows) and
auto-advance. Keep the square ad exactly in its current place. Mobile unchanged.

**Changes**
- `src/app/(frontend)/[locale]/page.tsx`: `HOME_ARTICLES_PER_TAB` 8 → 20.
- New `src/components/home/LeagueNewsCarousel.tsx` (client) replacing the desktop
  `NewsGrid2x2` usage in `LeagueNewsSection`:
  - Page size mirrors today's ad logic: `ads.length > 0 ? 3 : 4` cards per page.
    With no active ad (current state) → 4 blogs per page → up to 5 pages of 20.
    With an ad → 3 blogs + the square ad as the 4th cell on every page (ad fixed
    in its current place; blogs cycle).
  - Each page is rendered by reusing `NewsGrid2x2` with that page's slice of
    articles + the same `ads`, so the ad keeps its exact placement/behavior.
  - Track: `overflow-hidden` viewport, flex row of full-width pages,
    `translateX(-100% * current)`. Dots underneath (one per page, current
    highlighted); hidden when there's only one page. No arrows.
  - Auto-advance every 5s, loops, pauses on hover/focus, and does NOT auto-advance
    when `prefers-reduced-motion: reduce`.
  - Resets to page 1 when the league tab changes (parent passes `key={selectedId}`).
- `src/components/home/LeagueNewsSection.tsx`: desktop uses `LeagueNewsCarousel`;
  the leagues panel + playlist banner (right column) and the entire mobile branch
  are unchanged.

**Testing**
- Unit tests for `LeagueNewsCarousel`: page count for N articles with/without ad,
  dots count, dots hidden for single page, page advance on dot click.
- `tsc --noEmit` clean; full vitest suite green; eslint clean on changed files.
