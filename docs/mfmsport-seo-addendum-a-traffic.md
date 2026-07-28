# MFM Sport — Addendum A: Traffic Integrity

> **How to use this:** save alongside the main brief as `docs/seo-remediation-addendum-a.md`.
> Paste the handoff block below into the existing Claude Code session.

---

## Handoff prompt

```
Read docs/seo-remediation-addendum-a.md. It contains GA4 data from 30 June –
27 July 2026 that was not available when docs/seo-remediation.md was written.

It changes three things:

1. It adds a new Phase 1.5 (traffic integrity) that runs BEFORE Phase 2. There
   is a likely AdSense policy exposure in it — treat 1.5.4 as the highest
   priority item in the whole project.
2. It corrects two assumptions in the original brief. See "Corrections".
3. It adds measurement instrumentation so we can actually verify whether any
   of this work is helping. Right now we cannot.

Fold Phase 1.5 into your plan. Report on it the same way as the other phases.
```

---

## The data

GA4, MFM SPORT property, last 28 days (30 June – 27 July 2026):

| Metric | Value |
|---|---|
| Active users | 9.1k |
| New users | 9k |
| **Average engagement duration** | **4 seconds** |
| Page views | 11k |
| Sessions | ~10k |

**Sessions by channel:**

| Channel | Sessions |
|---|---|
| Direct | 6.8k |
| Organic Social | 1.7k |
| Organic Search | **1.6k** |
| Referral | 50 |
| AI Assistant | 31 |
| Unassigned | 5 |
| Organic Video | 4 |

**Active users by country:**

| Country | Users |
|---|---|
| Singapore | 3.1k |
| China | 1.3k |
| **Morocco** | **997** |
| United States | 980 |
| Egypt | 279 |
| Hong Kong | 185 |
| Germany | 137 |

**Weekly cohort retention:** Week 1 = 0.4%, Week 2 = 0.3%, Week 3 = 0.1%,
Week 4 = 0.3%, Week 5 = 0.0%

**Top pages by title:**

| Page title | Views |
|---|---|
| `MFM Sport` | 3.5k |
| `MFM Sport - أخبار الكرة المغربية` | 1.8k |
| `Not Found` | **1.2k** |
| `404: This page could not be found.` | **823** |
| `أستراليا vs مصر \| MFM Sport` | 248 |
| `مباريات اليوم \| MFM Sport` | 168 |
| `الرأس الأخضر vs الأرجنتين \| MFM Sport` | 105 |

**Events:** `page_view` 11k, `session_start` 10k, `first_visit` 9k,
`user_engagement` 2k, `ad_impression` 1.7k, `ad_click` 31

---

## Interpretation

### The majority of this traffic is not human

An Arabic-language Moroccan football site should not have Singapore as its
largest country by a factor of three, with China second and Morocco third.
Singapore and the United States are the two largest cloud datacenter regions
globally. Corroborating signals, all pointing the same way:

- 4-second average engagement duration
- 9k new users out of 9.1k active — almost nobody returns
- Cohort retention collapsing to 0.4% at week 1 and 0.0% by week 5
- Direct at 6.8k of ~10k sessions, with no returning-user base to explain it
- `user_engagement` fired only 2k times against 11k `page_view`

**Real audience estimate:** roughly 1,000 users (Morocco), ~57 organic search
sessions per day. That is the baseline this project is trying to grow.

### This may be the Vercel cost problem

The project has repeatedly saturated Fluid CPU, Function Invocations, and Fast
Origin Transfer, and image optimization has returned 402s. Automated traffic at
this volume from Singapore and China is a sufficient explanation on its own.

**Before doing any further caching work, determine how much of the origin load
is bot traffic.** It is possible that significant engineering effort has gone
into absorbing load that should simply be blocked at the edge.

### AdSense policy exposure — treat as urgent

`ad_impression` 1.7k against `ad_click` 31, served substantially to datacenter
IP ranges, in sessions averaging 4 seconds. This matches the pattern Google's
invalid traffic detection is built to catch. The enforcement outcome is
typically account suspension rather than a warning.

The AdSense publisher ID is visible in the page head as
`ca-pub-6069287011602160`.

This is a business risk, not an SEO issue, and it outranks everything else in
this project.

### The 404 flood is now quantified

Three distinct error surfaces appear in the top pages:

| Title | Views | What it means |
|---|---|---|
| `Not Found` | 1.2k | Custom not-found page |
| `404: This page could not be found.` | 823 | **Next.js default** — some routes bypass the custom `not-found` entirely |
| `MFM Sport` | 3.5k | Bare title with no suffix — matches the soft-404 page legacy URLs land on |

At minimum ~2,000 of 11k page views are errors. If a meaningful share of the
3.5k `MFM Sport` views are the legacy soft-404 rather than genuine homepage
hits, the true figure is far higher.

The presence of **two different** 404 renderers is itself a bug to find.

### No article ranks in the top pages

The most-viewed content pages are match pages — `أستراليا vs مصر` (248),
`مباريات اليوم` (168), `الرأس الأخضر vs الأرجنتين` (105). No article appears
at all. This is the index-bloat diagnosis from the main brief, now measured:
auto-generated fixture pages are absorbing what little traffic reaches content.

---

## Corrections to `docs/seo-remediation.md`

