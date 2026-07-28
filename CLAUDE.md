# MFM Sport — working notes

Arabic-language Moroccan football news site. Next.js 16 (App Router) + Payload CMS 3 on Neon Postgres (Frankfurt), deployed on Vercel.

---

## Session state — SEO remediation

**Updated: 28 July 2026, end of session 1.** Update this at every phase boundary. It is deliberately ground truth on disk rather than in a conversation summary.

### Merged and deployed

| PR | What |
|---|---|
| #52 | Real 404s, ad-free error pages, `www` canonical, 307→308, Arabic description, match whitelist, archive importer |
| #53 | Reverted sitemap sharding (it served zero URLs and 404'd `/sitemap.xml`) |
| #54 | hreflang → Arabic only, canonicals on all page types, `docs/verification-principles.md`, this file |

Deploy of #52/#53 is **live and verified on production**: `/ar/transfers` → 404, locale redirect → 308, `/sitemap.xml` → 200, `/news-sitemap.xml` → 200, zero real ad `<script>` tags on both 404 types.

### Database

Archive-fields DDL is **applied to production** (`broad-snow-50246164` / branch `production`): `wp_post_id`, `legacy_slug`, `seo_tier`, three indexes, `payload_migrations` batch 8. All pre-existing articles default to `editorial`, so they stay indexable.

Verification branch **`br-gentle-hat-a2bzeay0`** is alive deliberately — keep it until the full import is done. It holds ~2,378 imported archive articles and 2,178 normalised redirects, and is useful to diff against.

**No import has run against production.** Production has 397 articles and 200 (unnormalised) redirects.

### The exact next command

```bash
# 1. verify hreflang on prod once #54 deploys (expect ar-MA + x-default, no /fr or /en)
curl -s https://www.mfmsport.ma/ar/articles/<slug> | grep -oiE 'hreflang="[^"]*"'

# 2. repair the production redirect map (200 rows, currently matching nothing)
pnpm redirects:normalize:dry     # inspect first
pnpm redirects:normalize

# 3. then, and only then, the first import batch
pnpm import:wp -- --dry-run --limit=25
pnpm import:wp -- --min-year=2024
```

Import order is **DDL → deploy → normalize → import**, and it matters: without `lib/seo/indexation` deployed, every imported article is immediately indexable and listed in the sitemap, which defeats the staged release.

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
