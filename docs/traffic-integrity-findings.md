# MFM Sport — Traffic Integrity Findings (Phase 1.5)

**Date:** 28 July 2026
**Sources:** GA4 export (`Instantané_des_rapports.pdf`, 30 June – 27 July 2026), live production probing, repo inspection, production Neon database.
**Branch:** `fix/seo-phase1-traffic-integrity` · commit `c49ff9b`

---

## Headline

**Over half of this site's traffic is error pages, and every one of them was serving ads.**

| Page title in GA4 | Views | What it actually is |
|---|---|---|
| `MFM Sport` | 3,500 | **Soft-404.** Bare root title — the catch-all 404, not the homepage |
| `MFM Sport - أخبار الكرة المغربية` | 1,800 | The real homepage |
| `Not Found` | 1,200 | Entity misses (article/fixture/category lookups that failed) |
| `404: This page could not be found.` | 823 | Next.js default page — routes outside `[locale]` |
| Match pages (3 fixtures) | 521 | Auto-generated fixture pages |

**Errors: 3,500 + 1,200 + 823 = 5,523 of 11,000 page views (50.2%).**

The addendum hypothesised that "a meaningful share" of the 3.5k bare-`MFM Sport` bucket might be soft-404s rather than homepage hits. It is not a share — it is all of them. Proof, from the live site before the fix:

```bash
$ curl -s https://www.mfmsport.ma/ar | grep -o '<title>[^<]*</title>'
<title>MFM Sport - أخبار الكرة المغربية</title>     # real homepage → 1.8k

$ curl -s https://www.mfmsport.ma/ar/transfers | grep -o '<title>[^<]*</title>'
<title>MFM Sport</title>                            # soft-404  → 3.5k
```

The homepage and the 404 page rendered **different titles**, so GA4 was already separating them — nobody had matched the buckets to the pages.

---

## Why every 404 returned HTTP 200

This is the single most consequential defect found, and it was not in either brief.

`src/app/(frontend)/[locale]/loading.tsx` created a Suspense boundary directly beneath the locale layout. That makes Next flush the response shell as soon as the layout renders — committing **HTTP 200** before the page body has run. When the page then called `notFound()`, the not-found content rendered *inside an already-committed 200 response*.

Verified by controlled experiment — same build, only `loading.tsx` removed:

| URL | With `loading.tsx` | Without |
|---|---|---|
| `/ar/articles/no-such-article-xyz` | 200 | **404** |
| `/ar/category/no-such-cat` | 200 | **404** |
| `/ar` (control) | 200 | 200 |

Confirmed identical on production before the fix, so this was long-standing, not a regression:

```
/ar/articles/no-such-article-xyz  → 200
/ar/category/no-such-cat          → 200
/ar/matches/999999999             → 200
```

**Why it matters more than the audit's framing.** The audit described legacy URLs landing on a "noindex void." The reality is worse. A **404** tells Google the URL is gone: drop it, release its link equity. A **200 + noindex** tells Google the URL is alive and the publisher is choosing to hide it — so it stays in the crawl set indefinitely, consumes crawl budget, and passes nothing forward. Roughly 37,000 legacy WordPress URLs (see `seo-recon-findings.md` §9.1) were pointed at exactly that.

---

## AdSense exposure (1.5.4)

### What is actually serving

All five AdSense slot IDs in `src/lib/ads/slots.ts` are empty strings, and `AdSlot` returns `null` when a slot ID is missing. **The manual ad units serve nothing.** The 1,700 `ad_impression` events therefore come from **Auto Ads**, driven by the loader script that sat in `(frontend)/layout.tsx` — the layout wrapping *every* route, including the not-found page.

So: **ads were being served on 5,523 content-free error pages in 28 days.**

That is a policy exposure independent of the bot question. Google's AdSense programme policies prohibit placing ads on screens without publisher content, and name 404 pages specifically. It does not depend on inferring anything about traffic origin — it is directly observable.

### The traffic is not simple scraping

Worth stating precisely, because it narrows what mitigation can work. This traffic **executes JavaScript**: it fires GA4 `page_view` (11k), `session_start` (10k) and AdSense `ad_impression` (1.7k). Static scrapers and `curl`-style crawlers do none of that. These are **headless browsers**, consistent with Singapore (3.1k) and China (1.3k) — datacenter regions — outranking Morocco (997) on an Arabic-language Moroccan football site.

A `robots.txt` disallow will not touch it. Only edge blocking (Vercel WAF) will.

### Impression-to-click ratio — a caveat on the addendum

