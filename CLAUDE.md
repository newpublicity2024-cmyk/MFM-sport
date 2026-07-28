# MFM Sport — working notes

Arabic-language Moroccan football news site. Next.js 16 (App Router) + Payload CMS 3 on Neon Postgres (Frankfurt), deployed on Vercel.

---

## Session state — SEO remediation

**Updated: 28 July 2026, phase boundary — 2024 import batch in flight.** Update this at every phase boundary. It is deliberately ground truth on disk rather than in a conversation summary.

### Resume here

The 2024 batch was interrupted mid-run at **6,196 of 6,570**. This is safe: `wpPostId` is unique and indexed, and the importer loads the set of existing ids as its checkpoint, so re-running skips what already landed.

```bash
# 1. finish 2024 (resumes automatically — no flags change)
pnpm import:wp -- --min-year=2024 --max-year=2024

# 2. then 2025 (1,509 posts) and 2026 (564). Audit already passed for both.
pnpm import:wp -- --min-year=2025 --max-year=2025
pnpm import:wp -- --min-year=2026 --max-year=2026

# 3. then STOP for Search Console review before any older year.
```

Do not run 2023 or earlier — see **Hard gates** below.

**Known gap, not yet fixed:** the importer writes with `context.disableRevalidate` and a comment at ~line 403 claims the site is "revalidated once at the end of the import". *No such call exists.* `src/app/sitemap.ts` has `revalidate = 86400`, so the imported URLs will not appear in `/sitemap.xml` for up to 24h. `/api/revalidate` does not cover `/sitemap.xml` either — it revalidates article, listing and home paths only. Either add `revalidatePath("/sitemap.xml")` to that route and call it once after the import, or wait out the 24h.

**Still unfixed:** `<html>` carries no `lang`/`dir` (see open defects). One-line hardcode now the site is Arabic-only.

### Merged and deployed

| PR | What |
|---|---|
| #52 | Real 404s, ad-free error pages, `www` canonical, 307→308, Arabic description, match whitelist, archive importer |
| #53 | Reverted sitemap sharding (it served zero URLs and 404'd `/sitemap.xml`) |
| #54 | hreflang → Arabic only, canonicals on all page types, `docs/verification-principles.md`, this file |
| #55 | Upstream API failure no longer serves 404 for fixtures that exist |

All four are **live on production and verified against the served bytes** (deployment `dpl_9mR6QBDznjofSoHUSSn9xbafdG1i`):

- `/ar/transfers` and a missing article slug → **404** (real, not soft)
- apex → `/ar` → **308**
- `/sitemap.xml` → 200 with **906 `<loc>`**, of which 398 are articles
- `/news-sitemap.xml` → 200 with **13 `<loc>`** — the 48h window is holding, not leaking the archive
- article page → exactly **2** hreflang alternates, `ar-MA` + `x-default`, both `/ar`; canonical on `www`; no `robots` meta (indexable)
- 404 page → **0** real `adsbygoogle.js` script tags

### Redirect map — repaired and verified end-to-end

All 200 rows were stored in the dead format (100% had *both* a trailing slash and lowercase hex). `pnpm redirects:normalize` rewrote all 200; **0 duplicate collisions**.

Verified on the artefact, not the table:

| Check | Result |
|---|---|
| `/api/redirects?from=…` — the exact request middleware makes | **200/200** return the correct target |
| Stale `{to: null}` cached by the CDN before the repair | **0** (the deploy reset the cache) |
| Destination article URLs | **200/200** return HTTP 200 |
| One full legacy chain, end to end | `308` → `301` → `200` |

**Breakdown of the 200: all 200 → live published article.** Zero category-hub fallbacks, zero dead targets.

`pnpm redirects:verify` (`scripts/verify-redirects.ts`) re-runs the whole check any time. It probes the lookup endpoint rather than the legacy URLs, deliberately: fetching all 200 legacy URLs would consume the untouched sample someone may want for an independent spot-check.

The legacy URL consumed for the end-to-end chain test was **`/الجامعة-تبرم-اتفاقية-شراكة-مع-المكتب-ا`** (row 356). The other 199 are untouched.

### Database

Archive-fields DDL is **applied to production** (`broad-snow-50246164` / branch `br-royal-wildflower-a21skzaw`): `wp_post_id`, `legacy_slug`, `seo_tier`, three indexes, `payload_migrations` batch 8. All pre-existing articles default to `editorial`, so they stay indexable.

Verification branch **`br-gentle-hat-a2bzeay0`** is alive deliberately — keep it until the full import is done. It holds ~2,378 imported archive articles and 2,178 normalised redirects, and is useful to diff against.

