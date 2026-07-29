# Journalist authoring: embeds, content images, galleries, audio, custom HTML

**Date:** 2026-07-29
**Status:** Approved (design)
**Scope:** `src/payload.config.ts` (editor features), `src/collections/Media.ts` (audio
mime types), new `src/blocks/` definitions, new `src/components/articles/` renderers,
the three existing `RichText` call sites, and one row in `payload_preferences`.

## Problem

The journalist dashboard (Payload admin) cannot do four things the newsroom needs:

1. **Embed a social post.** No way to put a Facebook, X/Twitter, Instagram or TikTok
   video inside an article body.
2. **Place an image inside the body.** Journalists believe only the hero
   (`featuredImage`) is possible.
3. **Publish a gallery, an audio file, or custom HTML.** No mechanism at all.
4. **See article titles in the list view.** The articles list shows status, author
   and date, but no title — making it near-unusable at 8,940 articles.

Two of these have causes that differ from the reported symptom, and both were
confirmed against the running system rather than inferred:

**The list is a data problem, not a code problem.** `Articles.ts` already declares
`useAsTitle: "title"` and `defaultColumns: ["title", "status", "author", "publishedAt"]`.
But `payload_preferences` row `id = 8`, key `collection-articles`, holds:

```json
{ "sort": "-publishedAt", "limit": 10,
  "columns": [ { "active": false, "accessor": "title" },
               { "active": true,  "accessor": "status" },
               { "active": true,  "accessor": "author" },
               { "active": true,  "accessor": "publishedAt" }, ... ] }
```

Someone unticked Title in the Columns picker. A saved preference **permanently
overrides `defaultColumns`**, so no code change can fix this.

**Content images already work.** `lexicalEditor()` with no arguments enables
`defaultEditorFeatures`, which includes `UploadFeature()`. `defaultJSXConverters`
includes `UploadJSXConverter`. So insertion and rendering both exist today. What is
missing is *discoverability*: the default set includes `InlineToolbarFeature` (appears
only on text selection) but **no fixed toolbar**. The only entry point is typing `/`
and knowing the English command name — which no Arabic-language journalist will find.

## Key enabler: zero DDL

`articles_locales.body` is `jsonb` (verified against production
`broad-snow-50246164`). Lexical block nodes serialize **inside that JSON column** —
unlike a top-level `blocks` field, they do not create relational tables.

Every feature in this spec therefore ships as a **pure code change**: no migration, no
hand-written DDL, no `payload migrate` run. This matters because `src/migrations` is
gitignored and `payload migrate` warns of data loss on this database (see `CLAUDE.md`
→ Landmines).

Adding audio mime types to `Media.upload.mimeTypes` is validation-only and likewise
requires no DDL.

## Goals

1. One obvious, touch-friendly insert affordance covering image, embed, gallery,
   audio and custom HTML — identical on phone and desktop.
2. Social embeds accept **either** a pasted embed code **or** a plain link.
3. Article titles visible in the list view.
4. No schema migration.

## Non-goals

- **Gallery lightbox.** Responsive grid only. Addable later.
- **oEmbed API calls** at build or render time — a network dependency, a quota, and
  latency on every article render, to save the journalist nothing.
- **HTML sanitization.** See Security below.
- **A separate audio collection.** `Media` is reused.
- **A rich caption editor.** The `Media.caption` field already exists.
- Changing anything in `lib/seo/indexation.ts`, the sitemap, or the SEO tiering. The
  2024-2026 release is mid-flight and this work must not perturb it.

## Architecture

Six units, each independently testable, communicating through narrow interfaces.

### 1. Editor features — `src/payload.config.ts`

```ts
editor: lexicalEditor({
  features: ({ defaultFeatures }) => [
    ...defaultFeatures,
    FixedToolbarFeature(),
    BlocksFeature({ blocks: [EmbedBlock, GalleryBlock, AudioBlock, HtmlBlock] }),
  ],
}),
```

`FixedToolbarFeature()` pins a persistent toolbar above the editor. It carries a
dropdown group listing every insertable node — the "plus menu" — and works on touch,
so phone and desktop get the same affordance. `defaultFeatures` is spread first so
`UploadFeature` (content images) and everything else already in use is preserved.