The addendum reads 1.7k impressions against 31 clicks as matching Google's invalid-traffic pattern. **1.8% CTR is not itself anomalous** — it is within the normal range for display advertising. The genuine risk signals here are the *composition* of that traffic (datacenter geography, 4-second engagement, 0.4% week-1 retention) and the *placement* (content-free error pages), not the ratio. Worth being precise, because if you raise this with AdSense the ratio is not the argument to lead with.

---

## What was fixed (commit `c49ff9b`)

| # | Change | Effect |
|---|---|---|
| 1 | Removed `[locale]/loading.tsx`; re-added scoped to `/search` | All 404s now return **404** |
| 2 | `notFound()` raised inside `generateMetadata` on all entity routes | Miss resolves before the response streams |
| 3 | Deleted `[...rest]` catch-all + `[locale]/not-found.tsx`; added `global-not-found.tsx` + `(frontend)/not-found.tsx` | Three 404 surfaces → **one**, branded, in Arabic (1.5.5) |
| 4 | AdSense loader moved down into `[locale]/layout.tsx` | Unmatched URLs never enter that segment → structurally cannot serve ads |
| 5 | `NotFoundTracker` fires a `page_not_found` GA4 event with the requested path | 404s become measurable; the redirect map can be built from real demand (1.5.6, 1.6.3) |
| 6 | `SITE_URL` normalised to the `www` origin | Every canonical/sitemap/robots URL stopped pointing at a redirect |
| 7 | next-intl locale redirect 307 → **308** | Permanent, as it should be |
| 8 | Arabic root meta description | Replaced sitewide English `"Moroccan Football News Portal"` |
| 9 | Match-page competition whitelist | Non-covered fixtures `noindex`; whitelisted ones get Arabic description + `og:` |
| 10 | `robots.txt` disallows known scraper/AI-training crawlers | Politeness layer only — see caveat above |

### Verification

```
=== STATUS CODES (local production build) ===
  /ar/articles/no-such-article-xyz   404      (was 200)
  /ar/category/no-such-cat           404      (was 200)
  /ar/tag/no-such-tag                404      (was 200)
  /ar/club/no-such-club              404      (was 200)
  /ar/author/no-such-author          404      (was 200)
  /ar/matches/999999999              404      (was 200)
  /ar/transfers                      404      (was 200)
  /ar                                200      (unchanged)
  /ar/articles                       200      (unchanged)

=== ADS ===
  /ar/transfers                       0 adsbygoogle   (was 1)
  /ar                                 1 adsbygoogle   (unchanged)

=== REDIRECT ===
  GET /  →  308 → /ar                              (was 307)

=== CANONICAL (built with NEXT_PUBLIC_SITE_URL=https://mfmsport.ma) ===
  rel="canonical" href="https://www.mfmsport.ma…"  (was apex → 308 → www)

=== MATCH PAGE 1464430 (Austrian Landesliga) ===
  <title>زويتل ضد شريمس | MFM Sport</title>
  <meta name="description" content="زويتل ضد شريمس في لانديسليغا…"/>   (was English boilerplate)
  <meta name="robots" content="noindex, follow"/>                      (was indexable)
```

Full suite: **296 tests across 61 files, all passing.**

---

## Known gap — ads on entity-miss 404s

Ads are fully gone from **unmatched** URLs (the 3.5k + 823 buckets ≈ 78% of error views). They are **not yet** gone from **entity-miss** 404s (the 1.2k bucket, ≈22%).

Why: when `notFound()` is raised inside a page nested under `[locale]`, Next replaces only the *page slot* — the parent layouts, including `[locale]/layout.tsx` and its AdSense loader, still render. Moving the loader any higher puts it back on unmatched URLs too.

The structural fix is a route group — move real pages to `[locale]/(site)/` and keep the ad-bearing layout there, leaving 404s outside it. Route groups don't change URLs, but it relocates ~20 page directories, so I've kept it out of this commit rather than bundle a large mechanical move with behavioural fixes.

Mitigating factor in the meantime: those URLs now return **HTTP 404**, which is the signal AdSense's own crawler uses to classify a page as an error, so the exposure is materially reduced even before the refactor.

---

## Cost impact

**Net reduction.** The soft-404s were previously served from the static/CDN cache; unmatched URLs now render `global-not-found.tsx`, which is cheap and has no database access. Removing `loading.tsx` removes a Suspense boundary from every locale route, marginally reducing streaming overhead.

The one increase: entity-miss 404s resolve `notFound()` in `generateMetadata`, so the lookup happens slightly earlier — same query, same count, no extra database round-trip.

