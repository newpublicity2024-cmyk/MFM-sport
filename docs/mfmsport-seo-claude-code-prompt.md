# MFM Sport — SEO Remediation Brief for Claude Code

> **How to use this:** drop this file into the repo at `docs/seo-remediation.md`, then open Claude Code and paste the "Kickoff prompt" block below. Run Phase 0 in **Superpowers (planning)** mode before switching to **GSD (execution)** for Phases 1+. Do not let it run all phases in one autonomous loop — Phase 2 needs your sign-off on the redirect map before it ships.

---

## Kickoff prompt (paste this into Claude Code)

```
Read docs/seo-remediation.md in full before doing anything.

You are fixing a severe organic search collapse on mfmsport.ma, a Next.js
App Router site on Vercel. The site was migrated from WordPress and the
migration broke the domain's search identity. An external audit has already
diagnosed the root causes; they are documented in that file with evidence.

Work phase by phase. After each phase, stop, report what changed, and show
me the verification output before moving on. Do not start Phase N+1 until I
say go.

Start with Phase 0 (recon). In Phase 0 you write no application code — you
only investigate and report. Produce the findings table the phase asks for.

Constraints you must respect throughout are in the "Hard constraints"
section. The Vercel cost constraints in particular are non-negotiable —
this project has previously hit Fluid CPU, Function Invocation and Fast
Origin Transfer quota limits, and image optimization has returned 402s.
Any fix that increases per-request compute or origin egress must be
justified explicitly.
```

---

## Background: what is broken and why

The site publishes daily Arabic football journalism but does not rank. Three
compounding root causes, in order of damage:

### Root cause A — legacy URLs resolve to a `noindex` void

Old WordPress URLs are still indexed by Google. Requesting them produces:

| Legacy URL | Redirects to | Result |
|---|---|---|
| `/transfers/` | `/ar/transfers` | Empty page with `<meta name="robots" content="noindex">` |
| `/البرناكي-يرد-على-منتقديه/` | `/ar/<same slug>` | Empty page with `noindex` |
| `/most-viewed/page/440/` | `/ar/most-viewed/page/440` | Empty page with `noindex` |

Mechanism: middleware blanket-prepends the `/ar` locale to any incoming
path; the App Router finds no matching route; `not-found` renders carrying
`noindex`. Years of backlinks and Google News trust are being told to
forget the URL instead of being passed forward via 301.

`/most-viewed/page/440/` implies the WordPress site had **thousands** of
articles. The current Next.js archive paginates to 18 pages (~216 articles).
Most of the historical corpus is orphaned or was never migrated.

Corroborating signal: Google's cached title for the root domain is still the
**old French** title ("MFM Sport - Tout le sport, rien que le sport") while
the live site serves Arabic. Google has not reprocessed the domain.

### Root cause B — index bloat from auto-generated fixture pages

`site:mfmsport.ma` surfaces `/ar/matches/1464430` — Zwettl vs Schrems,
Austrian Landesliga Niederösterreich. Every fixture the API-Football pipeline
returns, in every league worldwide, generates a crawlable indexable URL with:

- no `meta description`
- no `og:` tags (present on other page types, absent here)
- no structured data
- roughly 25 words of visible text

Crawl budget is going to Austrian regional football instead of Botola coverage,
and the ratio of thin-to-substantive pages is degrading site-level quality signals.

### Root cause C — the article archive serves stale cache

Homepage and `/ar/articles` are served from **different Vercel deployments**:

- Homepage asset query string: `dpl_BccjG6mhnBXrRVgN2VkXu9fYiYdu` — newest article 27 July
- `/ar/articles` asset query string: `dpl_5uEosQWGuVa7m6xvgEy4ECAQLe2D` — newest article **12 June**

The archive — Google's primary crawl-discovery path for new articles — is six
weeks stale. This is almost certainly a side effect of the aggressive
`Cache-Control` / ISR strategy introduced to control Vercel quota consumption.
The fix must preserve the cost savings while adding a revalidation path.

### Secondary defects (confirmed on live site)

