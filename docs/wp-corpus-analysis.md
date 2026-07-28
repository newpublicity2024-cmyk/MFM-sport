# WordPress Corpus Analysis — pre-import decision brief

**Source:** `mfmsport.WordPress.2026-04-24.xml` (646 MB, in repo root)
**Method:** two streaming passes (`readline`, never loading the file into memory — the same shape the importer itself must use, per constraint 3).
**Purpose:** decide what gets imported as indexable vs. what comes in as redirect targets only.

---

## What's actually in the file

| Item type | Count |
|---|---|
| **attachment** | **43,584** |
| **post** | **37,407** |
| acf-field | 212 |
| ct_template | 41 |
| page | 19 |
| other (menus, styles, poll) | 24 |

Of the 37,407 posts:

| Status | Count |
|---|---|
| **publish** | **36,992** |
| draft | 408 |
| pending / private / trash / future | 7 |

**36,992 published posts** is the real number to plan against — not 37,407. Date range **2010-09-08 → 2026-04-23**.

---

## Date distribution

```
  2019     1093  ####
  2020      866  ###
  2021     9927  ########################################
  2022     9858  ########################################
  2023     6601  ###########################
  2024     6570  ##########################
  2025     1509  ######
  2026      564  ##   (partial — export taken 23 April)
  (2010, 2018, malformed: 4)
```

Two things stand out:

1. **2021–2022 alone is 19,785 posts — 53% of the entire corpus.**
2. **Publishing volume collapsed after 2022**: ~9,900/yr → 1,509 in 2025. Worth knowing independently of SEO; the archive's centre of mass is four to five years old.

---

## Body length — the part that decides the question

> **Correction.** The first version of this document reported 2,224 posts (6.0%)
> with an empty body. **That was a bug in my parser, not a property of the
> archive.** The length function stripped HTML tags with `/<[^>]+>/` *before*
> removing the CDATA wrapper — and since `<![CDATA[` opens with `<` and `]]>`
> closes with `>`, that pattern matched the entire CDATA section as if it were a
> single tag and deleted the article text. Any post whose body was plain text
> inside CDATA scored zero. Bodies containing HTML survived partially, because
> the first `>` ended the match early — which is why the damage looked like a
> plausible 6% rather than an obvious total failure.
>
> Caught by sampling 20 "empty" posts against their raw XML, which showed full
> Arabic article text sitting in `content:encoded`. Figures below are from the
> corrected pass, which also counts ACF flexible-content blocks.

Text length after removing CDATA, stripping tags and shortcodes, and adding ACF body blocks — published posts only:

| Body text | Posts | Share |
|---|---|---|
| **0 chars (genuinely empty)** | **4** | 0.0% |
| 1–499 chars | 10,006 | 27.0% |
| 500–1,500 chars | 26,519 | 71.7% |
| 1,500–4,000 chars | 446 | 1.2% |
| 4,000+ chars | 17 | 0.0% |

**27% of the archive is under 500 characters** — for Arabic, roughly 80–90 words: a headline and a sentence or two. But the archive is essentially never *empty*: only **4 posts** in 36,992 have no body at all.

| Year | n | Avg length | Thin (<500) | Empty |
|---|---|---|---|---|
| 2019 | 1,093 | 699 | 23.9% | 2 |
| 2020 | 866 | 710 | 26.6% | 1 |
| 2021 | 9,927 | 667 | 29.1% | 1 |
| **2022** | **9,858** | **571** | **46.9%** | 0 |
| 2023 | 6,601 | 666 | 13.8% | 0 |
| 2024 | 6,570 | 645 | 13.2% | 0 |
| 2025 | 1,509 | 660 | 14.8% | 0 |
| 2026 | 564 | 982 | 1.1% | 0 |

2022 remains genuinely anomalous — **46.9% of that year's output is under 500 characters**, against 13–15% either side of it. That one is real, not an artifact.

Only **1.2%** of the archive exceeds 1,500 characters. This is a wire-style short-news archive throughout. That's normal for football news, but it means "import everything as indexable" would still add ~37k short pages to a domain whose quality signals are already the problem.

### ACF blocks carry real body text

The sampling turned up a second issue worth knowing before writing the importer. Some posts keep part of their body in ACF flexible-content fields (`content_block_4_content_4`, `content_1_article`, …) rather than entirely in `content:encoded`. No post keeps its body *only* there — but ignoring those fields silently truncates articles, and it measurably shifts the numbers: counting them raised 2021's average body length from 557 to 667 characters and cut its thin rate from 40.0% to 29.1%.

**The importer must concatenate ACF body blocks onto `content:encoded`.** It does.

---

## Recommendation

**Import everything; stage what gets indexed.** Boundary confirmed at 500 characters.