Set against that, the `noindex` on non-whitelisted fixtures should meaningfully cut crawler traffic to match pages over time, which is where a large share of bot-driven origin load has been going.

**On the addendum's "quotas may be artificial" point:** likely correct, but it cannot be confirmed from here — see below.

---

## What I could not do, and why

**1.5.1 (quantify by ASN/user-agent) is blocked.** The Vercel MCP token is authorised for the scope `lallafatimamagazine-4500s-projects`, while mfm-sport lives under `newpublicitys-projects`:

```
403 Forbidden — Not authorized: Trying to access resource under scope
"newpublicitys-projects". You must re-authenticate to this scope.
```

So there is no ASN, user-agent, or request-path breakdown in this report. **1.5.2 and 1.5.3 cannot be done responsibly without it** — the addendum is right that nothing should be blocked before confirming it isn't Googlebot, the API-Football pipeline, or diaspora VPN traffic, and I have no data to make that call.

Everything in this report is derived from GA4, the live site, and the repo.

---

## What I need from you

Ordered by urgency.

1. **Check AdSense for an existing policy action.** Dashboard → Account → Policy center. The addendum asked me to escalate immediately if there is one; I cannot see it. If the account is flagged, tell me before anything else ships.
2. **Vercel WAF rules.** Blocking datacenter ASNs happens in the dashboard, before the function invocation, so it is both the cheapest and the only effective mitigation for JS-executing headless traffic. I can advise on rules but cannot create them.
3. **Re-authorise the Vercel MCP connector** for `newpublicitys-projects` if you want 1.5.1 done properly. Without it I'm inferring load from GA4 alone.
4. **Set `NEXT_PUBLIC_SITE_URL` to `https://www.mfmsport.ma`** in Vercel. The code now normalises to `www` regardless, so this is belt-and-braces, but it removes the discrepancy at source.
5. **GA4 bot filtering** — confirm it's enabled (Admin → Data Streams → the stream → "Exclude internal/known bot traffic"). It clearly isn't catching this, but it should be on.
6. **Google Search Console export**, before more redirects ship. It is simultaneously the Phase 2 legacy inventory and the before-snapshot.
7. **Confirm the match-page whitelist.** Currently: World Cup, UCL, UEL, Euro, Nations League, AFCON, CAF CL, CAF Confederation Cup, WC qualifiers (Africa), Premier League, Ligue 1, Bundesliga, Serie A, La Liga, Botola Pro 1 & 2, Coupe du Trône, plus any Morocco-hosted competition and any fixture involving a Moroccan national team. Tell me if that is too narrow or too broad.

---

## Baseline for measuring whether any of this works

Recorded here so there is a clean before/after boundary. Per the addendum: **total users should go down** as bot traffic is blocked. That is the intended outcome, not a regression.

| Metric | Baseline (30 Jun – 27 Jul 2026) | Target |
|---|---|---|
| Moroccan users / 28 d | 997 | Growing month over month |
| Organic search sessions / 28 d | 1,600 (partly bot) | Growing from a clean baseline |
| Error page views / 28 d | **5,523 (50.2% of all views)** | Near zero after Phase 2 |
| — soft-404 (`MFM Sport`) | 3,500 | 0 (fixed structurally) |
| — entity miss (`Not Found`) | 1,200 | Falls with the redirect map |
| — Next default (`404: …`) | 823 | 0 (fixed structurally) |
| `page_not_found` GA4 events | n/a (instrumentation new) | Establish, then drive down |
| Avg engagement duration | 4 s (masked by bots) | Establish for Morocco only |
| Week-1 cohort retention | 0.4% | Establish clean, then improve |
| Articles in top 10 pages | **0** | Majority |
| Indexed pages (GSC) | Unknown — export needed | Growing |
| AdSense invalid-traffic flags | Unknown — needs dashboard check | Zero |

---

## Corrections to the addendum

1. **The 3.5k `MFM Sport` bucket is entirely soft-404s**, not "partly homepage". The addendum treated this as an open question worth sizing; it is settled, and it doubles the measured error volume from ~2,000 to 5,523.
2. **The 1.8% impression-to-click ratio is not itself an invalid-traffic signal.** It is a normal display CTR. The real signals are traffic composition and ad placement on error pages.
3. **The second 404 renderer was not a missing `not-found.tsx`.** There were *three* renderers, and the cause was a Suspense boundary swallowing the status code — a different problem with a different fix.
4. **`robots.txt` will not help against this traffic.** It executes JavaScript, so it is not a polite crawler. Listed in the addendum's mitigation preference order at #3; in practice only #1 (WAF) will work.
