# Fix: Newly published Arabic articles 500 in production

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop every newly published Arabic article from returning a 500 ("page couldn't load") on the live site.

**Architecture:** Revert the article detail route (`/[locale]/articles/[slug]`) from ISR/SSG back to dynamic rendering — the exact configuration that served Arabic articles correctly before commit `99a3c35`.

**Tech Stack:** Next.js 16.2.4 (App Router) on Vercel, Payload 3.84, Neon Postgres.

---

## Root cause (diagnosed 2026-06-12)

- The new article **was** saved correctly — DB row id `393`, `status=published`, full Arabic title/body/author/category. "DB not updated" was a false alarm (localized fields live in `articles_locales`, not `articles`).
- The 500 is a **production-only** failure traced via Vercel runtime logs (deployment `dpl_3WMtqDqu64...`, domain `www.mfmsport.ma`):
  ```
  TypeError: Invalid character in header content
  GET /ar/articles/%D9%86%D8%B5%D9%8A%D8%B1...  → 500
  ```
- Commit `99a3c35 "feat(perf): ISR + static params for article detail pages"` (2026-06-11) converted the route to ISR/SSG (`revalidate=3600` + `generateStaticParams`).
- On Vercel, serving an ISR/SSG page whose URL path contains **non-ASCII (Arabic)** characters writes the raw matched-path into an HTTP header when the function runs (cache miss / background revalidation) → Node rejects the non-ASCII header → `TypeError: Invalid character in header content`.
  - Articles prerendered at deploy time → served from cache (200/STALE), error only logged on background revalidation.
  - Any article published **after** the last deploy (e.g. #393) → cache miss → no fallback → **500**. Blocks all new publishing.
- Confirmed: a *non-existent* Arabic slug also 500s; a non-existent **ASCII** slug returns 200. Not reproducible in local `dev` or `next start` (even in SSG mode) — it is Vercel's serving layer.
- Scope check: only the article `[slug]` route has non-ASCII slugs. Category/tag/author/club/competition slugs are all ASCII, so they are unaffected.

## The fix

Remove exactly the three things commit `99a3c35` added to `src/app/(frontend)/[locale]/articles/[slug]/page.tsx`:
1. the `getAllArticleSlugs` import,
2. `export const revalidate = 3600;`,
3. the `generateStaticParams` function.

No `force-dynamic` is added — pre-ISR the route had none and worked. API-Football fetches remain cached via their own `next: { revalidate }`, so quota impact is unchanged. Payload DB queries run per request (same as the homepage).

---

### Task 1: Make the article detail route dynamic

**Files:**
- Modify: `src/app/(frontend)/[locale]/articles/[slug]/page.tsx`

- [ ] **Step 1: Remove the now-unused import**

Delete `getAllArticleSlugs,` from the `@/lib/payload/queries` import block (keep `resolveArticleBySlug`, `getRelatedArticles`, `getArticles`).

- [ ] **Step 2: Remove the ISR exports**

Delete `export const revalidate = 3600;` and the entire `export async function generateStaticParams() { ... }` block. (A comment block documenting *why* the route stays dynamic is added in its place.)

- [ ] **Step 3: Build and confirm the route is dynamic**

Run: `pnpm build`
Expected: build succeeds (no TS/lint error for unused import); the route table shows
`ƒ /[locale]/articles/[slug]` (Dynamic), **not** `● (SSG)`. The build no longer prerenders hundreds of article pages.

- [ ] **Step 4: Smoke-test locally**

Run: `pnpm start -p 3100`, then request `/ar/articles/<an Arabic slug>` → expect `200`.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(frontend)/[locale]/articles/[slug]/page.tsx"
git commit -m "fix(articles): render detail route dynamically to stop Arabic-slug 500 on Vercel"
```

### Task 2: Ship and verify on production

- [ ] **Step 1:** Push branch `fix/article-isr-arabic-slug-500` and open a PR to `main` (main is PR-protected).
- [ ] **Step 2:** After merge + Vercel deploy, request the failing article `https://www.mfmsport.ma/ar/articles/نصير-مزراوي-...` → expect `200`.
- [ ] **Step 3:** Publish a brand-new test article in the admin and open it immediately → expect `200` (no 500), confirming new publishing works without a redeploy.

## Follow-ups (not in this fix)

- The article route loses per-page static caching. If the Morocco-latency perf win (memory: `project_perf_speed_insights`) is needed back, do it at the **data layer** (wrap Payload/API-Football reads in `unstable_cache`) while keeping the route dynamic — never reintroduce SSG/`generateStaticParams` on a non-ASCII path.
- `getAllArticleSlugs` in `src/lib/payload/queries.ts` is now unused; remove it in a cleanup pass if nothing else references it.
