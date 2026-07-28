# MFM Sport — SEO Audit

**Domain:** mfmsport.ma (Next.js on Vercel)
**Date:** 28 July 2026
**Method:** live crawl of homepage, article archive, match page, and legacy URLs + inspection of what is currently in Google's index. Ahrefs data not pulled (see *Data gaps* at the end).

---

## Executive summary

The site is technically alive and publishing daily, but it is effectively invisible in search for three compounding reasons:

1. **The WordPress → Next.js migration destroyed the domain's search history.** Every legacy URL I tested resolves to an empty page carrying `robots: noindex`. Years of accumulated authority, backlinks and Google News trust are being dumped into a void instead of being passed forward with 301s. This is the single biggest cause.
2. **The index is flooded with worthless pages.** Auto-generated match pages (Austrian 5th-tier fixtures, etc.) are indexed and rank ahead of your journalism in `site:` queries. Google is spending its crawl budget on these instead of your articles.
3. **The content library is a fraction of the competition's.** The archive holds roughly 200 articles. elbotola, Le360 Sport and Al Mountakhab publish that volume in a couple of weeks and have a decade of depth behind them.

**Overall assessment: critical issues.** These are fixable, and the first one is largely a redirect-map exercise — high effort but mechanical, and it is where nearly all the recoverable value sits.

---

## Part 1 — Why the site isn't ranking

### 1.1 Legacy URLs are being funnelled into a noindex page (CRITICAL)

Old WordPress URLs are still in Google's index. Here's what happens when they're requested:

| Legacy URL | Redirects to | What's served |
|---|---|---|
| `mfmsport.ma/transfers/` | `/ar/transfers` | Empty page, `<meta name="robots" content="noindex">` |
| `mfmsport.ma/البرناكي-يرد-على-منتقديه/` | `/ar/البرناكي-يرد-على-منتقديه` | Empty page, `noindex` |
| `mfmsport.ma/most-viewed/page/440/` | (same pattern) | Empty page, `noindex` |

What's happening: middleware blanket-prepends the `/ar` locale to *any* incoming path, the App Router then finds no match, and the not-found page renders with `noindex`. So instead of a clean 404 or — far better — a 301 to the equivalent new page, Google sees a redirect that lands on a page explicitly telling it to forget the URL.

The `/most-viewed/page/440/` URL is significant on its own: page 440 of a paginated archive implies the old site had **thousands** of articles. That entire corpus is now orphaned.

Confirming evidence: Google's cached entry for the root domain still shows the **old French title** ("MFM Sport - Tout le sport, rien que le sport") while the live site serves an Arabic title. Google has not properly reprocessed the domain.

### 1.2 Index bloat from auto-generated match pages (CRITICAL)

A `site:mfmsport.ma` query returns `/ar/matches/1464430` — **Zwettl vs Schrems, Austrian Landesliga Niederösterreich** — as one of the top indexed pages.

That page contains: two team logos, a score, a date, a stadium name. No meta description. No Open Graph tags. No structured data. Perhaps 25 words of text.

You are pulling the full API-Football fixture list, and every fixture in every league worldwide is generating a crawlable, indexable URL. That's plausibly tens of thousands of near-empty pages. Two consequences:

- **Crawl budget** goes to Austrian regional football instead of your Botola coverage.
- **Site-level quality signals** degrade. Google's assessment of a domain factors in the proportion of thin pages, and yours is overwhelmingly thin.

### 1.3 The article archive is serving stale cache (CRITICAL)

The homepage and `/ar/articles` are served from **different Vercel deployments**:

- Homepage assets: `dpl_BccjG6mhnBXrRVgN2VkXu9fYiYdu` — newest article 27 July
- `/ar/articles` assets: `dpl_5uEosQWGuVa7m6xvgEy4ECAQLe2D` — newest article **12 June**

The archive page — the main crawl path Google uses to discover articles — is six weeks stale. New articles are not being surfaced to crawlers through it.