This is a config-level editor change, so it applies to the `Pages` collection's `body`
too. That is acceptable and mildly useful; it is not a goal.

### 2. Block definitions — `src/blocks/` (new)

Plain Payload `Block` objects, one file each. All labels localized `en`/`fr`/`ar`
following the existing convention in `src/collections/`.

| File | slug | Fields |
|---|---|---|
| `Embed.ts` | `embed` | `source`: `textarea`, required |
| `Gallery.ts` | `gallery` | `images`: `upload` → `media`, `hasMany: true`, required; `caption`: `text`, localized, optional |
| `Audio.ts` | `audio` | `file`: `upload` → `media`, required; `title`: `text`, localized, optional |
| `Html.ts` | `html` | `code`: `textarea`, required |

Arabic labels: `تضمين (فيسبوك، إكس، إنستغرام)`, `معرض صور`, `ملف صوتي`,
`HTML مخصص`.

`embed` and `html` remain **separate blocks** despite sharing machinery. "تضمين" and
"HTML مخصص" are two different mental models for a journalist; one block that silently
does both is harder to explain than two that each do one thing.

### 3. Embed parser — `src/lib/embeds/parseEmbed.ts` (new)

A pure, synchronous, dependency-free function. This is where the testable logic lives.

```ts
export type ParsedEmbed =
  | { kind: 'iframe'; src: string; title: string; aspect: number }
  | { kind: 'script'; html: string; platform: 'twitter' }
  | { kind: 'html'; html: string; platforms: EmbedPlatform[] }
  | { kind: 'invalid'; reason: string };

export function parseEmbed(input: string): ParsedEmbed;
```

Dispatch:

- **Contains `<`** → treat as pasted markup. Return `kind: 'html'` with `platforms`
  listing which SDKs the markup needs, detected by marker:
  `blockquote.twitter-tweet` → twitter, `blockquote.instagram-media` → instagram,
  `.fb-post` / `.fb-video` → facebook, `blockquote.tiktok-embed` → tiktok. A bare
  `<iframe>` needs none.
- **Starts with `http`** → match against known URL patterns and return an **iframe**,
  so no third-party SDK is loaded:

  | Platform | Iframe endpoint |
  |---|---|
  | YouTube | `youtube-nocookie.com/embed/<id>` |
  | Facebook | `facebook.com/plugins/post.php?href=<encoded>` |
  | Instagram | `instagram.com/p/<id>/embed` |
  | TikTok | `tiktok.com/embed/v2/<id>` |
  | X / Twitter | *no iframe endpoint* → `kind: 'script'`, platform `twitter` |

- **Neither** → `kind: 'invalid'`.

Preferring iframes over SDKs is a deliberate performance decision. Loading the
Facebook and Instagram JS SDKs on article pages would undo the Core Web Vitals work
(`project_perf_speed_insights`). X/Twitter is the sole exception — it has no supported
iframe endpoint, so `platform.twitter.com/widgets.js` is loaded, once, only on pages
that actually contain a tweet.

### 4. Block renderers — `src/components/articles/blocks/` (new)

| Component | Notes |
|---|---|
| `EmbedRenderer.tsx` (client) | Calls `parseEmbed`. Renders an iframe, or injects HTML and lazily loads + re-parses the needed SDK. `kind: 'invalid'` renders nothing in production. |
| `GalleryRenderer.tsx` (server) | Responsive CSS grid of `next/image`, optional `<figcaption>`. |
| `AudioRenderer.tsx` (server) | `<audio controls preload="metadata">` plus optional title. |
| `HtmlRenderer.tsx` (client) | `dangerouslySetInnerHTML`, no SDK detection. |

Every iframe gets `loading="lazy"` and a reserved aspect-ratio box so embeds do not
cause cumulative layout shift. The SDK path reserves a `min-height` for the same
reason.

### 5. Shared converters — `src/components/articles/richTextConverters.tsx` (new)

