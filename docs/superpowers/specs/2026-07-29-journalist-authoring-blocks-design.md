# Journalist authoring: embeds, content images, galleries, audio

**Date:** 2026-07-29 (rewritten — the original described an architecture that was deleted)
**Status:** Approved (design), partially implemented
**Branch:** `feat/journalist-authoring-blocks`

## Problem

The journalist dashboard (Payload admin) cannot do four things the newsroom needs:

1. Embed a social post — Facebook, X, Instagram — inside an article body.
2. Place an image inside the body. Journalists believe only the hero is possible.
3. Publish a gallery or an audio segment. MFM is a radio brand; audio is a real content type.
4. See article titles in the list view.

Two of these had causes different from the reported symptom, both confirmed against the
running system rather than inferred:

**The list was a data problem.** `Articles.ts` already declared `useAsTitle: "title"` and the
right `defaultColumns`. A saved per-user row in `payload_preferences` had `{"active": false}`
on the title accessor, and a saved preference overrides `defaultColumns` permanently. Fixed by
deleting the row, not by changing code.

**Content images already worked.** `UploadFeature` and `UploadJSXConverter` are both Payload
defaults. What was missing is *discoverability*: the default feature set has only an inline
toolbar that appears on text selection, so the sole entry point was typing `/` and knowing the
English command name — unusable for an Arabic-language newsroom, worse on touch.

## The architecture decision

An earlier version of this design stored the journalist's **pasted embed HTML** and executed it
client-side, loading each platform's SDK. That was dropped. Three reasons, in order of weight:

1. **Performance.** Facebook's `sdk.js` is roughly a megabyte and sets cookies before consent.
   X's `widgets.js` turns each tweet into an iframe pulling 20+ requests. This site is mid-
   recovery from an indexing collapse and serves a mostly-mobile Moroccan audience.
2. **Security.** Storing and executing journalist-pasted HTML is a permanent stored-XSS surface.
   One instance was already found and fixed on this branch. The class does not close while the
   design stays the same — and these pages carry AdSense, so an XSS is also a policy incident.
3. **Durability.** Meta retired automated Facebook page embeds in November 2025, and Instagram
   oEmbed has required app-token auth since 2020. Pasted embed markup rots silently.

**The replacement: store the canonical URL only.** Never store or execute pasted HTML. Render
each platform natively, server-side where possible.

| Platform | Transport | Client JS |
|---|---|---|
| X / Twitter | `react-tweet` (RSC — renders real HTML, so tweet text becomes indexable article content) | none |
| Facebook | `<iframe src="…/plugins/video.php?href=…">` | none |
| Instagram | `<iframe src="https://www.instagram.com/{p\|reel}/{shortcode}/embed">` | none |
| YouTube | lite facade, not a live iframe | facade only |

This deleted an entire module of client-side script execution along with the double-execution
defect and the global jsdom weakening it had required.

## Zero DDL

`articles_locales.body` is `jsonb` and Lexical block nodes serialize **inside that column** —
unlike a top-level `blocks` field, they create no relational tables. Every part of this design
ships as a pure code change: no migration, no hand-written DDL, no `payload migrate` run. That
matters because `src/migrations` is gitignored and `payload migrate` warns of data loss on this
database.

## Instagram transport — verified, not assumed

`instagram.com/{p|reel}/{shortcode}/embed` is an **undocumented** path, and all Instagram
rendering rests on it. It was verified by rendering in a real browser (the cached Playwright
chromium, driven directly — no dependency added), not by fetching:

- `/p/{code}/embed` → 200, renders real post content and live CDN images.
- `/reel/{code}/embed` → 200, renders a genuine `<video>` with a poster, not a thumbnail card.
- **A nonexistent shortcode also returns 200 — and paints zero images.** A status-code check
  would have certified a broken endpoint as working.
- No login redirect, no `challenge_required`, no cookies required.
- No `X-Frame-Options`; the CSP carries no `frame-ancestors` directive, so framing is permitted.
  Residual gap: framing was confirmed at header level and by absence of any browser refusal,
  **not** by observing pixels inside our own iframe. Task 9 closes that on a deployed page.

## Parser

`src/lib/embeds/parseEmbed.ts` is the single chokepoint deciding what an embed *is*. Pure and
synchronous — no DOM, no network, no oEmbed round trip. It must never throw: a throw becomes an
HTTP 500 on an article page, and the staged indexation release depends on 200s.

```ts
type ParsedEmbed = { platform: "x" | "facebook" | "instagram" | "youtube"; id: string; canonicalUrl: string };
type EmbedFailure = "empty" | "unsupported" | "short-link" | "multiple";
function parseEmbed(input: unknown): { ok: true; embed: ParsedEmbed } | { ok: false; reason: EmbedFailure };
```

It accepts a bare URL **or** pasted markup, extracts candidate URLs from markup and **discards
the markup**. Nothing HTML-shaped is ever returned or stored.

Load-bearing details, each closing a bug found in review:

- Hostnames match by **exact equality**, never `endsWith` — so `notfacebook.com` and
  `l.facebook.com` both fail.
- The X handle is restricted to `[A-Za-z0-9_]{1,15}`, which closed an attribute-injection bug
  reachable from a URL-shaped input containing no `<`.
- Entity decoding happens **before** host validation. Do not reorder.
- `<script>` blocks and HTML comments are stripped before extraction.
- More than one **distinct** `{platform, id}` pair returns `"multiple"`. Repeats of the same
  post resolve normally — real embed markup carries the same URL several times.
