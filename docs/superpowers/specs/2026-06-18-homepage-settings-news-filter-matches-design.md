# Design — Homepage Settings: news filter + match selection

Date: 2026-06-18
Branch: `feat/homepage-settings-news-filter-matches`

Admin-editable control over the homepage news-by-league filter and the two match
areas (hero panel + the section after the videos), via a new Payload Global.

## New: Payload Global `homepage` ("Homepage Settings" / إعدادات الصفحة الرئيسية)

`src/globals/Homepage.ts`, registered in `payload.config.ts` (`globals: [Homepage]`).
Public read (`access.read: () => true`). Trilingual labels (en/fr/ar).

Fields:
- `newsFilters` — array (drag to reorder). Each row:
  - `competition` (relationship → competitions, required) — pill crest + localized name.
  - `tag` (relationship → tags, optional) — articles with this tag fill the tab.
- `heroMatches` — group:
  - `competition` (relationship → competitions, optional) — its fixtures (all statuses) feed the hero panel. Empty → World Cup.
- `homeMatches` — group:
  - `mode` (select: `today` | `competition`, default `today`).
  - `competition` (relationship → competitions, condition: mode === competition).

Requires a DB migration (new global tables). Must be applied to production Neon.

## Article sourcing per filter row (tag-first, category fallback)
For each `newsFilters` row, in array order:
- pill = LeagueLite from the competition (crest + localized name; World Cup id 1
  uses `WORLD_CUP_LOGO`). Pill `id` = competition slug (so `LeaguesPanel` keys work).
- articles:
  1. If `tag` set → `getArticlesByTag(tag.id, locale, 1, N)`.
  2. If no tag OR step 1 returns 0 AND the competition has a linked `category` →
     `getArticlesByCategory(category.id, locale, 1, N)`.
  3. Else empty.
- `N` = homepage per-tab limit (e.g. 8).

This replaces `buildLeagueArticles`'s placeholder chunking entirely.

## Match areas
- Hero: `heroMatches.competition` → `getFixturesByLeague(apiFootballId, season)`
  (all statuses). World Cup uses season `WORLD_CUP_SEASON` regardless of the
  competition doc's season. Empty config → `getAllWorldCupFixtures()`.
- Lower: `homeMatches.mode === "competition"` → that competition's fixtures
  (same league/season rule). Else → `getFixturesByDateForLeagues(today, ourLeagueIds)`
  (current behavior).

## Homepage rewiring (`page.tsx`)
- `findHomepageSettings(locale)` (new query) reads the global at depth 2.
- Build pills + `articlesByFilter` from the global (fallback: if the global has no
  `newsFilters`, derive from competitions of type "league" as today — no regression).
- Hero/lower fixtures from the global as above.
- Carousel untouched.

## New / changed code
- `src/globals/Homepage.ts` (new) + register in `payload.config.ts`.
- `src/lib/payload/queries.ts`: `findHomepageSettings(locale)`.
- `src/lib/home/cards.ts`: `filtersToLeagues(rows)` (order-preserving, WC logo
  override) + a builder that maps each row → articles (tag/category). The
  article-fetching happens in `page.tsx` (async); cards.ts stays pure mappers.
- `src/app/(frontend)/[locale]/page.tsx`: read global, build pills + articles,
  pick fixtures.
- Migration via `payload migrate:create homepage_global`.
- `scripts/seed-homepage.ts` (new, idempotent): create a "World Cup" tag
  (ar كأس العالم / fr Coupe du monde / en World Cup) if missing; seed the global —
  `newsFilters` = [World Cup, …current leagues with the last dropped], hero =
  World Cup, lower `mode` = today. Wire `seed:homepage` in package.json.

## Verification
- `tsc` clean, unit tests pass.
- After the migration is applied: homepage renders pills from the global, the
  World Cup tab shows World-Cup-tagged articles, other tabs fall back to their
  category, hero shows the configured competition. Admin shows "Homepage
  Settings" fully in Arabic when the panel is Arabic.

## Risks
- New Global → migration required on prod Neon (additive, reversible).
- Local `.env` points at prod DB, so applying the migration locally affects prod —
  confirm timing before applying.
- Tabs without a tag and without a linked category will be empty (by design).