### `archive-full` — 26,982 posts (≥500 chars)
Real articles, carrying the topical depth the site is missing. Indexation is **released in batches by publish year**, not all at once — 37k articles appearing in the index overnight is a 90× expansion and invites a sitewide quality reassessment. Stage 1 releases 2024–2026 (~8,600); later stages add 2023, then 2022, then 2021-and-earlier, as Search Console confirms each batch lands cleanly.

### `archive-brief` — 10,006 posts (1–499 chars)
Imported, reachable, redirected — but held at `noindex, follow` indefinitely. They will not rank, and in bulk they are exactly the thin-content dilution the fixture pages already inflict. `follow` is deliberate: their internal links still pass authority to the club and category hubs they mention.

### Genuinely empty — 4 posts
Not a tier. Four rows, handled by hand.

Net effect: **all 36,992 legacy URLs 301 from day one**, while the *indexed* set grows in controlled steps. Link equity does not require indexation — only that the URL resolves.

Nothing here is a one-way door. `seoTier` and `publishedAt` live on the row; indexability is derived from them at render time by `src/lib/seo/indexation.ts`. Releasing a batch — or promoting `archive-brief` — is a config edit and a deploy, never a re-import or a bulk DB write.

---

## Against your three constraints

**1. News sitemap — agreed, and the tiering makes it safer.** Historical posts go in the main sitemap only. The 48-hour news sitemap should be driven off `publishedAt` within the last 48 h, so a backfill physically cannot enter it. I'd add a hard guard: exclude anything whose `publishedAt` is older than the import run's start time, so a clock or timezone slip can't leak a decade of archive into Publisher Center.

**2. Sitemap index — required, and the current file is already at risk.** Projected main-sitemap URL count:

| Source | URLs |
|---|---|
| Tier 1 imports | ~25,800 |
| Existing articles | 394 |
| Categories / tags / authors / clubs / competitions | ~700 |
| Whitelisted fixtures (if added) | thousands |
| Static | ~9 |

That's ~27k before fixtures — under 50,000, but not comfortably, and `app/sitemap.ts` currently emits a single file with `limit: 50000` on the article query. Next supports `generateSitemaps()` for sharding. I'd shard at 10,000 URLs per file behind an index, which also cuts the per-request cost of the daily regeneration.

**3. Batch job, not a route handler — agreed, and it's stricter than that.** Both passes above already stream via `readline`; the file cannot be DOM-parsed. Beyond memory and timeout, the importer also needs resumability (a checkpoint per batch), because a 36,992-post run against Neon will not complete in one uninterrupted pass. `scripts/migrate-wp.ts` is already idempotent with skip-by-slug, so it's the right starting point — it needs batching, a `legacy_slug` column, and the tiering logic.

---

## Two things I could not answer, and one you should decide

**Referring domains: blocked.** This needs Ahrefs, and the connector isn't authorised in this session — I can't run the query. You'd need to authorise it in your claude.ai connector settings, or paste a "Best by links" export for mfmsport.ma. It matters for **ordering**, not for the tiering: the tiers above are decided by content length, which I have. Referring domains tell us which URLs to import *first* so equity starts flowing sooner, and would also justify promoting specific Tier 2/3 URLs to indexable.

**The 43,584 attachments are already gone — there is no decommission date to wait for.**

This was checked because of the concern that losing the old host would strip images from 26k articles at once. The answer is that it has already happened:

```bash
$ curl -sIL https://mfmsport.ma/wp-content/uploads/2020/02/logo.png
404   (text/html — the Next.js error page, not an image)

$ curl -s https://mfmsport.ma/wp-json/wp/v2/posts?per_page=1
<!DOCTYPE html>…   (HTML, not JSON — the WordPress backend is gone)
```

Every one of the 43,584 attachment URLs points at `mfmsport.ma/wp-content/uploads/…`, and that hostname now resolves to the Next.js app on Vercel. There was never a separate CDN. So:

- The WordPress REST API — the source the original 200-article migration pulled images from — **no longer responds**. That route is closed.
- A WXR export contains attachment *metadata and URLs only*, never binaries. Verified: zero base64 in the file.
- There is no `wp-content` or uploads archive anywhere in the repo.

Only the ~186 media files already copied into Vercel Blob survive. **The remaining ~43,400 legacy images are, as far as I can determine, unrecoverable from any source I have access to.**

Consequences for the import: bodies are imported with `<img>` and `<figure>` elements stripped rather than left pointing at URLs that 404. Text-only archive articles are worth having; articles full of broken images are not.

**One urgent question for you** — this is now a recovery question, not a scheduling one: **does a backup of `wp-content/uploads` exist anywhere?** An old host's backup snapshot, a cPanel archive, a server image, a local copy. If one exists it may itself be on a retention timer, so it is worth locating now even though the media import is deferred. Failing that, the Wayback Machine holds some subset — partial and slow to harvest, but non-zero, and worth attempting for the highest-traffic articles once Search Console tells us which those are.
