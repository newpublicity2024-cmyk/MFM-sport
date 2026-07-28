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

Text length after stripping tags and entities, published posts only:

| Body text | Posts | Share |
|---|---|---|
| **0 chars (completely empty)** | **2,224** | 6.0% |
| 1–500 chars | 8,964 | 24.2% |
| 500–1,500 chars | 25,357 | 68.5% |
| 1,500–4,000 chars | 432 | 1.2% |
| 4,000+ chars | 15 | 0.0% |

**30.2% of the archive — 11,188 posts — is either empty or under 500 characters.** For Arabic, 500 characters is roughly 80–90 words: a headline and a sentence.

Thin-rate by year makes the pattern clear:

| Year | n | Avg length | Thin (<500) |
|---|---|---|---|
| 2019 | 1,093 | 703 | 23.1% |
| 2020 | 866 | 713 | 25.9% |
| **2021** | **9,927** | **557** | **40.0%** |
| **2022** | **9,858** | **540** | **49.2%** |
| 2023 | 6,601 | 670 | 13.1% |
| 2024 | 6,570 | 649 | 12.3% |
| 2025 | 1,509 | 664 | 14.2% |
| 2026 | 564 | 986 | 1.1% |

The two highest-volume years are also the two thinnest. Nearly half of 2022's output is under 500 characters. Whatever was happening editorially in 2021–22, it produced a lot of very short items.

Note the ceiling too: only **1.2%** of the archive exceeds 1,500 characters. This is a wire-style short-news archive throughout, not a long-form one. That's normal for football news, but it means "import everything as indexable" would add ~37k short pages to a domain whose quality signals are already the problem.

---

## Recommendation

**Do not import all 36,992 as indexable.** Split it:

### Tier 1 — import as indexable (~25,800 posts, ≥500 chars)
Real articles. They carry the topical depth the site is missing, and they are the reason to do this at all.

### Tier 2 — import as `noindex`, still reachable (~8,964 posts, 1–500 chars)
They have *some* content, so the URL should keep working and keep passing equity via its 301. But adding ~9k sub-100-word pages to the index is exactly the thin-content dilution that already hurts the site via fixture pages. Import the content, mark it `noindex, follow`.

### Tier 3 — redirect only, never create an article (2,224 posts, 0 chars)
There is nothing to render. Creating 2,224 genuinely empty pages would be self-inflicted damage. 301 each URL to its category hub — which satisfies the brief's rule of never redirecting to the homepage.

Net effect: the index grows by ~26k substantive articles rather than ~37k mostly-thin ones, while **all 36,992 legacy URLs still resolve with a 301** and keep their link equity. The equity argument doesn't require indexation — only that the URL resolves.

Tiers 2 and 3 are reversible: if a post later proves to attract links or traffic, flipping it to indexable is a field change, not a re-import.

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

**The 43,584 attachments are an unpriced problem.** They outnumber the posts. The Vercel Blob store was blocked on billing once already (June 2026), and this is potentially tens of GB. Before any media import I'd want to: import Tier 1 images only, skip attachments not referenced by a Tier 1 body, and price the result. Worth deciding separately from the article import — the articles are useful even with images still pointing at the old CDN.

**Your call:** the 500-character Tier 1/Tier 2 boundary is a judgement, not a law. Moving it to 300 chars adds roughly 4,000 posts to the indexable set; moving it to 800 removes several thousand. I've used 500 because below it an Arabic article is a headline plus a sentence, which will not rank for anything and only dilutes. Tell me if you want it elsewhere.