```ts
export const articleConverters: JSXConvertersFunction = ({ defaultConverters }) => ({
  ...defaultConverters,
  blocks: { embed, gallery, audio, html },
  upload: /* <figure> + <figcaption> from media.caption */,
});
```

The custom `upload` converter replaces the default bare `<img>` with a `<figure>`
carrying the `Media.caption` as a `<figcaption>`, and uses `next/image`.

### 6. Wiring the three call sites

Blocks render as **nothing** unless converters are passed. There are three
`RichText` call sites and all three must receive `articleConverters`:

- `src/components/articles/ArticleBody.tsx` — one call, used by
  about / contact / privacy / legal
- `src/components/articles/InArticleAdInjector.tsx` — **two** calls, the `before` and
  `after` halves either side of the mid-article ad

`InArticleAdInjector` splits the root children at the first `paragraph` node. New
block types do not change that logic: an article opening with an embed still places
the ad after the first real paragraph.

### 7. Media accepts audio — `src/collections/Media.ts`

Append `audio/mpeg`, `audio/mp4`, `audio/ogg`, `audio/wav` to `upload.mimeTypes`.
Payload skips `imageSizes` generation for non-image files; no DDL.

Two consequences worth stating rather than discovering later:

- `Media.alt` is `required: true`, so uploading an MP3 forces the journalist to type a
  name. Left as-is — making `alt` optional would weaken image SEO across the site.
- Audio files are far heavier than photos in the Vercel Blob store, which has been
  blocked on billing before (`project_blob_store_blocked`). Worth watching.

### 8. List preference repair — data, not code

One statement against production:

```sql
UPDATE payload_preferences
SET value = jsonb_set(value, '{columns}',
      (SELECT jsonb_agg(CASE WHEN c->>'accessor' = 'title'
                             THEN jsonb_set(c, '{active}', 'true')
                             ELSE c END)
       FROM jsonb_array_elements(value->'columns') c))
WHERE key = 'collection-articles';
```

A targeted patch rather than deleting the row, so the journalist keeps their
`-publishedAt` sort and page size of 10.

## Security

The `html` block, and the pasted-markup path of `embed`, inject author-supplied HTML
via `dangerouslySetInnerHTML`. **This is stored XSS by design.** It is the same trust
model WordPress ships with, and it is the point of the feature.

The mitigation is authorization, not sanitization: only authenticated users can write
articles. Sanitizing would defeat the feature — every social embed *is* a script tag or
an iframe.

Stated explicitly so a future reader treats it as a known, accepted decision rather
than an oversight.

## Error handling

| Case | Behaviour |
|---|---|
| `parseEmbed` returns `invalid` | Render nothing on the public page. Never a broken box. |
| Embed field empty | Render nothing. |
| Gallery with zero images | Render nothing. |
| Audio upload deleted from Media | Render nothing. |
| Unknown block type in stored JSON | Default converter behaviour: skipped, page still renders. |

No case throws. A malformed block must never take down an article page, and must never
turn a `200` into a `500` — the indexation work depends on article pages returning
`200`.

## Testing

**Unit (vitest, matching `src/components/articles/__tests__/`):**

- `parseEmbed` — one case per platform URL, one per pasted-markup marker, plus empty,
  garbage, and a bare `<iframe>`.
- Converters — each block type renders its expected element; unknown block does not
  throw.
- `InArticleAdInjector` — existing tests still pass with an embed as the first child.

**Verification on production, per `docs/verification-principles.md`:**

A green build is not a behavioural assertion. After deploy, publish one test article
containing all five inserts, then assert **on the served bytes**:

- `curl` the article URL → HTTP **200**
- `grep -o '<iframe' | wc -l` → matches the number of embeds inserted
  (`grep -c` counts lines; minified HTML is one line)
- `grep -o '<audio' | wc -l` → 1
- content `<img>` count matches images inserted
- the articles list in `/admin` shows Arabic titles

## Rollback

Every unit is additive. Removing `FixedToolbarFeature()` and `BlocksFeature()` from
`payload.config.ts` restores today's behaviour exactly; already-authored block JSON
sits inert in the `body` column and is skipped by the default converters. No data is
lost and no schema is stranded — a direct consequence of the zero-DDL design.