1. **Phase 1.2 (match-page containment) is now higher priority than stated.**
   It is not merely a crawl-budget concern — fixture pages are outranking
   editorial content in actual measured traffic.

2. **Vercel quota constraints may be partly artificial.** The main brief tells
   you to justify any increase in per-request compute. That still holds, but if
   Phase 1.5 confirms that most origin load is bot traffic, the real budget
   after mitigation may be substantially larger than current usage implies.
   Re-measure after 1.5.3 before treating the constraint as binding.

---

## Phase 1.5 — Traffic integrity

**Runs after Phase 1, before Phase 2.** Ordered by urgency.

### 1.5.1 Quantify

- Pull Vercel analytics/logs for the same 28-day window. Break requests down by
  ASN, country, and user-agent.
- Report: what percentage of requests originate from datacenter ASNs
  (AWS, GCP, Azure, Alibaba, DigitalOcean, Hetzner, OVH, Tencent)?
- Identify the top 20 offending user-agents and ASNs by request volume.
- Determine whether bot traffic is hitting article pages, match pages, the API
  routes, or `/api/media/file/` (image egress would explain Fast Origin Transfer
  saturation specifically).

**Deliverable:** `docs/traffic-integrity-findings.md`

### 1.5.2 Verify the assumption before acting

Do not block anything until you have confirmed it is not legitimate. Check
specifically that the following are **not** being caught:

- Googlebot, Bingbot, and other search crawlers — verify by reverse DNS, not
  user-agent string
- The Vercel deployment/preview infrastructure itself
- Any internal cron jobs or the API-Football pipeline
- Legitimate Moroccan diaspora traffic routed through VPNs or carrier CGNAT

Report anything ambiguous rather than guessing.

### 1.5.3 Mitigate at the edge

Preference order — cheapest first, since the goal is reducing invocations:

1. **Vercel WAF / firewall rules** — block or challenge confirmed datacenter
   ASNs. This happens before the function invocation, so it costs nothing.
2. **Rate limiting** by IP on `/api/*` and `/api/media/file/*`
3. **`robots.txt` disallow** for known scraper user-agents — polite bots only,
   not a security measure
4. **Middleware-level blocking** as a last resort, since it does cost an invocation

Do **not** use client-side JavaScript challenges. They will not stop
server-side scrapers and they will hurt real users on slow Moroccan mobile
connections.

**Acceptance:** re-measure request volume by country after 72 hours. Report
the change in total requests, Fluid CPU, invocations, and Fast Origin Transfer.

### 1.5.4 AdSense — highest priority in the project

- Confirm ads are not being served to traffic identified as invalid in 1.5.1.
- If the WAF rules from 1.5.3 do not fully cover it, gate ad script loading so
  it does not fire for requests from blocked or challenged ASNs.
- Check whether AdSense has already flagged the account. Report the status.
- Once mitigation is live, monitor the impression-to-click ratio. It should move
  materially. If it does not, the bots are getting through.

**Escalate to me immediately if you find evidence of an existing policy action.**

### 1.5.5 Find the second 404 renderer

`404: This page could not be found.` is the Next.js default page. Its presence
alongside a custom `Not Found` means some routes are not covered by a
`not-found.tsx` in their segment. Locate them and add coverage. Confirm both
paths return HTTP 404, not 200.

### 1.5.6 Confirm the soft-404 volume

Add a distinguishing title or a GA4 dimension to the legacy soft-404 page so
the 3.5k `MFM Sport` figure can be split between genuine homepage views and
legacy misses. This number sizes the Phase 2 opportunity — it is worth knowing
precisely before building the redirect map.

---

## Phase 1.6 — Measurement hygiene

Currently the analytics cannot answer whether any of this work helped. Fix that
before Phase 2 ships, so there is a clean before/after boundary.

1. **GA4 configuration**
   - Enable the built-in bot filtering option if it is off
   - Create a filtered view or a `Morocco + Maghreb + diaspora` audience segment
     to serve as the real KPI baseline
   - Add an exploration segmenting sessions with engagement duration under 5
     seconds, to track residual bot traffic over time

2. **Search Console**
   - Confirm the property is verified for the production domain
   - Export the Pages report now, before any redirects ship — this is both the
     Phase 2 legacy inventory and the before-snapshot

3. **404 tracking**
   - Fire a distinct GA4 event on every 404 and soft-404, carrying the requested
     path as a parameter. This turns the Phase 2 redirect map into something
     measurable rather than a leap of faith.

4. **Record the baseline** in `docs/seo-baseline.md` before Phase 2 ships:
   Moroccan users, organic search sessions, engagement duration for Moroccan
   traffic only, indexed page count from Search Console, and 404 event volume.

---

## What success looks like

Ignore total users — that number should **go down** as bot traffic is blocked,
and that is a win, not a regression.

Track instead:

| Metric | Now | Target |
|---|---|---|
| Moroccan users / 28 days | 997 | Growing month over month |
| Organic search sessions / 28 days | 1.6k (partly bot) | Growing, from a clean baseline |
| Engagement duration, Moroccan traffic | Unknown (masked) | Establish, then improve |
| 404 + soft-404 events | ~2,000+ / 28 days | Near zero after Phase 2 |
| Articles in top 10 pages | 0 | Majority |
| AdSense invalid traffic flags | Unknown | Zero |