1. **Broken internal links** on `/ar/articles`:
   - `href="/ar/articles/فينورد يتعاقد مع الموهبة المغربية إليان حديدي حتى 2029 واللاعب يتعهد بفرض نفسه"` — raw unencoded spaces
   - `/ar/articles/الجيش-الملكي-يعلن-إصابة-الثنائي-الفحل` — truncated mid-word
   - `/ar/articles/إبراهيم-دياز-نملك-منتخباً-متوازناً-ون` — truncated mid-word
   - `/ar/articles/محمد-وهبي-يكشف-عن-اللائحة-الرسمية-لأسو` — truncated mid-word

   Suggests two divergent slug-generation code paths: one truncating at a fixed
   byte length, one not encoding.

2. **Site-wide identical meta description**, in English, on an Arabic site:
   `Moroccan Football News Portal`. Present on the homepage, `/ar/articles`,
   `/ar/legal`, everywhere. Match pages have no description at all.

3. **Category taxonomy fragmentation**:
   - `world-cup` / `world-cup-2026` / `world-cup-2026-competition`
   - `el-botola` / `botola-pro-1`
   - Display labels also inconsistent: "البطولة" / "البطولة الاحترافية" /
     "البطولة إنوي 1" / "البطولة الاحترافية 1"

4. **Untranslated i18n key rendering in the DOM**: the literal string
   `[mfm_sport_football_matches_program]` appears in the page and is showing
   verbatim in Google's search snippet.

5. **No structured data anywhere**: no `NewsArticle`, `Organization`,
   `WebSite`, `BreadcrumbList`, or `SportsEvent`.

6. **Duplicate DOM blocks**: article grids rendered twice (separate desktop
   and mobile variants both in the HTML).

7. **Image delivery**: full-size 1200×630 originals served from Vercel Blob
   and from `/api/media/file/...`, bypassing `next/image`. Likely deliberate
   after the 402s — treat as a constrained problem, not a simple fix.

8. **URL length**: Arabic slugs percent-encode to 400+ bytes.

9. **Redirect status codes unverified**: Next.js middleware `NextResponse.redirect`
   defaults to **307 temporary**. Locale redirects must be **308**; legacy
   content redirects must be **301**.

---

## Hard constraints

1. **Vercel cost.** This project has hit Fluid CPU, Function Invocation, and
   Fast Origin Transfer limits, and image optimization has returned 402. Any
   change that raises per-request compute, function invocations, or origin
   egress must be called out with an estimate before you implement it. Prefer
   static generation, `revalidateTag`/`revalidatePath` on publish, and edge
   caching over per-request work.
2. **The Supabase cache layer and tiered cron jobs for API-Football data stay.**
   Do not replace the caching architecture. Work within it.
3. **Never 301 a legacy URL to the homepage.** Google treats bulk
   redirect-to-homepage as a soft 404 and the equity is lost anyway. Map to
   the specific equivalent, or to the most relevant category hub, or return a
   genuine 410/404.
4. **Never `noindex` a page that currently ranks or receives traffic.** Check
   before adding directives.
5. **Arabic is the primary locale.** All user-facing SEO text — titles, meta
   descriptions, schema fields, alt text — must be Arabic. The current English
   boilerplate is a bug, not a choice.
6. **One phase per branch, one PR per phase.** No mega-PRs.
7. **Do not modify anything under Phase 2 (`redirect map`) without my explicit
   approval of the generated mapping file.**

---

## Phase 0 — Recon (no code)

Goal: replace my external-observer assumptions with ground truth from the repo.

Investigate and report:

1. **Routing and middleware**
   - Locate `middleware.ts`. Document exactly how locale prefixing works, what
     paths it matches, what status code it returns.
   - Confirm whether the `/ar` prefix is applied unconditionally to unmatched paths.
   - List all route segments under `app/`.

2. **Caching**
   - Find every `revalidate` export, `fetch` cache option, `Cache-Control`
     header (in `next.config`, `vercel.json`, route handlers, and middleware).
   - Specifically determine why `/ar/articles` is serving a six-week-old build.
     Is it ISR with no revalidation, a CDN header with a long `s-maxage` and no
     `stale-while-revalidate` trigger, or a static export?
   - Document what happens today when a new article is published. Is there any
     revalidation hook at all?

