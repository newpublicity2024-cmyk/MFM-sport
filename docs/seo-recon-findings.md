# MFM Sport — Phase 0 Recon Findings

**Date:** 28 July 2026
**Method:** repo inspection + live production queries (`curl` against `www.mfmsport.ma`) + direct SQL against the production Neon database.
**Status:** no application code changed. Investigation only.

---

## Headline: the brief is wrong about its three root causes, in ways that change the plan

The audit was written from outside the stack. Three of its central claims do not survive contact with the repo and the live site. Two of its "critical, multi-day" items are already done or were never broken. But the single most damaging defect — one the audit half-saw and misdiagnosed — is **not in its action plan at all**, and the recoverable upside is far larger than it estimated.

**Two findings dominate everything else:**

- **Every unmatched URL returns HTTP 200 with `noindex`** (§1.1). Not a 404. A 200 + `noindex` tells Google the URL is alive and deliberately hidden — so it stays in the crawl set forever and passes nothing forward. This is strictly worse than the "noindex void" the audit described, and it is absent from the remediation plan.
- **The WordPress export sitting in the repo root contains 37,407 posts** (§9.1). The live site has 394. The redirect map covers 200. Roughly 37,000 historical URLs — a decade of backlinks — are currently landing on that soft-404 page.

Those two compound into the entire ranking collapse, and both are fixable with work that is already scaffolded in this repo.

| Audit claim | Ground truth | Verdict |
|---|---|---|
| Backend is **Supabase** | **Payload CMS on Neon Postgres** (Frankfurt). No Supabase anywhere. | Wrong throughout |
| "**No 301 map exists**" | A redirect system exists and works: `redirects` collection, `/api/redirects`, middleware lookup. **200 rows, all 301.** | Wrong |
| Archive "**six weeks stale**" | `/ar/articles` served the 27 July article on request. ISR healthy. | Wrong / already fixed |
| Legacy URLs land on `noindex` | `noindex` confirmed — **but the page returns HTTP 200, not 404** | Right symptom, wrong (and worse) cause |
| ~216 articles | **394 published** | Wrong |
| Slug generator broken, two paths | One genuinely broken slug in the whole DB | Overstated |
| `[mfm_sport_football_matches_program]` renders in DOM | Not in the codebase, not in the live DOM | Wrong |
| No structured data | Confirmed — zero `ld+json` sitewide | Correct |
| Match pages thin + indexable | Confirmed | Correct |
| English meta description sitewide | Confirmed (articles excepted) | Correct |
| Locale redirect is 307 | Confirmed | Correct |

---

## 1. Routing and middleware

`src/middleware.ts` is more sophisticated than the audit assumed. It does **not** blanket-prepend `/ar`:

1. `/admin` and `/api` pass through untouched.
2. `/fr/*` and `/en/*` → **301** to `/ar/*` (site is Arabic-only since PR #43).
3. Anything that isn't a known prefix and has no dot is treated as a **legacy candidate** and looked up against `/api/redirects` — a real redirect map, cached on the CDN for 24 h (`s-maxage=86400, stale-while-revalidate=604800`) so repeat hits don't re-invoke the function.
4. Only if no redirect matches does it fall through to `next-intl` locale routing.

**Route segments** under `src/app/(frontend)/[locale]/`: `about`, `articles` (+ `page/[n]`, `[slug]`), `author/[slug]`, `category/[slug]`, `club/[slug]`, `competition/[slug]`, `contact`, `feed.xml`, `legal`, `matches` (+ `[id]`), `newsletter`, `privacy`, `search`, `tag/[slug]`, `unsubscribe`, `videos`, `[...rest]`.

### 1.1 The actual critical bug: soft 404s

Every unmatched URL returns **HTTP 200** with a `noindex` meta tag:

```
/ar/transfers                     final=200
/ar/this-page-does-not-exist-xyz  final=200
/most-viewed/page/440/            final=200  (after 2 redirects)
```

`[...rest]/page.tsx` calls `notFound()`, and `not-found.tsx` contains no `noindex` — Next.js injects that automatically. The directive is correct behaviour for a 404. **The status code is the bug.** Because these pages are prerendered, Next serves them as static 200s.

Why this is worse than the audit's framing: a 404 tells Google "gone, drop it, release the link equity." A **200 + noindex** tells Google "this URL is alive and I am choosing to hide it." The URL stays in the crawl set, keeps consuming crawl budget, and passes nothing forward. This is a soft 404 at scale, and it is not in the audit's action plan.

### 1.2 Redirect chain and status codes

```
https://www.mfmsport.ma/transfers/
  → 308 → /transfers
  → 307 → /ar/transfers      ← TEMPORARY. must be 308.
  → 200 OK                    ← must be 404.
```

The `307` comes from `next-intl`'s default `NextResponse.redirect`. The audit flagged this correctly.

---

## 2. Caching — root cause C is not real

Every listing route already exports a bounded `revalidate`: homepage 300 s, `/ar/articles` 3600 s, category/tag/author 3600 s, match pages 60 s, competition 120 s, sitemap 86400 s.

Live headers on `/ar/articles`:

```
Cache-Control: public, max-age=0, must-revalidate
X-Nextjs-Prerender: 1
X-Nextjs-Stale-Time: 300
X-Vercel-Cache: HIT
Age: 1719
```

And the page is serving the **27 July** Fath Riyadi / Formosinho article — the exact story the audit said was missing. The two different `dpl_` hashes the audit observed are normal: an ISR page cached from an earlier deployment still carries that build's asset query string. It indicates cache age, not staleness of content.

`REVALIDATION_SECRET` and `/api/revalidate` already exist for on-publish busting.

**Phase 1.1 as written is unnecessary.** Worth adding: `revalidateTag` on article publish so the archive updates in seconds rather than up to an hour. That is a nice-to-have, not a critical fix.

---

## 3. Metadata

Root (`src/app/(frontend)/layout.tsx:33`) hardcodes `description: "Moroccan Football News Portal"` — English, on an Arabic site. Confirmed live on the homepage, `/ar/transfers`, and match pages.

**Article pages are already correct** and the audit missed this: Arabic title, excerpt as description, `alternates.canonical`, hreflang, per-article `og:image`. Phase 1.4's article work is largely done.

### 3.1 New finding — canonicals point at a redirecting host

`NEXT_PUBLIC_SITE_URL` resolves to the **apex** `https://mfmsport.ma`, but production serves on `https://www.mfmsport.ma` and the apex **308s to www**. So every canonical on the site points to a URL that immediately redirects:

```
<link rel="canonical" href="https://mfmsport.ma/ar/articles/..."/>
   served from https://www.mfmsport.ma/...
```

Google usually resolves this, but it is a sitewide self-inflicted ambiguity about which host is canonical — on a domain whose identity is already in question. One env-var change fixes every page at once. Cheapest high-value fix in this report.

Canonical coverage elsewhere: **articles only**. Homepage, category, tag, author, match, club, competition, and static pages have none.

---

## 4. Slugs — the audit overstated this considerably

Two slug functions exist, and both are correct:

- `titleToSlug` (`src/lib/payload/slugFromTitle.ts`) — Unicode-aware, keeps Arabic, collision suffixes. **No truncation.**
- `slugify` (`src/lib/payload/slugify.ts`) — ASCII-only, used for Latin taxonomy terms.

The WP migration script does not truncate either; it uses `decodeSlug(wpPost.slug)`.

Measured in production:

| Metric | Value |
|---|---|
| Published articles | **394** |
| Slugs containing a literal space | **1** |
| Max slug length | 113 chars |
| Slugs near a 200-char truncation boundary | 0 |

The "truncated mid-word" slugs the audit saw are **inherited from WordPress**, which truncates `post_name`. They are ugly but internally consistent: the stored slug, the link on `/ar/articles`, and the redirect target all agree, so the links resolve. They are not broken.

Genuinely broken: **one** article, `فينورد يتعاقد مع...` (spaces in slug). A one-row fix plus a redirect, not a backfill project.

---

## 5. Match pages — confirmed, with one correction

`/ar/matches/[id]` is ISR (`revalidate = 60`). `generateMetadata` returns **title only**. Live check of the Austrian fixture the audit cited:

```
<title>زويتل vs شريمس | MFM Sport</title>
<meta name="description" content="Moroccan Football News Portal"/>   ← inherited English
<meta property="og:image" content=".../opengraph-image.jpg"/>        ← generic sitewide
```

No robots directive, no `SportsEvent` schema. Any fixture ID in API-Football renders an indexable page. **No competition whitelist exists** anywhere in the codebase.

**Correction:** match pages are **not** in `sitemap.ts` — it emits articles, categories, tags, authors, competitions, clubs and static pages only. So Google found `/ar/matches/1464430` by crawling internal links (the homepage renders 100+ fixture links), not via the sitemap. Phase 1.2's "exclude from sitemap" step is a no-op; the fix must be `robots: noindex` plus reducing internal linking to non-relevant fixtures.

---

## 6. Sitemaps and robots

Both exist and return 200. `app/sitemap.ts` correctly emits `/ar` only, skips untranslated locales, and caches for a day. `app/robots.ts` allows all, disallows `/admin/`, `/api/`, `/_next/`, and references `/sitemap.xml`.

Both inherit the **apex-vs-www** problem from §3.1. **No news sitemap exists.**

---

## 7. i18n — audit claim not reproducible

`mfm_sport_football_matches_program` appears **nowhere** in `src/`, `messages/`, or `translations/`, and does not appear in the live homepage DOM. Most likely the audit saw it in a stale Google **snippet** cached from the old WordPress site — which is itself corroborating evidence that Google has not reprocessed the domain. Nothing to fix in code.

---

## 8. Taxonomy — confirmed, and messier than described

394 published articles across 21 categories:

| Slug | Name | Articles |
|---|---|---|
| `botola-pro-1` | البطولة الاحترافية 1 | 155 |
| `world-cup` | كأس العالم 2026 | 130 |
| `africa-cup-of-nations` | كأس إفريقيا | 27 |
| `ligue-des-champions-de-la-caf` | دوري أبطال أفريقيا | 21 |
| `el-botola` | البطولة | 12 |
| `europe` | أوروبا | 8 |
| `la-coupe-du-trone` | كأس العرش المغربي | 7 |
| `دوري روشن السعودي ` | دوري روشن السعودي | 5 |
| `laliga-santander` | الدوري الاسباني الدرجة الأولى | 5 |
| `الدوري الإسباني ` | الدوري الإسباني | 4 |
| …11 more with ≤3 each | | |

Two problems, one of which the audit missed:

1. **Duplicates**, as flagged: `el-botola` (12) vs `botola-pro-1` (155); `laliga-santander` (5) vs `الدوري الإسباني ` (4). The `world-cup-2026` / `world-cup-2026-competition` variants the audit listed are **competitions**, not categories — different route, no duplicate archive.
2. **Not flagged: five categories have raw Arabic slugs with a trailing space** — `'دوري روشن السعودي '`, `'الدوري الإسباني '`, `'الدوري القطري '`, `'البطولة الاحترافية 2'`, `'الدوري التركي '`. These percent-encode into long URLs ending in `%20`. Worse URLs than any article slug the audit complained about.

---

## 9. Legacy inventory — better than the audit assumed

- The `redirects` collection holds **200 rows**, all `301`, mapping percent-encoded WP paths → `/ar/articles/<slug>`.
- `mfmsport.WordPress.2026-04-24.xml` — the **full WordPress export** — is in the repo root.
- `WP_API_URL=https://mfmsport.ma/wp-json/wp/v2` is configured, and `scripts/migrate-wp.ts` is idempotent with skip-by-slug.
- There is **no** `legacy_slug` / `wp_id` column on articles; the mapping lives only in `redirects`.

The migration was **capped at 200 articles** deliberately. So the corpus gap is real, but it is a *resumable import*, not a recovery project — the source is on disk. The audit's "multi-day, needs old DB access" framing is too pessimistic.

### 9.1 The biggest finding in this report

The WordPress export in the repo root is **646 MB** and contains **37,407 posts**.

```
$ grep -c "<wp:post_type><!\[CDATA\[post\]\]></wp:post_type>" mfmsport.WordPress.2026-04-24.xml
37407
```

This independently confirms the audit's inference from `/most-viewed/page/440/` — 440 pages at ~85 posts each ≈ 37k. It reframes everything:

- **The content gap is 394 vs 37,407 — roughly 1%.** The site is not "a fraction of the competition's"; it is a rounding error against its *own* archive.
- **The redirect map covers 200 of ~37,407 legacy URLs — about 0.5%.** The system works; it is just barely populated. Root cause A is real after all, but the fix is *running the importer*, not building infrastructure.
- **Every unmigrated legacy URL currently hits the §1.1 soft-404 path**: HTTP 200 + `noindex`. Roughly 37,000 URLs, many with backlinks and a decade of accumulated trust, are telling Google "alive, but forget me."

That last point is the whole story. The two defects compound: an under-populated redirect map is survivable if misses 404 cleanly, and soft 404s are survivable if there is nothing behind them. Together they convert the entire historical archive into a slow leak of link equity.

**This also settles the Phase 2 architecture question the brief asked me to push back on.** A build-time static JSON map of 37k entries is roughly 5 MB — over Vercel's edge middleware bundle limit. The existing DB-lookup-plus-CDN-cache design is the right one and should stay; it already caches misses as aggressively as hits. Do not rebuild it as an edge map.

---

## What I'd change about the plan

**Phase 1 should be reordered and mostly shrunk.** The highest-value fixes are small and were under-weighted or absent:

1. **Return real 404s** for unmatched routes (currently 200 + noindex). Absent from the brief; most damaging single defect.
2. **Point `NEXT_PUBLIC_SITE_URL` at `www`.** One env var; fixes every canonical and both sitemaps.
3. **Locale redirect 307 → 308.**
4. **Arabic root meta description** + canonical on non-article page types.
5. **`noindex` non-whitelisted match pages** + Arabic description/OG on the whitelisted ones.
6. **`NewsArticle` / `Organization` / `WebSite` schema** — genuinely absent, as the audit said.

**Drop or shrink:** Phase 1.1 (archive freshness — not broken), the slug backfill (one row), the i18n fix (nothing to fix).

**Phase 2 and Phase 3 should merge, and they are the whole project.** With 37,407 posts on disk (§9.1), the redirect map and the content re-import are the same job: every post you import produces both an article *and* an exact-match redirect from its original WP slug — no fuzzy matching, no Levenshtein, no confidence buckets. The brief's elaborate five-bucket matching strategy is only needed for URLs that are *not* in the export (taxonomy pages, pagination, attachments).

Keep the existing DB-backed redirect lookup. Do not rebuild it as an edge map (§9.1).

**Revised ordering I'd recommend:**

1. **Phase 1a — soft-404 fix + `www` canonical + 308.** Hours of work. Must land *before* the import, so the ~37k URLs that are still missing fail cleanly while the import runs.
2. **Phase 1b — metadata, match-page whitelist, schema.** Independent, shippable in parallel.
3. **Phase 2/3 merged — resume the WP import in batches**, writing `legacy_slug` this time so the mapping is exact and re-runnable. This is where essentially all the recoverable value sits.
4. **Phase 4 — taxonomy consolidation**, including the five trailing-space slugs.
5. **Phase 5 — growth surfaces**, unchanged.

Prioritise the import order by the Ahrefs referring-domains export when you can get it: import linked pages first so equity starts flowing sooner.

---

## Things I still need from you

1. **Google Search Console access** — indexed vs excluded counts, and the "Crawled – currently not indexed" bucket. I expect the soft-404 finding to show up there as a large "Duplicate, Google chose different canonical" or "Soft 404" group. This is the single most useful thing you can give me.
2. **Ahrefs export** — referring domains by URL, to prioritise which legacy URLs get redirected first. (The Ahrefs MCP connector is not authorised in this session; you'd need to authorise it in your claude.ai connector settings, or paste an export.)
3. **Google Publisher Center status** — is MFM Sport still an approved news source? If the migration dropped it, that alone explains losing Top Stories, and no amount of on-page work substitutes.
4. **Decision:** confirm the match-page whitelist. My proposal — Botola Pro 1 & 2, CAF Champions League, CAF Confederation Cup, AFCON, World Cup, the big five European leagues, UCL/UEL, plus any fixture involving a Moroccan club or the national team.

---

## Verification commands used

```bash
# Redirect chain + status
curl -sIL https://www.mfmsport.ma/transfers/ | grep -iE '^HTTP/|^location:'

# Soft-404 proof
curl -s -o /dev/null -w "%{http_code}\n" -L https://www.mfmsport.ma/ar/this-page-does-not-exist-xyz

# Meta inspection
curl -s https://www.mfmsport.ma/ar/matches/1464430 | grep -oiE '<meta name="(robots|description)"[^>]*>'

# Structured data count
curl -s https://www.mfmsport.ma/ar | grep -c 'application/ld+json'
```

Database figures come from direct SQL against the production Neon instance via `DATABASE_URL`.