This is very likely a side effect of the aggressive `Cache-Control` headers added to control Vercel Fluid CPU and invocation costs. The caching strategy needs a revalidation path for listing pages, or new articles will keep going undiscovered until a sitemap or Google News feed picks them up.

### 1.4 Content volume vs. the field

The archive paginates to 18 pages at ~12 articles each ≈ **~216 articles total**.

I checked a story you published on 27 July (Fath Riyadi hiring Ricardo Formosinho). For that query the results were elbotola.com, Le360 Sport, Al Mountakhab and Le12.ma — all covering the same news the same day. MFM Sport appeared nowhere.

You are competing for identical, commoditised transfer/announcement news against domains with far more authority and 10–100× the content. Winning that fight on volume alone isn't realistic in the short term (see *Content strategy* below).

---

## Part 2 — Technical SEO

| Check | Status | Details |
|---|---|---|
| HTTPS | Pass | Clean, no mixed content observed |
| Legacy URL redirects | **Fail** | 100% of tested legacy URLs land on a `noindex` empty page. No 301 map exists. |
| Index bloat | **Fail** | Global fixture pages indexed; thin, no metadata, no schema |
| Meta descriptions | **Fail** | Site-wide identical: "Moroccan Football News Portal" — **in English, on an Arabic site**. Match pages have none at all. |
| Structured data | **Fail** | No `NewsArticle`, `Organization`, `WebSite`, `BreadcrumbList`, or `SportsEvent` schema found on any page type |
| Listing page freshness | **Fail** | `/ar/articles` six weeks behind homepage (stale deployment cache) |
| Internal links | **Fail** | Broken slugs found on `/ar/articles` — see 2.1 |
| Category taxonomy | **Fail** | Fragmented duplicates — see 2.2 |
| URL length | Warning | Arabic slugs percent-encode to 400+ bytes. One article URL was long enough that my fetch tool refused it. |
| Title tags | Pass | Present and unique per page type (`جميع المقالات \| MFM Sport`, `زويتل vs شريمس \| MFM Sport`) |
| Content-to-boilerplate ratio | Warning | Homepage renders 100+ match result links vs ~5 article headlines |
| Duplicate DOM blocks | Warning | Article grids rendered twice (desktop + mobile variants) |
| Image optimisation | Warning | Full-size 1200×630 originals served from Vercel Blob and `/api/media/file/` — bypassing `next/image` |
| i18n integrity | **Fail** | Untranslated key `[mfm_sport_football_matches_program]` renders in the DOM and appears verbatim in Google's snippet |
| robots.txt / sitemap.xml | Unverified | Could not fetch — verify manually |
| Canonical / hreflang | Unverified | Not visible through extraction — verify manually |
| Redirect status codes | Unverified | Vercel middleware defaults to **307 (temporary)**. Must be **308/301**. Verify. |

### 2.1 Broken internal links

On `/ar/articles`:

```
/ar/articles/فينورد يتعاقد مع الموهبة المغربية إليان حديدي حتى 2029 واللاعب يتعهد بفرض نفسه
                    ↑ raw unencoded spaces in the href
```

```
/ar/articles/الجيش-الملكي-يعلن-إصابة-الثنائي-الفحل     ← truncated mid-word
/ar/articles/إبراهيم-دياز-نملك-منتخباً-متوازناً-ون      ← truncated mid-word
/ar/articles/محمد-وهبي-يكشف-عن-اللائحة-الرسمية-لأسو   ← truncated mid-word
```

There appear to be **two slug-generation code paths** — one truncating at a fixed byte length, one not encoding at all. Fix the generator, then backfill.

### 2.2 Category fragmentation

Overlapping categories for the same topic:

- `world-cup` / `world-cup-2026` / `world-cup-2026-competition`
- `el-botola` / `botola-pro-1`
- Display names also inconsistent: "البطولة" / "البطولة الاحترافية" / "البطولة إنوي 1" / "البطولة الاحترافية 1"

Each split creates a near-duplicate archive page and divides topical authority across URLs that should be one.

### 2.3 Match pages, specifically

