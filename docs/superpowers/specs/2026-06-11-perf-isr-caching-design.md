# P0 Performance: ISR Caching + Path-Based Pagination

**Date:** 2026-06-11
**Branch:** `feat/perf-isr-caching`
**Status:** Design approved, pending implementation plan

## Problem

Vercel Speed Insights (Desktop, P75, last 7 days) shows Morocco Real Experience
Score = 78 ("Needs Improvement"), driven entirely by the server-response chain:
TTFB 1.33s → FCP 2.61s → LCP 3.54s. Interactivity (INP 88ms, FID 5ms) is already
excellent.

Two confirmed root causes:

1. **Transatlantic DB hop.** Vercel functions run in the EU (proven by Morocco
   TTFB being *lower* than US TTFB), but the Neon database is in `us-east-1`
   (`ep-billowing-scene-amkzchn3.c-5.us-east-1.aws.neon.tech`). Every dynamic
   render makes an EU-function → US-DB round-trip, inflating TTFB for everyone.

2. **Uncached listing routes.** `articles` and `category/[slug]` read
   `searchParams.page`, which forces per-request dynamic rendering in the Next.js
   App Router — so they hit the transatlantic DB on every view. These are the
   worst Morocco routes (`/category/...` RES 45 Poor, `/articles` RES 74). The
   homepage scores 92 because it is cached. `club/[slug]` and `competition/[slug]`
   already use `revalidate = 900` and are fine.

This spec covers **P0 only** (caching). The DB region move (P1), LCP/image work
(P2), and CLS work (P3) are tracked separately and out of scope here.

## Goal

Take article detail and the articles/category listings off the per-request DB
path so the vast majority of page views are served as pre-built static pages from
the edge CDN (~100ms TTFB) instead of a ~1.3s dynamic render. Do this **without
introducing stale content** and **without risking build-time DB fragility**.

## Approach: Aggressive ISR + on-demand revalidation

The fastest possible serving is fully static pages from the edge, with the DB
essentially never on the request path. To cache that hard without staleness, we
pair long-lived ISR with instant cache-busting on publish.

### 1. Article detail — `src/app/(frontend)/[locale]/articles/[slug]/page.tsx`

- Add `export const revalidate = 3600` (1-hour backstop; freshness comes from the
  on-demand hook below, so the timer is just a safety net).
- Add `generateStaticParams` to pre-render the bounded catalog (~200 articles ×
  3 locales) so even first visits are instant.
  - **Safe fallback:** if the build-time DB read throws, `generateStaticParams`
    returns `[]` and pages fall back to on-demand rendering. This protects against
    the build-time DB/API fragility seen previously. `dynamicParams` stays `true`
    (the default) so slugs not in the prebuilt set still render on demand.
- The page already reads only `params` (no `searchParams`), so no structural
  change is needed beyond the above.

### 2. Listings — move pagination from `?page=` into the URL path

New route structure (page 1 keeps the clean base URL; deeper pages get a path
segment, which does **not** force dynamic rendering):

```
/[locale]/articles                    → page 1   (ISR)
/[locale]/articles/page/[n]           → page 2+  (ISR)
/[locale]/category/[slug]             → page 1   (ISR)
/[locale]/category/[slug]/page/[n]    → page 2+  (ISR)
```

- Base routes **stop reading `searchParams`** → become statically cacheable.
- `/page/[n]` routes read `n` from `params`.
- All four use `export const revalidate = 3600`.
- **Shared listing component.** Extract the listing body into a shared component
  (e.g. `ArticlesListing`, `CategoryListing`) that takes a resolved `page` number,
  so the base route and the `/page/[n]` route both delegate to it. Keeps each
  route file tiny and the query/render logic in one place.
- `/page/1` 301-redirects to the clean base URL (single canonical URL per page).

### 3. Pagination component — `src/components/shared/Pagination.tsx`

Change `pageUrl()` only:

```
page 1 → `${basePath}`
page N → `${basePath}/page/${N}`
```

`basePath` stays `/[locale]/articles` or `/[locale]/category/[slug]`. The visual
component is otherwise untouched.

### 4. On-demand revalidation (the key upgrade)

Add Payload `afterChange` + `afterDelete` collection hooks on **Articles** and
**Categories** that call `revalidatePath()` for exactly the affected pages:

- the article's own page, for each locale: `/${locale}/articles/${slug}`
- its category pages: `/${locale}/category/${categorySlug}`
- the listings: `/${locale}/articles`
- the homepage: `/${locale}`

Effect: editors see updates instantly on publish, which is what lets us cache with
a long backstop and zero staleness. Hooks must be resilient — a revalidation
failure must not block the Payload write (wrap in try/catch, log and continue).

### 5. Redirect legacy `?page=N` URLs

Add a 301 redirect so indexed/bookmarked `/articles?page=3` →
`/articles/page/3` (and the category equivalent). Prefer `next.config.ts`
`redirects()`; if querystring matching is insufficient there, handle it in the
existing middleware. Preserves SEO and external links.

## Out of scope

- P1: move Neon DB to an EU region + pin functions to `cdg1`.
- P2: LCP/image work (serve Media from Blob CDN, `priority`/`sizes`/AVIF).
- P3: CLS 0.19 (reserve ad-banner/image space, font `display:swap`).

## Testing / verification

- Local build succeeds; confirm the `generateStaticParams` fallback path works
  even if the DB is unreachable at build (no build failure).
- Preview deploy:
  - `/ar/category/<slug>` returns `x-vercel-cache: HIT` on second load.
  - Pagination links now navigate to `/page/2` and render correctly.
  - Legacy `/articles?page=2` 301-redirects to `/articles/page/2`.
  - Publishing/editing an article in Payload refreshes the relevant pages
    within seconds (on-demand revalidation works).
- Re-check Speed Insights / PageSpeed against the preview URL for the TTFB drop.

## Trade-offs accepted

- Worst-case staleness is the 1-hour backstop, but only if an on-demand hook
  fails; normal publishes are instant.
- The first-ever visit to a never-generated, non-prebuilt slug renders on demand
  once, then caches.
- Slightly more moving parts (hooks + `generateStaticParams` fallback) than a
  bare `revalidate`, in exchange for always-cache-hit speed with instant freshness.
