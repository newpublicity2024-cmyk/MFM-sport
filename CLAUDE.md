# MFM Sport — working notes

Arabic-language Moroccan football news site. Next.js 16 (App Router) + Payload CMS 3 on Neon Postgres (Frankfurt), deployed on Vercel.

---

## Session state — SEO remediation

**Updated: 28 July 2026, phase boundary — redirect map repaired and verified.** Update this at every phase boundary. It is deliberately ground truth on disk rather than in a conversation summary.

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

**No import has run against production.** Production has 397 articles and 200 (now normalised) redirects.

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
