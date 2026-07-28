# MFM Sport — working notes

Arabic-language Moroccan football news site. Next.js 16 (App Router) + Payload CMS 3 on Neon Postgres (Frankfurt), deployed on Vercel.

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