3. **`not-found` handling**
   - Locate the `not-found.tsx` files. Confirm the `noindex` directive and the
     HTTP status code actually returned (200 vs 404).

4. **Metadata**
   - Find the root `metadata` export and every `generateMetadata`. Identify
     where `"Moroccan Football News Portal"` is hardcoded.
   - Determine which page types have `generateMetadata` and which inherit root.
   - Check for `alternates.canonical` and `alternates.languages` — report presence
     or absence per page type.

5. **Slugs**
   - Find every slug-generation function. There are likely two. Report both,
     with the truncation length and the encoding behaviour of each.
   - Query Supabase: how many article rows exist, how many have slugs containing
     a literal space, and how many appear truncated (no trailing word boundary).

6. **Match pages**
   - Locate the `/[locale]/matches/[id]` route. Report whether it is SSG, ISR,
     or dynamic.
   - Query Supabase / the API-Football cache: how many distinct fixture IDs are
     reachable? How many leagues?
   - Determine whether a competition whitelist already exists anywhere in the codebase.

7. **Sitemaps and robots**
   - Is there `app/sitemap.ts` or a static `sitemap.xml`? `app/robots.ts` or
     `public/robots.txt`? Report contents.
   - Is there any news sitemap?

8. **i18n**
   - Find the translation loader and the key `mfm_sport_football_matches_program`.
     Explain why it renders unresolved.

9. **Taxonomy**
   - Query Supabase for the full list of categories with article counts per category.
     This determines the consolidation map in Phase 4.

10. **Legacy inventory availability**
    - Is there anything in the repo — a migration script, a mapping table, an
      old export — that links WordPress post IDs/slugs to current article records?
    - Check Supabase for any `legacy_slug`, `wp_id`, `old_url` style column.

**Deliverable:** a single markdown report at `docs/seo-recon-findings.md` with
one section per item above, each stating: what I assumed, what is actually
true, and what that changes about the plan. Flag any place where my brief is
wrong — I would rather be corrected than have you build to a false premise.

**Stop here and wait.**

---

## Phase 1 — Stop the bleeding

Four changes, each independently shippable. Highest value per hour in the project.

### 1.1 Restore archive freshness

- Add on-publish revalidation: when an article is created or updated, call
  `revalidatePath` / `revalidateTag` for the homepage, `/ar/articles`, the
  article's category page, and the article itself.
- Add a bounded `revalidate` on listing pages as a safety net (target 300s;
  justify if you choose otherwise given the quota constraint).
- If publishing happens outside Next.js (CMS, Supabase trigger), implement a
  secured revalidation route handler and document the webhook the CMS needs to call.

**Acceptance:** publish or touch a test article; `/ar/articles` reflects it
within the revalidation window. `curl -sI` on the archive shows a
`Cache-Control` with both `s-maxage` and `stale-while-revalidate`.

### 1.2 Contain match-page index bloat

- Introduce an explicit competition whitelist. Start with: Botola Pro 1,
  Botola Pro 2, CAF Champions League, CAF Confederation Cup, AFCON, World Cup,
  Premier League, La Liga, Serie A, Bundesliga, Ligue 1, UEFA Champions League,
  UEFA Europa League, plus any fixture involving the Morocco national team or
  a Moroccan club.
- Fixtures outside the whitelist: `robots: { index: false, follow: false }` in
  `generateMetadata`. Keep them reachable — do not 404 them, users may deep-link.
- Exclude non-whitelisted fixtures from the sitemap.
- While in this file, add the missing `og:` tags and a generated Arabic
  `description` for whitelisted match pages.

**Acceptance:** fetch a whitelisted fixture and a non-whitelisted one; confirm
the robots directive differs correctly. Sitemap contains only whitelisted fixtures.

### 1.3 Fix redirect status codes