`/ar/matches/1464430` returned:
- No `meta description`
- No `og:` tags at all (they're present elsewhere on the site)
- No `SportsEvent` schema
- Title only: `زويتل vs شريمس | MFM Sport`

If you keep these pages, they need to earn indexation. If you don't, they need to stop being indexed.

---

## Part 3 — Competitive landscape

| Dimension | mfmsport.ma | elbotola.com | ar.sport.le360.ma | almountakhab.com |
|---|---|---|---|---|
| Est. article count | ~216 | Very high (10+ yrs) | Very high | Very high |
| URL structure | 400-byte Arabic slugs | `/article/2026-07-27-20-28-873.html` | Short paths | `/node/13228656` |
| Ranks for same-day Botola news | No | **Yes** | **Yes** | **Yes** |
| Publishing cadence | ~1–5/day | High | High | High |
| Domain history intact | **No** (migration broke it) | Yes | Yes | Yes |

Note the URL patterns: every competitor uses short, ASCII, stable identifiers. None of them percent-encode Arabic into the path. This isn't the reason they outrank you, but it's evidence of a more mature technical setup — and worth copying.

---

## Part 4 — Keyword opportunities

Volume estimates are directional (no Ahrefs pull — see *Data gaps*). Difficulty reflects the Moroccan/Arabic football SERP.

| Keyword | Difficulty | Opportunity | Intent | Recommended format |
|---|---|---|---|---|
| ترتيب البطولة الاحترافية | Moderate | **High** | Informational | Live standings page, auto-updating, schema |
| نتائج البطولة الاحترافية اليوم | Moderate | **High** | Informational | Live results hub |
| برنامج مباريات الوداد الرياضي | Easy | **High** | Informational | Club fixture page |
| برنامج مباريات الرجاء الرياضي | Easy | **High** | Informational | Club fixture page |
| المنتخب المغربي مباراة اليوم | Hard | **High** | Informational | National team hub |
| هدافي البطولة الاحترافية | Easy | **High** | Informational | Top scorers table |
| انتقالات البطولة الاحترافية 2026 | Moderate | **High** | Informational | Live transfer tracker (revive `/transfers`) |
| تشكيلة الوداد اليوم | Easy | **High** | Informational | Pre-match lineup post |
| مباريات اليوم بث مباشر | Hard | Medium | Navigational | Daily fixtures page |
| ترتيب هدافي كأس أمم إفريقيا | Moderate | Medium | Informational | Tournament stats hub |
| أخبار الجيش الملكي | Easy | Medium | Informational | Club tag page |
| أخبار المغرب الفاسي | Easy | **High** | Informational | Club tag page (low competition) |
| أخبار الكوكب المراكشي | Easy | **High** | Informational | Club tag page (low competition) |
| اتحاد طنجة أخبار | Easy | **High** | Informational | Club tag page |
| النادي المكناسي | Easy | **High** | Informational | Club tag page |
| مواعيد مباريات كأس أمم إفريقيا | Moderate | Medium | Informational | Calendar page |
| من هو مدرب [club] | Easy | Medium | Informational | Club profile page |
| تصنيف الفيفا للمنتخبات | Moderate | Medium | Informational | Rankings page |
| برنامج الشوط الثالث | Easy | **High** | Navigational | Show page — you own this brand, claim it |
| من الملاعب الرياضية MFM | Easy | **High** | Navigational | Show page — you own this brand |

**The strategic read:** you cannot beat elbotola on "الوداد" or "الرجاء" today. You *can* own the **smaller Botola clubs** — Maghreb de Fès, Kawkab Marrakech, Ittihad Tanger, Meknès — where competition is thin and you're already publishing the content. Build permanent club hub pages, funnel every article into them, and you'll accumulate authority in a corner of the SERP nobody is defending.

You should also own your **own programme names** (الشوط الثالث، من الملاعب الرياضية). Those are branded queries with zero competition, and right now the YouTube embeds on the homepage are the only thing representing them.

---

## Part 5 — Prioritised action plan

### Quick wins (this week)

| # | Action | Impact | Effort |
|---|---|---|---|
| 1 | Fix the site-wide meta description. Make it Arabic and make it per-page (article excerpt for articles, generated string for match pages). | High | 1–2 h |
| 2 | Verify redirect status codes. Vercel middleware defaults to 307; force **308** for locale redirects. | High | 30 min |
| 3 | Fix the slug generator — encode spaces, stop truncating mid-word. Backfill affected articles. | High | 2–3 h |
| 4 | Fix the untranslated `[mfm_sport_football_matches_program]` i18n key. | Medium | 15 min |
| 5 | Add `noindex` to match pages outside a whitelist of relevant competitions (Botola, CAF, national team, top-5 European leagues, World Cup, AFCON). | **Critical** | 1–2 h |
| 6 | Add `NewsArticle` schema to article pages (headline, datePublished, dateModified, author, image, publisher). | High | 2 h |
| 7 | Verify robots.txt and sitemap.xml exist and are correct. | High | 30 min |
| 8 | Fix the stale cache on `/ar/articles` — add `revalidate` or on-publish revalidation. | **Critical** | 1–2 h |

### Strategic investments (this quarter)

| # | Action | Impact | Effort | Depends on |
|---|---|---|---|---|
| 9 | **Build the legacy redirect map.** Pull the old WordPress URL list (Search Console → Pages, or the old DB/sitemap). Map every old article to its new equivalent; where no equivalent exists, 301 to the relevant category hub. Never to the homepage — that's treated as a soft 404. | **Critical** | Multi-day | Access to old URL inventory |
| 10 | **Re-import the old content archive.** ~200 articles vs thousands is the core competitive gap, and you already own that content. | **Critical** | Multi-day | Old DB access |
| 11 | Consolidate the category taxonomy. One canonical category per topic, 301 the duplicates. | High | 1 day | — |
| 12 | Build club hub pages for every Botola side — squad, fixtures, results, news feed, coach. Targets the low-competition keywords in Part 4. | High | Multi-day | — |
| 13 | Add a **Google News sitemap** (`news-sitemap.xml`, last 48 h) and apply to Google Publisher Center. This is how competitors get into Top Stories. | High | 1 day | #9 (domain trust) |
| 14 | Add live standings + top scorers pages for Botola. You already have the API-Football pipeline; these are evergreen high-volume queries. | High | 2–3 days | — |
| 15 | Reduce homepage boilerplate — collapse the 100+ match links behind a tab/lazy-load, elevate article content. Improves LCP and content ratio. | Medium | 1 day | — |
| 16 | Fix image delivery — reintroduce `next/image` or a CDN transform layer, serve WebP/AVIF at display size. | Medium | 1–2 days | Vercel quota strategy |
| 17 | Decide on the French locale. If `/fr` is coming back, implement proper `hreflang`. If not, ensure no stale French URLs remain indexed. | Medium | Varies | — |

---

## Data gaps — please verify

I could not check these from outside the stack:

1. **`robots.txt`** — `curl -s https://www.mfmsport.ma/robots.txt`
2. **`sitemap.xml`** — does it exist, does it include all articles, is `lastmod` accurate?
3. **Canonical tags** — `curl -s <url> | grep -i canonical`
4. **Redirect chain and status codes** — `curl -sIL https://mfmsport.ma/ | grep -iE 'HTTP/|location'`
5. **Google Search Console** — Pages report (indexed vs excluded counts), and the "Crawled – currently not indexed" bucket, which I expect to be very large
6. **Google Publisher Center** — is MFM Sport still an approved news source? If the migration dropped you, that alone explains losing Top Stories.
7. **Core Web Vitals** — PageSpeed Insights on the homepage and an article page
8. **Ahrefs** — referring domains pointing at legacy URLs. That list is your 301 priority order: redirect the pages with links first.

---

## The one-line version

The migration kept the domain but threw away the site's search identity. Until legacy URLs 301 to real content and the fixture pages stop flooding the index, no amount of on-page work will move rankings.