- `fb.watch` returns `"short-link"`. It is what mobile Facebook's share sheet produces, and it
  cannot be resolved without a network round trip; guessing the content type gets it wrong.

**A correction worth preserving:** an earlier premise held that a quoted tweet's blockquote
contains two `status/` URLs. It does not — X's oEmbed keeps the quoted link `t.co`-shortened,
confirmed against the live syndication API. The `"multiple"` guard still earns its place for
the "two embeds pasted together" pattern and for Instagram and YouTube.

## Blocks

Registered via `BlocksFeature`. All labels Arabic-first.

- **`socialEmbed`** — `source` (the canonical URL, normalised at input), optional `caption`.
  `validate()` runs the parser and rejects with the Arabic message for the returned reason.
- **Images** — the existing `UploadFeature`, extended with per-collection `caption` and
  `credit`. Not a new block; it always worked, it was only undiscoverable.
- **`gallery`** — images with per-image captions, and a `layout` select (grid | carousel).
- **`audio`** — an uploaded file plus a title.
- **`embedFrame`** — `src` validated against a hostname allowlist (Datawrapper, Google Maps,
  SoundCloud, Spotify), plus `height` and a required `title` for accessibility.
  **SoundCloud is load-bearing, not decorative** — MFM is a radio brand.

**No free-form HTML block.** It buys nothing the above doesn't cover and reopens exactly the
surface this design closes. If a genuine need appears it returns as an admin-role-gated block
with its own review.

The four `EmbedFailure` reasons map to Arabic journalist-facing strings in **one** place, not
inside `validate()` — otherwise they get duplicated the moment anything else needs them.

## Renderers

**X** — `react-tweet`'s `<Tweet id>` in a Server Component, inside `<Suspense>` with a skeleton
and a `<TweetNotFound>` fallback. Cache the syndication fetch. Set `dir="ltr"` on the container:
tweets are usually LTR content inside an RTL page and will otherwise render wrong.

**Facebook / Instagram** — plain `<iframe>`, `loading="lazy"`, explicit aspect-ratio wrapper,
`referrerPolicy="no-referrer-when-downgrade"`, `allowFullScreen`.

**Unconditional visible fallback (A1).** A deleted post, a privated account and a suspended one
all return 200 and paint nothing, and cross-origin we cannot detect it. Over years this site
will accumulate articles containing blank rectangles. So the caption plus a
"شاهد على إنستغرام" link renders **beneath the iframe, always** — not as an error state, because
there is no error to catch. If the frame paints, it reads as a normal attribution line; if it
doesn't, the reader still gets the caption and a working link. **Same treatment for Facebook.**

**Aspect ratio comes from the path type (A2).** The spike showed `/p/{reel-shortcode}/embed`
also works, so path form does not matter for *transport*. It matters for *layout*: reels are
9:16, posts roughly 1:1 to 4:5. One fixed ratio across both gives either heavy letterboxing or a
container that resizes after load — which is CLS, on a site whose Core Web Vitals are actively
being protected. **The parser's `/p/` vs `/reel/` distinction drives the aspect-ratio box. Do
not delete it as redundant just because transport no longer needs it.**

**Images** — the default `UploadJSXConverter` emits a bare `<img>`: unsized, unoptimised,
CLS-generating. Override it to emit `next/image` with explicit width and height from the media
doc and a `sizes` matching the article column. No `priority` — that belongs to the hero.

**Gallery** — one client component, `loading="lazy"` on everything but the first image, fixed
aspect ratios. **Audio** — native `<audio preload="none">`, no player library.

Check for a CSP in `next.config` or middleware. If one exists, `frame-src` needs
`www.facebook.com`, `www.instagram.com`, `www.youtube-nocookie.com`, `platform.twitter.com`. A
local render that a production CSP blocks is exactly the proxy-versus-artefact failure this
project keeps hitting.

## Converters and text extraction

One shared converter module, imported by every `RichText` call site — find them, do not trust a
stale list. Alongside it, a **text-only extractor** for meta descriptions, excerpts, RSS and
search indexing, degrading blocks gracefully rather than emitting `[object Object]`:
`socialEmbed` → its caption; image → alt and caption; `gallery` → concatenated captions;
`audio` → title.

## Tiering must become block-aware

**The highest-consequence item in this design.** Body length drives article tiering, and
`archive-brief` is `noindex`. Blocks contribute zero characters to a naive text walk, so a match
report built from a video embed, a gallery and 300 words of Arabic gets tiered down and silently
dropped from the index — the same failure mode as the multi-line ACF blocks the hard gate in
`CLAUDE.md` exists to prevent.

Requirements: make the tier function and `pnpm audit:body-length` block-aware via the extractor;
count captions and alt text toward length; make **any article containing at least one media
block ineligible for `archive-brief`** regardless of text length; and prove no regression by
re-running the audit across imported years and showing a **byte-identical** diff — existing
articles contain no blocks, so any change is a bug.

## Performance budget

An article with one tweet, one Facebook video and one gallery must add **< 50 KB** of JavaScript
over the same page with none, and must issue **zero** requests to `connect.facebook.net` or
`platform.twitter.com/widgets.js`.

## Known gaps, carried until closed

- The committed Instagram test fixture is **documented-format, not fetched** — both oEmbed
  endpoints returned an app-token wall. Extraction may fail on what a journalist actually
  copies. Task 9 must include "paste a real Instagram embed copied from the app".
- Framing confirmed at header level only; no pixels observed inside our own iframe yet.
- Task 1's rendered-page check was done on production and passed; the DELETE and the check hit
  the same Neon branch (`br-royal-wildflower-a21skzaw`, primary and default).