- Audit every redirect in `middleware.ts` and `next.config`.
- Locale redirects (`/` → `/ar`): **308**.
- Any content redirect: **301**.
- Confirm no redirect chains longer than one hop.

**Acceptance:** `curl -sIL https://<preview-url>/ | grep -iE 'HTTP/|location'`
shows a single 308 to `/ar`.

### 1.4 Metadata baseline

- Remove the hardcoded English `"Moroccan Football News Portal"`.
- Root metadata: Arabic default title template and description.
- `generateMetadata` on article pages: title = headline, description = first
  ~155 chars of the article body (stripped), `og:image` = the article's own
  image, not the site-wide `opengraph-image.jpg`.
- Add `alternates.canonical` to every page type using the absolute production URL.
- Fix the `[mfm_sport_football_matches_program]` translation key.

**Acceptance:** three different page types return three different Arabic
descriptions and three different `og:image` values. No literal i18n key
appears in any rendered HTML.

**Stop, report, and wait.**

---

## Phase 2 — Legacy redirect map (needs my approval)

This is where the recoverable value is. Treat it as data engineering, not
feature work.

### 2.1 Build the legacy URL inventory

Assemble from every available source and deduplicate:

- Google Search Console → Pages export (all URLs, indexed and excluded)
- Ahrefs → referring domains and top pages export for mfmsport.ma
  (**this list is the priority order** — redirect linked pages first)
- Old WordPress database or export, if reachable
- The old `sitemap.xml`, if any archived copy exists
- Server/CDN logs for 404s over the last 90 days

Produce `data/legacy-urls.csv` with columns:
`old_url, source, referring_domains, last_seen, http_status_today`.

### 2.2 Generate the mapping

Produce `data/redirect-map.csv` with columns:
`old_url, new_url, match_type, confidence, notes`

Matching strategy, in order:
1. **Exact** — a `legacy_slug`/`wp_id` column exists in Supabase (check Phase 0 item 10)
2. **Slug normalisation** — decode percent-encoding, normalise Arabic
   (alef variants ا/أ/إ/آ, taa marbuta ة/ه, yaa ى/ي, strip tashkeel and tatweel),
   then exact match against current article slugs
3. **Fuzzy title match** — normalised Levenshtein or token-set ratio against
   article titles; flag anything under 0.85 as low confidence
4. **Category fallback** — no article match; map to the most relevant category hub
5. **410 Gone** — genuinely dead sections with no equivalent and no inbound links

Report the distribution across the five buckets. If bucket 4 exceeds roughly
20% of URLs that have referring domains, say so loudly — that means Phase 3
(content re-import) should come first.

### 2.3 Fix the not-found path

- Middleware must not blanket-prepend `/ar` to unmatched paths and land them on
  a `noindex` page. Legacy paths should be checked against the redirect map
  **before** locale prefixing.
- Genuine 404s must return HTTP 404, not 200.
- The `noindex` on `not-found` is correct and stays — the bug is which URLs reach it.

### 2.4 Implement

- For volume, implement lookups in middleware backed by a static generated map
  (a build-time JSON/edge-config lookup, not a per-request DB query — remember
  the invocation quota).
- If the map exceeds what's practical for middleware, split: high-value URLs
  (any with referring domains) in the fast path, long tail via a Supabase
  lookup with aggressive caching.

**Acceptance:** a sample of 20 legacy URLs across all five buckets, each
`curl -sIL`'d, returning the intended status and destination in one hop.

**Stop. Show me `redirect-map.csv` before shipping.**

---

## Phase 3 — Content re-import

Only meaningful if the WordPress corpus is reachable. Phase 0 item 10 decides this.

- Import historical articles into Supabase preserving: original publish date,
  author, category, body, featured image, and **original slug in a `legacy_slug`
  column**.
- Backfilling `legacy_slug` retroactively upgrades large parts of the Phase 2
  map from fuzzy to exact — re-run the mapping after import.
- Do not backdate `dateModified` in schema; use the true original `datePublished`.
- Import in batches, verify counts against source, report the delta.

**Acceptance:** archive article count matches the source export within 1%.
Redirect map regenerated with a materially higher exact-match share.

---

