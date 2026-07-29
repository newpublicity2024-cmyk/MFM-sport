# Journalist Authoring Blocks — Implementation Record

**Rewritten 2026-07-29.** The original plan described storing and executing journalist-pasted
embed HTML. That architecture was deleted mid-execution; leaving the plan describing it would
mislead the next reader. This is the record of what was actually built.

**Design spec:** `docs/superpowers/specs/2026-07-29-journalist-authoring-blocks-design.md`
**Production checklist (not yet run):** `docs/superpowers/task-9-production-checklist.md`
**Branch:** `feat/journalist-authoring-blocks` — unpushed.

## Goal

Give journalists a visible toolbar in the article editor for social embeds, content images,
photo galleries, audio and allowlisted iframes — and fix the articles list not showing titles.

## The architecture change, mid-flight

The original plan stored the pasted embed HTML and executed it client-side, loading each
platform's SDK. Dropped for three reasons: Facebook's `sdk.js` is ~1 MB and sets pre-consent
cookies on a mostly-mobile Moroccan audience mid-recovery from an indexing collapse; storing and
executing pasted HTML is a permanent stored-XSS surface on pages that carry AdSense; and pasted
embed markup rots as platforms retire embeds.

**Replacement: store the canonical URL only.** Render natively — `react-tweet` in an RSC for X,
plain lazy iframes for Facebook and Instagram. No platform SDK is ever loaded.

This deleted the entire client-side script-execution module, along with a double-execution
defect and the global jsdom weakening it had required.

## Zero DDL

`articles_locales.body` is `jsonb`; Lexical block nodes serialize inside it. Verified by table
count before and after registering the blocks: **32 and 32**, no block-shaped tables. No
migration was written or run — `src/migrations` is gitignored and `payload migrate` warns of
data loss on this database.

## What was built

| Task | Outcome |
|---|---|
| 1 | Articles list title column. A **data** fix — a saved `payload_preferences` row overrode correct `defaultColumns`. Deleted the row so every account falls back to defaults. Verified on production. |
| 2 / 2B | `parseEmbed` — pure, never throws, returns `{platform, id, canonicalUrl}` or a typed failure reason. Exact-equality hostname matching, X handles restricted to `[A-Za-z0-9_]{1,15}`, `<script>`/comment stripping, distinct-pair decoy detection, `fb.watch` refused with its own reason. |
| 3 | **Cancelled** by the architecture change. Reverted. |
| 4 | Four blocks (`socialEmbed`, `gallery`, `audio`, `embedFrame`), `UploadFeature` **extended** with caption and credit rather than replaced, Arabic failure messages single-sourced, iframe hostname allowlist with path scoping. |
| 5 | Renderers: `react-tweet` RSC with `dir="ltr"`, lazy iframes with reserved aspect-ratio boxes, `next/image` replacing the bare `<img>` converter, gallery, native audio. |
| 6 | One shared converter module wired into **four** `RichText` call sites (the original plan said three), plus a plain-text extractor for meta descriptions, excerpts and RSS. |
| 7 | Block-aware tiering. Media blocks make an article ineligible for `archive-brief`. |
| 8 | `FixedToolbarFeature()`, verified in a real browser at 390px and desktop. |
| 9 | **Not run.** Checklist written; deployment is a human decision. |

## Two requirements that exist because of evidence

**The unconditional fallback.** A browser spike found that a *nonexistent* Instagram shortcode
returns HTTP 200 and paints zero images. Failure is undetectable cross-origin, so the caption
and "watch on" link render **beneath the frame always** — not as an error state, because there
is no error to catch.

**Aspect ratio from the path type.** The same spike found `/p/` and `/reel/` both fetch fine, so
the distinction looks redundant. It is not: reels are 9:16, posts ~4:5, and one shared ratio
means letterboxing or a post-load resize. It drives layout, not transport.

## Premises that turned out to be wrong

Recorded because each was asserted confidently and cost real work:

- **"A quoted tweet's blockquote contains two status URLs."** It does not — X's oEmbed keeps the
  quoted link `t.co`-shortened. Confirmed against the live syndication API.
- **"A gallery-heavy article gets tiered to `noindex`."** Latent, not active. `tierFor` has one
  production call site, on the WordPress import path; admin-authored articles default to
  `editorial` and nothing recomputes it. The guard is protection against a future bulk re-tier.
- **"Three `RichText` call sites."** Four.
- **`DELETE … WHERE key = 'collection-articles-list'`.** The key is `collection-articles`; the
  original statement would have been a silent no-op.

## Defects the review layer caught

Each was found by execution, not by reading:

- Attribute injection — an unescaped X handle interpolated into an `href`, reachable from a
  URL-shaped input containing no `<`.
- Hostname matching by substring — `notfacebook.com` passed.
- An iframe allowlist matching hostname but not path — any `www.google.com/*` URL validated as
  a "Google Maps" embed.
- `facebook.com/watch/?v=<id>` losing the video id, resolving to Facebook's Watch homepage.
- All four block converters throwing on a `fields`-less node — an HTTP 500 on an article page.
- The gallery carousel's buttons physically swapped in RTL.
- Double script execution — an inline script run once by `new Function` and again by the
  re-injected element.

## Open items

- `docs/superpowers/task-9-production-checklist.md` — unrun.
- The Instagram test fixture is documented-format, not fetched.
- Framing confirmed at header level; no pixels observed inside our own iframe.
- Click-to-caret in the RTL editor — see `CLAUDE.md` → Open defects.