**The 2024 import is partially applied to production.** State as of the interruption:

| | |
|---|---|
| articles | 6,594 — 398 `editorial` (pre-existing, untouched) + 6,196 imported |
| `archive-full` / `archive-brief` | 5,383 / 813 |
| with `wp_post_id` | 6,297 = 101 backfilled + 6,196 imported |
| redirects | 6,396 = 200 original + 6,196 new |
| imported date range | 2024-01-03 → 2024-12-11 (confirms `--max-year` works) |
| failures / zero-date / empty bodies | **0 / 0 / 0** |

Two invariants held for every row and are worth re-checking after each batch: `redirects − 200 == imported`, and `archive-full + archive-brief == imported`. Both mean one redirect and one tier per article, with nothing silently dropped.

Tier split landed at **13.3% `archive-brief`**, against the 13.2% predicted in `docs/wp-corpus-analysis.md`. An earlier reading of 21.2% was a partial-sample artifact of a chronological export — not a bug. `pnpm audit:body-length --year=<Y>` is the tool that settled it.

**A backfill was required before any import could run safely.** All 398 pre-existing articles had `wp_post_id` NULL, so the importer's checkpoint could not see them and would have re-created every one at `<slug>-2` — indexable, sitemap-listed, and with no redirect, since the legacy redirect already points at the original. `pnpm backfill:wp-ids` matched 101 via the redirect map; the other 297 postdate the export and cannot collide. The proof those numbers are complete: exactly 101 articles have `published_at` on or before the export date.

### The exact next command

```bash
# BLOCKED pending the owner's own fresh-URL spot-check on an untouched legacy URL.
# Then, and only then, the first import batch:
pnpm import:wp -- --dry-run --limit=25
pnpm import:wp -- --min-year=2024
```

Import order is **DDL → deploy → normalize → import**, and it matters: without `lib/seo/indexation` deployed, every imported article is immediately indexable and listed in the sitemap, which defeats the staged release. DDL, deploy and normalize are all now done.

### Open defects — found, not yet fixed

- **`<html>` carries no `lang` and no `dir`.** Production serves `<html data-dpl-id="…">` on every page type including the 404. `dir="rtl"` / `lang="ar"` are set on an inner `<div>` in `[locale]/layout.tsx:44` instead. `<html lang>` is the language signal Google and screen readers read first, and the missing `dir` means anything rendered outside that div — the 404 page among them — lays out left-to-right on an Arabic site. The `<html>` element lives in `(frontend)/layout.tsx`, above `[locale]`, which is why it never got the locale; now that the site is Arabic-only it can simply be hardcoded. Small fix, real signal.

### Open blockers

- **Ahrefs connector not authorised** — blocks referring-domain data, which would set import *order* (highest-value URLs first). Does not block the import itself.
- **Vercel connector scoped to the wrong account** (`lallafatimamagazine-4500s-projects`, not `newpublicitys-projects`) — blocks the ASN/user-agent breakdown behind the WAF rules. GA4 says >50% of traffic is datacenter-region bots.
- **API-Football daily quota exhausted** — match pages return null upstream. Blocks verifying that a *whitelisted* fixture is indexable; the non-whitelisted `noindex` case is verified.
- **`wp-content/uploads` backup** — owner is checking. All 43,584 legacy images already 404; the WordPress REST API is gone. Bodies import with `<img>` stripped. Images can be backfilled later against `legacy_slug` without re-importing text.

### Agreed plan

Tiering at 500 characters of body text: **26,982** `archive-full`, **10,006** `archive-brief`, **4** genuinely empty. Import everything, 301 everything, but stage *indexation*: 2024–2026 first (~8,600), then pause for Search Console before releasing older years. `archive-brief` stays `noindex, follow` indefinitely.

---

## Verification

**Read [`docs/verification-principles.md`](docs/verification-principles.md) before claiming that anything works.**

> Assert on the artefact a crawler or user actually receives — not on a proxy for it.

That document is not general advice. It is five specific bugs this codebase shipped, each of which had already been "verified" by something that looked like evidence: a row count, a green build, a `grep -c`, a computed statistic. They were found only by fetching the bytes a client would actually get.

The short version, when you don't have time for the long one:

- A green build is not a behavioural assertion. Fetch the URL and count the elements.
- Check the HTTP **status**, not just the rendered body. A page can render correctly and respond wrongly.
- `grep -c` counts matching *lines*. Minified HTML is one line. Use `grep -o | wc -l`, and match the parsed construct — a string can appear in an RSC payload without being a real tag.
- A dry run validates parsing, not writing. Run it for real against a throwaway Neon branch.
- Say "untested" rather than "works". Your phrasing becomes the next person's premise.

---

## Hard gates

**2023-and-earlier batches MUST NOT run until `pnpm audit:body-length --year=<Y>` passes for that year with zero disagreements.**

651 multi-line ACF `meta_value` blocks are known to exist outside the 2024–2026 window and will silently under-count bodies into `archive-brief`, which is never released.

The mechanism: `readTag()` matches `<tag>…</tag>` on a *single line*. ACF flexible-content values are multi-line HTML, so `readTag` returns `null`, the value contributes **0 characters**, and `lastMetaKey = null` discards the remainder. A full article scores under 500, lands in `archive-brief`, and is `noindex` indefinitely — with no error, no failed row, and nothing in the import summary to distinguish it from a genuinely short post.

This is verified *absent* from 2024, 2025 and 2026 (zero disagreements in all three, and all three match `docs/wp-corpus-analysis.md` to the decimal). It is verified *present* in the corpus as a whole. Since the per-year disagreement count is zero across the whole released window, all 651 sit in earlier years — most likely 2021–2022, which is 53% of the corpus.

Run the audit per year. If disagreements are non-zero, fix the multi-line read in `scripts/import-wp-archive.ts` (~line 258) **before** importing that year — re-tiering after the fact is a bulk write, which is exactly what the tier field exists to avoid.

## Landmines

**Never add a `loading.tsx` to a route segment that has 404-capable children.** Its Suspense boundary flushes the response shell before the page body runs, committing HTTP 200 — so `notFound()` renders its page inside an already-successful response and every 404 on the site silently becomes a soft 200. This happened; see the principles doc. `/search` has the only `loading.tsx`, and it has no child routes and never calls `notFound()`.

**Raise `notFound()` in `generateMetadata`, not only in the page body.** Metadata resolves before the response streams, so the 404 status can still be set there.

**All ads live in `[locale]/(site)/layout.tsx` and nowhere above it.** `not-found.tsx` is a sibling of that route group, so raising `notFound()` discards the whole ad-bearing subtree. This makes "no ads on error pages" a property of the tree rather than a rule to remember — Google prohibits ads on screens without publisher content. If you move the AdSense loader up a level you silently reopen that exposure; a merge conflict already tried to. Verify with a real `<script src=…adsbygoogle>` tag count on a 404, not a grep.

**Legacy redirect lookups must go through `normalizeLegacyPath()`.** WordPress wrote permalinks in lowercase percent-encoding with a trailing slash; the platform normalises requests to uppercase without one. The map is an exact string match, so unnormalised lookups match nothing — this is why the original 200-row redirect map never fired once.

**`src/migrations` is gitignored, and `payload migrate` warns of data loss on this database** (it detects dev-push drift and would reconcile against a stale snapshot). Apply DDL by hand — the statements live in `docs/archive-import-runbook.md`.

**Percent-decode before stripping tags.** `<![CDATA[` opens with `<` and `]]>` closes with `>`, so `/<[^>]+>/` swallows an entire CDATA section as one "tag". This produced a fake "6% of the archive is empty" statistic.

---

## Key documents

| Document | What it covers |
|---|---|
| `docs/verification-principles.md` | How to check that something works. Read first. |
| `docs/seo-recon-findings.md` | Ground truth vs. the external SEO audit, with corrections |
| `docs/traffic-integrity-findings.md` | GA4 analysis: >50% of page views were error pages |
| `docs/wp-corpus-analysis.md` | The 36,992-post WordPress export: tiering and the decision behind it |
| `docs/archive-import-runbook.md` | DDL, batched import, staged indexation release |

---

## Conventions

- Arabic is the only served locale. `/fr` and `/en` 301 to `/ar`; Payload still stores those translations and the change is reversible.
- All user-facing SEO text — titles, descriptions, schema, alt text — is Arabic. English boilerplate is a bug.
- `SITE_URL` (`src/lib/seo/siteUrl.ts`) normalises to the `www` origin regardless of the env var. Don't build URLs from `process.env.NEXT_PUBLIC_SITE_URL` directly.
- Archive articles are released into the index in batches via `src/lib/seo/indexation.ts`. Releasing a batch is a config edit and a deploy — never a re-import or a bulk DB write.
- The sitemap and the `robots` meta tag must always agree. Listing a `noindex` URL in a sitemap is a contradictory signal.