## Phase 4 — Structure and taxonomy

### 4.1 Slug generator

- Consolidate to a single slug function. Requirements: proper URI encoding,
  no truncation mid-word (truncate at the last word boundary under the limit),
  stable output for the same input, collision handling via numeric suffix.
- Backfill broken slugs in Supabase. **Every changed slug needs a 301 from the
  old one** — add them to the redirect map, do not silently rename.

### 4.2 Category consolidation

Using the Phase 0 item 9 counts, pick one canonical category per topic:
- `world-cup` + `world-cup-2026` + `world-cup-2026-competition` → one
- `el-botola` + `botola-pro-1` → one
- Normalise the Arabic display labels to a single string per category

Reassign articles, 301 the retired category URLs to the survivor.

### 4.3 Structured data

- `NewsArticle` on articles: `headline`, `datePublished`, `dateModified`,
  `author`, `image`, `publisher` (with logo), `inLanguage: "ar"`, `articleSection`
- `Organization` + `WebSite` in the root layout
- `BreadcrumbList` on articles, categories, match pages
- `SportsEvent` on whitelisted match pages
- Validate every type against Google's Rich Results Test before opening the PR

### 4.4 Sitemaps

- `app/sitemap.ts` generating: homepage, all articles, all category hubs,
  whitelisted match pages, static pages. Accurate `lastmod` from the DB.
- A separate **Google News sitemap** at `/news-sitemap.xml` containing only
  articles published in the last 48 hours, with the `news:` namespace fields.
  Regenerate on publish via the Phase 1.1 revalidation hook.
- `app/robots.ts` referencing both sitemaps.

**Acceptance:** both sitemaps validate. Rich Results Test passes clean on one
article, one category, one match page.

---

## Phase 5 — Growth surfaces

Build only after Phases 1–4 are shipped and verified.

### 5.1 Club hub pages

Route: `/ar/clubs/[slug]`. One per Botola Pro 1 and Pro 2 side. Each contains:
squad, upcoming fixtures, recent results, current coach, and a live feed of
tagged articles. All data already flows through the API-Football pipeline.

**Rationale:** the large clubs (Wydad, Raja) are contested by elbotola and
Le360. The smaller ones — Maghreb de Fès, Kawkab Marrakech, Ittihad Tanger,
Meknès, FUS — have thin competition and you already publish about them daily.
This is the winnable corner of the SERP.

Every article mentioning a club must link to its hub. Every hub links back to
its latest articles. That internal link graph is what accumulates authority.

### 5.2 Evergreen stats pages

- `/ar/botola/standings` — live table
- `/ar/botola/scorers` — top scorers
- `/ar/botola/fixtures` — full calendar

High, stable, recurring search volume. Data already cached in Supabase.
Statically generate with scheduled revalidation aligned to the existing cron tiers.

### 5.3 Programme pages

`الشوط الثالث` and `من الملاعب الرياضية` are your own brands with zero
competition, and currently only exist as YouTube embeds on the homepage. Give
each a permanent page with episode archive, description, and schedule.

### 5.4 Homepage weight reduction

The homepage renders 100+ fixture links against roughly five article headlines.
Collapse fixtures behind a tab or lazy-load boundary, elevate editorial content.
Improves LCP and the content-to-boilerplate ratio. Measure before and after.

---

## Reporting format

After each phase, output:

1. **Changed** — files touched, one line each on why
2. **Verification** — the actual command output proving the acceptance criteria
3. **Cost impact** — expected change in function invocations, compute, and
   origin egress; flag any increase
4. **Corrections** — anything in this brief that turned out to be wrong
5. **Next** — what Phase N+1 now looks like given what you learned

---

## Things I want you to push back on

I wrote this brief from outside the codebase. If any of the following are true,
tell me rather than working around them:

- The caching problem has a different cause than stale ISR
- The legacy URL inventory is not recoverable, making Phase 2 partly guesswork
- The competition whitelist for match pages should be broader or narrower
- Middleware redirect lookups will blow the invocation budget at this map size
- Phase ordering is wrong given what the repo actually looks like
