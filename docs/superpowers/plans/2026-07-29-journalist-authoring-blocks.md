# Journalist Authoring Blocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give journalists a visible insert menu in the article editor that adds social embeds, content images, photo galleries, audio and custom HTML — and restore the missing title column in the articles list.

**Architecture:** Everything rides on Payload's Lexical editor. `FixedToolbarFeature()` supplies the always-visible "+" toolbar (touch-friendly, so phone and desktop are identical); `BlocksFeature()` registers four new blocks. Because `articles_locales.body` is a `jsonb` column, Lexical block nodes serialize **inside that JSON** — no relational tables, no DDL, no migration. Rendering is a shared `JSXConvertersFunction` wired into all three existing `RichText` call sites. Embed parsing lives in a pure, dependency-free function so it is unit-testable without a DOM.

**Tech Stack:** Next.js 16 (App Router), Payload CMS 3.84.0, `@payloadcms/richtext-lexical` 3.84.0, Neon Postgres, Vercel Blob, Tailwind 3.4 + `@tailwindcss/typography`, Vitest 3.2 + jsdom + Testing Library.

**Spec:** `docs/superpowers/specs/2026-07-29-journalist-authoring-blocks-design.md`

**Branch:** `feat/journalist-authoring-blocks` (already created from `origin/main`).

## Global Constraints

- **Zero DDL.** No migration is written or run. `src/migrations` is gitignored and `payload migrate` warns of data loss on this database. If any step appears to require a schema change, **stop and report** — it means an assumption in the spec broke.
- **Never mark a field inside a Lexical block as `localized: true`.** The parent `body` field is already localized, so each locale holds its own copy of the block JSON. Nested localization is redundant and risks a Payload config-validation error.
- **All user-facing labels are Arabic-first**, with `en`/`fr` alongside, matching the `{ en, fr, ar }` object style used throughout `src/collections/`. English boilerplate reaching a reader is a bug.
- **No renderer may throw.** A malformed block must render nothing rather than turn an article's HTTP `200` into a `500`. The staged indexation release depends on article pages returning `200`.
- **Every iframe gets `loading="lazy"` and a reserved aspect-ratio box.** Layout shift is a regression against prior Core Web Vitals work.
- **Ads stay in `[locale]/(site)/layout.tsx`.** Do not move or add ad code. See `CLAUDE.md` → Landmines.
- **Verify on the served bytes, not on a green build.** `grep -c` counts matching *lines* and minified HTML is one line — always use `grep -o … | wc -l`. See `docs/verification-principles.md`.
- Package manager is **pnpm**. Test command is `pnpm test:run`.

---

## File Structure

**Create:**

| Path | Responsibility |
|---|---|
| `src/lib/embeds/parseEmbed.ts` | Pure: input string → discriminated `ParsedEmbed`. No DOM, no network. |
| `src/lib/embeds/parseEmbed.test.ts` | Unit tests for the parser. |
| `src/lib/embeds/executeScripts.ts` | Re-inject `<script>` tags so injected HTML actually runs. |
| `src/lib/embeds/loadEmbedScript.ts` | Load a platform SDK once, then call its re-parse API. |
| `src/blocks/Embed.ts` | Payload `Block` — one textarea. |
| `src/blocks/Gallery.ts` | Payload `Block` — many images + caption. |
| `src/blocks/Audio.ts` | Payload `Block` — one media file + title. |
| `src/blocks/Html.ts` | Payload `Block` — one textarea. |
| `src/components/articles/blocks/EmbedRenderer.tsx` | Client. Iframe, or injected markup + SDK. |
| `src/components/articles/blocks/GalleryRenderer.tsx` | Server. Responsive grid. |
| `src/components/articles/blocks/AudioRenderer.tsx` | Server. Native `<audio>`. |
| `src/components/articles/blocks/HtmlRenderer.tsx` | Client. Raw injection + script execution. |
| `src/components/articles/blocks/__tests__/renderers.test.tsx` | Renderer tests. |
| `src/components/articles/richTextConverters.tsx` | The shared `articleConverters`. |
| `src/components/articles/__tests__/richTextConverters.test.tsx` | Converter tests. |

**Modify:**

| Path | Change |
|---|---|
| `src/payload.config.ts` | Add `FixedToolbarFeature()` + `BlocksFeature()` to `lexicalEditor`. |
| `src/collections/Media.ts` | Append audio mime types. |
| `src/components/articles/ArticleBody.tsx` | Pass `converters`. |
| `src/components/articles/InArticleAdInjector.tsx` | Pass `converters` to **both** `RichText` calls. |

---

## Task 1: Restore the title column in the articles list

No code. A saved user preference is overriding the already-correct `defaultColumns`.

**Files:**
- Modify: none (database row only)

**Interfaces:**
- Consumes: nothing
- Produces: nothing (no code artifact; later tasks do not depend on this)

- [ ] **Step 1: Confirm the defect is still present**

Use the Neon MCP tool `mcp__neon__run_sql` with `projectId: "broad-snow-50246164"`:

```sql
SELECT id, key, jsonb_path_query_array(value, '$.columns[*] ? (@.accessor == "title")') AS title_col
FROM payload_preferences
WHERE key = 'collection-articles';
```

Expected: one row, `title_col` = `[{"active": false, "accessor": "title"}]`.

If `active` is already `true`, someone fixed it — skip to Step 4 and note it.

- [ ] **Step 2: Flip only the title entry to active**

Patches the one entry rather than deleting the row, so the journalist keeps their `-publishedAt` sort and page size of 10.

```sql
UPDATE payload_preferences
SET value = jsonb_set(
      value,
      '{columns}',
      (SELECT jsonb_agg(
                CASE WHEN c->>'accessor' = 'title'
                     THEN jsonb_set(c, '{active}', 'true'::jsonb)
                     ELSE c END
                ORDER BY ord)
       FROM jsonb_array_elements(value->'columns') WITH ORDINALITY AS t(c, ord))
    )
WHERE key = 'collection-articles';
```

The `WITH ORDINALITY` + `ORDER BY ord` matters: `jsonb_agg` over `jsonb_array_elements` is not order-guaranteed without it, and column order is user-visible.

- [ ] **Step 3: Verify the row, and that nothing else changed**

```sql
SELECT value->'sort' AS sort,
       value->'limit' AS lim,
       jsonb_array_length(value->'columns') AS n_cols,
       jsonb_path_query_array(value, '$.columns[*] ? (@.active == true).accessor') AS active_cols
FROM payload_preferences
WHERE key = 'collection-articles';
```

Expected: `sort` = `"-publishedAt"`, `lim` = `10`, `n_cols` = `16`, and `active_cols` containing `"title"`, `"status"`, `"author"`, `"publishedAt"`.

- [ ] **Step 4: Verify in the admin panel itself**

Open `/admin/collections/articles`, hard-refresh. The Arabic title must be the first column and a working link. Assert on what the panel renders, not on the SQL result — the SQL is a proxy.

- [ ] **Step 5: Commit**

There is no code change, so record the fix in the runbook instead of leaving it undocumented.

Append to `docs/archive-import-runbook.md` under a new `## Admin panel` heading:

```markdown
## Admin panel

### Articles list lost its title column (2026-07-29)

`payload_preferences` key `collection-articles` had `{"active": false, "accessor": "title"}`.
A saved column preference permanently overrides `admin.defaultColumns`, so this is a data
fix, not a code fix. Repaired by flipping that one entry to `true`; see
`docs/superpowers/plans/2026-07-29-journalist-authoring-blocks.md` Task 1 for the SQL.
If it recurs, someone unticked Title in the list's Columns picker.
```

```bash
git add docs/archive-import-runbook.md
git commit -m "fix(admin): restore the title column in the articles list

A saved preference (payload_preferences key collection-articles) had
{\"active\": false} on the title accessor. Saved column preferences override
admin.defaultColumns permanently, so the correct config in Articles.ts could
never take effect. Repaired the row and documented it in the runbook."
```

---

## Task 2: The embed parser

Pure logic, no DOM, no network. All the branching lives here so it can be tested exhaustively without rendering anything.

**Files:**
- Create: `src/lib/embeds/parseEmbed.ts`
- Test: `src/lib/embeds/parseEmbed.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type EmbedPlatform = 'twitter' | 'instagram' | 'facebook' | 'tiktok'`
  - `type ParsedEmbed` — discriminated union on `kind`:
    - `{ kind: 'iframe'; src: string; title: string; ratio: number }`
    - `{ kind: 'script'; html: string; platform: 'twitter' }`
    - `{ kind: 'html'; html: string; platforms: EmbedPlatform[] }`
    - `{ kind: 'invalid' }`
  - `function parseEmbed(input: string | null | undefined): ParsedEmbed`

- [ ] **Step 1: Write the failing test**

Create `src/lib/embeds/parseEmbed.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseEmbed } from "./parseEmbed";

describe("parseEmbed — empty and garbage input", () => {
  it.each([undefined, null, "", "   ", "not a link at all"])("returns invalid for %j", (input) => {
    expect(parseEmbed(input as string).kind).toBe("invalid");
  });
});

describe("parseEmbed — YouTube links become iframes", () => {
  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
  ])("maps %s to the nocookie embed", (url) => {
    const result = parseEmbed(url);
    expect(result.kind).toBe("iframe");
    if (result.kind !== "iframe") throw new Error("unreachable");
    expect(result.src).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(result.ratio).toBeCloseTo(16 / 9);
  });
});

describe("parseEmbed — other platform links", () => {
  it("maps an Instagram post to the /embed path", () => {
    const result = parseEmbed("https://www.instagram.com/p/C1a2B3c4D5e/");
    expect(result).toMatchObject({
      kind: "iframe",
      src: "https://www.instagram.com/p/C1a2B3c4D5e/embed",
    });
  });

  it("keeps the reel path for an Instagram reel", () => {
    const result = parseEmbed("https://www.instagram.com/reel/C1a2B3c4D5e/");
    expect(result).toMatchObject({
      kind: "iframe",
      src: "https://www.instagram.com/reel/C1a2B3c4D5e/embed",
    });
  });

  it("maps a TikTok video to the v2 embed", () => {
    const result = parseEmbed("https://www.tiktok.com/@mfmsport/video/7412345678901234567");
    expect(result).toMatchObject({
      kind: "iframe",
      src: "https://www.tiktok.com/embed/v2/7412345678901234567",
    });
  });

  it("wraps a Facebook post URL in the post plugin", () => {
    const result = parseEmbed("https://www.facebook.com/MFMSport/posts/123456789");
    expect(result.kind).toBe("iframe");
    if (result.kind !== "iframe") throw new Error("unreachable");
    expect(result.src).toContain("facebook.com/plugins/post.php");
    expect(result.src).toContain(encodeURIComponent("https://www.facebook.com/MFMSport/posts/123456789"));
  });

  it("uses the video plugin for a Facebook video URL", () => {
    const result = parseEmbed("https://www.facebook.com/MFMSport/videos/123456789");
    expect(result.kind).toBe("iframe");
    if (result.kind !== "iframe") throw new Error("unreachable");
    expect(result.src).toContain("facebook.com/plugins/video.php");
  });
});

describe("parseEmbed — X/Twitter has no iframe endpoint", () => {
  it.each([
    "https://twitter.com/MFMSport/status/1234567890123456789",
    "https://x.com/MFMSport/status/1234567890123456789",
  ])("returns a script blockquote for %s", (url) => {
    const result = parseEmbed(url);
    expect(result.kind).toBe("script");
    if (result.kind !== "script") throw new Error("unreachable");
    expect(result.platform).toBe("twitter");
    expect(result.html).toContain('class="twitter-tweet"');
    expect(result.html).toContain("/status/1234567890123456789");
  });
});

describe("parseEmbed — pasted markup passes through", () => {
  it("detects the twitter SDK from a pasted blockquote", () => {
    const html = '<blockquote class="twitter-tweet"><a href="https://x.com/a/status/1"></a></blockquote>';
    const result = parseEmbed(html);
    expect(result).toMatchObject({ kind: "html", platforms: ["twitter"] });
    if (result.kind !== "html") throw new Error("unreachable");
    expect(result.html).toBe(html);
  });

  it("detects instagram, facebook and tiktok markers", () => {
    expect(parseEmbed('<blockquote class="instagram-media"></blockquote>')).toMatchObject({ platforms: ["instagram"] });
    expect(parseEmbed('<div class="fb-video" data-href="x"></div>')).toMatchObject({ platforms: ["facebook"] });
    expect(parseEmbed('<blockquote class="tiktok-embed"></blockquote>')).toMatchObject({ platforms: ["tiktok"] });
  });

  it("requires no SDK for a bare iframe", () => {
    const result = parseEmbed('<iframe src="https://example.com/x"></iframe>');
    expect(result).toMatchObject({ kind: "html", platforms: [] });
  });

  it("prefers the markup branch when input contains both a tag and a URL", () => {
    const result = parseEmbed('<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>');
    expect(result.kind).toBe("html");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/lib/embeds/parseEmbed.test.ts`
Expected: FAIL — cannot resolve `./parseEmbed`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/embeds/parseEmbed.ts`:

```ts
/**
 * Turns whatever a journalist pasted into a renderable embed descriptor.
 *
 * Accepts either a plain link or a full embed snippet — the field says so, and
 * journalists paste both. Links resolve to an iframe wherever the platform offers
 * one, so article pages load no third-party SDK. X/Twitter is the sole exception:
 * it has no supported iframe endpoint, so it needs widgets.js.
 *
 * Pure and synchronous by design: no DOM, no network, no oEmbed call. Every
 * branch here is unit-tested in parseEmbed.test.ts.
 */

export type EmbedPlatform = "twitter" | "instagram" | "facebook" | "tiktok";

export type ParsedEmbed =
  | { kind: "iframe"; src: string; title: string; ratio: number }
  | { kind: "script"; html: string; platform: "twitter" }
  | { kind: "html"; html: string; platforms: EmbedPlatform[] }
  | { kind: "invalid" };

const RATIO_VIDEO = 16 / 9;
const RATIO_VERTICAL = 9 / 16;
const RATIO_SOCIAL = 4 / 5;

// Markers that tell us which SDK a pasted snippet needs. A snippet with none of
// these (a bare <iframe>, say) needs no script at all.
const SDK_MARKERS: { platform: EmbedPlatform; pattern: RegExp }[] = [
  { platform: "twitter", pattern: /twitter-tweet/ },
  { platform: "instagram", pattern: /instagram-media/ },
  { platform: "facebook", pattern: /fb-(post|video|page)/ },
  { platform: "tiktok", pattern: /tiktok-embed/ },
];

const YOUTUBE =
  /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;
const INSTAGRAM = /instagram\.com\/(p|reel|tv)\/([A-Za-z0-9_-]+)/;
const TIKTOK = /tiktok\.com\/@[^/]+\/video\/(\d+)/;
const TWITTER = /(?:twitter|x)\.com\/([^/]+)\/status\/(\d+)/;
const FACEBOOK = /facebook\.com\//;

export function parseEmbed(input: string | null | undefined): ParsedEmbed {
  const raw = (input ?? "").trim();
  if (!raw) return { kind: "invalid" };

  // Markup wins over URL detection. A pasted snippet usually *contains* a URL,
  // and the journalist's explicit snippet is the more specific intent.
  if (raw.includes("<")) {
    const platforms = SDK_MARKERS.filter((m) => m.pattern.test(raw)).map((m) => m.platform);
    return { kind: "html", html: raw, platforms };
  }

  if (!/^https?:\/\//i.test(raw)) return { kind: "invalid" };

  const youtube = YOUTUBE.exec(raw);
  if (youtube) {
    return {
      kind: "iframe",
      src: `https://www.youtube-nocookie.com/embed/${youtube[1]}`,
      title: "YouTube",
      ratio: RATIO_VIDEO,
    };
  }

  const instagram = INSTAGRAM.exec(raw);
  if (instagram) {
    return {
      kind: "iframe",
      src: `https://www.instagram.com/${instagram[1]}/${instagram[2]}/embed`,
      title: "Instagram",
      ratio: RATIO_SOCIAL,
    };
  }

  const tiktok = TIKTOK.exec(raw);
  if (tiktok) {
    return {
      kind: "iframe",
      src: `https://www.tiktok.com/embed/v2/${tiktok[1]}`,
      title: "TikTok",
      ratio: RATIO_VERTICAL,
    };
  }

  const twitter = TWITTER.exec(raw);
  if (twitter) {
    const canonical = `https://twitter.com/${twitter[1]}/status/${twitter[2]}`;
    return {
      kind: "script",
      platform: "twitter",
      html: `<blockquote class="twitter-tweet" dir="rtl"><a href="${canonical}"></a></blockquote>`,
    };
  }

  if (FACEBOOK.test(raw)) {
    // Facebook splits its plugin by content type; /videos/ and /watch use video.php.
    const plugin = /\/(videos?|watch)\b/.test(raw) ? "video" : "post";
    return {
      kind: "iframe",
      src: `https://www.facebook.com/plugins/${plugin}.php?href=${encodeURIComponent(raw)}&show_text=true`,
      title: "Facebook",
      ratio: RATIO_SOCIAL,
    };
  }

  return { kind: "invalid" };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/lib/embeds/parseEmbed.test.ts`
Expected: PASS, all cases green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/embeds/parseEmbed.ts src/lib/embeds/parseEmbed.test.ts
git commit -m "feat(embeds): parse a pasted link or snippet into an embed descriptor

Accepts either form because journalists paste both. Links resolve to an iframe
wherever the platform offers one, so article pages load no Facebook or Instagram
SDK -- X/Twitter is the only platform without an iframe endpoint. Pure and
synchronous: no DOM, no network, no oEmbed round-trip on render."
```

---

## Task 3: Browser-side script helpers

Two small client-only modules. Separated from the renderers so the renderers stay declarative and these stay individually replaceable.

**Files:**
- Create: `src/lib/embeds/executeScripts.ts`
- Create: `src/lib/embeds/loadEmbedScript.ts`
- Test: `src/lib/embeds/executeScripts.test.ts`

**Interfaces:**
- Consumes: `EmbedPlatform` from `src/lib/embeds/parseEmbed.ts`
- Produces:
  - `function executeScripts(host: HTMLElement): void`
  - `function loadEmbedScript(platform: EmbedPlatform, host: HTMLElement): Promise<void>`

- [ ] **Step 1: Write the failing test**

`executeScripts` is the one with non-obvious behaviour worth pinning down: HTML assigned via `innerHTML` never executes its `<script>` tags, per the HTML spec. Without this, a pasted snippet renders an inert blockquote forever.

Create `src/lib/embeds/executeScripts.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { executeScripts } from "./executeScripts";

describe("executeScripts", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    delete (window as unknown as Record<string, unknown>).__ran;
  });

  it("runs an inline script that innerHTML left inert", () => {
    const host = document.createElement("div");
    host.innerHTML = '<script>window.__ran = true;</script>';
    document.body.appendChild(host);

    expect((window as unknown as Record<string, unknown>).__ran).toBeUndefined();

    executeScripts(host);

    expect((window as unknown as Record<string, unknown>).__ran).toBe(true);
  });

  it("preserves attributes when re-injecting", () => {
    const host = document.createElement("div");
    host.innerHTML = '<script src="https://example.com/a.js" async charset="utf-8"></script>';
    document.body.appendChild(host);

    executeScripts(host);

    const script = host.querySelector("script");
    expect(script?.getAttribute("src")).toBe("https://example.com/a.js");
    expect(script?.hasAttribute("async")).toBe(true);
    expect(script?.getAttribute("charset")).toBe("utf-8");
  });

  it("does nothing when there are no scripts", () => {
    const host = document.createElement("div");
    host.innerHTML = "<p>مرحبا</p>";
    expect(() => executeScripts(host)).not.toThrow();
    expect(host.innerHTML).toBe("<p>مرحبا</p>");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/lib/embeds/executeScripts.test.ts`
Expected: FAIL — cannot resolve `./executeScripts`.

- [ ] **Step 3: Write both implementations**

Create `src/lib/embeds/executeScripts.ts`:

```ts
/**
 * Re-injects every <script> inside `host` as a fresh element so it actually runs.
 *
 * Assigning markup through innerHTML leaves its <script> tags inert -- the HTML
 * spec says so. A journalist pasting an embed snippet that carries its own loader
 * would otherwise get a blockquote that never turns into a post.
 */
export function executeScripts(host: HTMLElement): void {
  for (const old of Array.from(host.querySelectorAll("script"))) {
    const fresh = document.createElement("script");
    for (const attr of Array.from(old.attributes)) {
      fresh.setAttribute(attr.name, attr.value);
    }
    fresh.text = old.text;
    old.replaceWith(fresh);
  }
}
```

Create `src/lib/embeds/loadEmbedScript.ts`:

```ts
import type { EmbedPlatform } from "./parseEmbed";

/**
 * Loads a platform SDK at most once per page, then asks it to scan `host`.
 *
 * Needed for two paths: a tweet we built ourselves from a URL, and a pasted
 * snippet whose author copied only the markup without the loader. Never rejects
 * -- an ad blocker eating the SDK must leave the article intact.
 */

const SDK_SRC: Record<EmbedPlatform, string> = {
  twitter: "https://platform.twitter.com/widgets.js",
  instagram: "https://www.instagram.com/embed.js",
  facebook: "https://connect.facebook.net/ar_AR/sdk.js#xfbml=1&version=v21.0",
  tiktok: "https://www.tiktok.com/embed.js",
};

const pending = new Map<EmbedPlatform, Promise<void>>();

function injectOnce(platform: EmbedPlatform): Promise<void> {
  const existing = pending.get(platform);
  if (existing) return existing;

  const src = SDK_SRC[platform];
  // The pasted snippet may already carry the loader; don't add a second copy.
  const base = src.split("#")[0];
  if (document.querySelector(`script[src^="${base}"]`)) {
    const resolved = Promise.resolve();
    pending.set(platform, resolved);
    return resolved;
  }

  const promise = new Promise<void>((resolve) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    // Resolve rather than reject: a blocked SDK is a missing embed, not a broken page.
    script.onerror = () => resolve();
    document.body.appendChild(script);
  });

  pending.set(platform, promise);
  return promise;
}

type SdkWindow = {
  twttr?: { widgets?: { load?: (el?: HTMLElement) => void } };
  instgrm?: { Embeds?: { process?: () => void } };
  FB?: { XFBML?: { parse?: (el?: HTMLElement) => void } };
};

export async function loadEmbedScript(platform: EmbedPlatform, host: HTMLElement): Promise<void> {
  await injectOnce(platform);
  const sdk = window as unknown as SdkWindow;

  switch (platform) {
    case "twitter":
      sdk.twttr?.widgets?.load?.(host);
      break;
    case "instagram":
      sdk.instgrm?.Embeds?.process?.();
      break;
    case "facebook":
      sdk.FB?.XFBML?.parse?.(host);
      break;
    case "tiktok":
      // embed.js scans the document itself on load; it exposes no re-parse API.
      break;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/lib/embeds/`
Expected: PASS — both `parseEmbed` and `executeScripts` suites green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/embeds/executeScripts.ts src/lib/embeds/executeScripts.test.ts src/lib/embeds/loadEmbedScript.ts
git commit -m "feat(embeds): run injected scripts and load platform SDKs once

innerHTML leaves <script> tags inert per spec, so a pasted snippet carrying its
own loader would render a blockquote that never becomes a post. loadEmbedScript
deduplicates against a loader the snippet already brought, and resolves rather
than rejects on error -- a blocked SDK is a missing embed, not a broken page."
```

---

## Task 4: Block definitions

Four Payload `Block` config objects. No fields are marked `localized` — see Global Constraints.

**Files:**
- Create: `src/blocks/Embed.ts`, `src/blocks/Gallery.ts`, `src/blocks/Audio.ts`, `src/blocks/Html.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `EmbedBlock`, `GalleryBlock`, `AudioBlock`, `HtmlBlock` — all `import type { Block } from "payload"`. Block slugs, which Task 6's converter map keys off, are exactly `embed`, `gallery`, `audio`, `html`. Field names are `source`, `images` + `caption`, `file` + `title`, `code`.

- [ ] **Step 1: Create the Embed block**

Create `src/blocks/Embed.ts`:

```ts
import type { Block } from "payload";

export const EmbedBlock: Block = {
  slug: "embed",
  interfaceName: "EmbedBlock",
  labels: {
    singular: { en: "Embed", fr: "Intégration", ar: "تضمين" },
    plural: { en: "Embeds", fr: "Intégrations", ar: "تضمينات" },
  },
  fields: [
    {
      name: "source",
      type: "textarea",
      required: true,
      label: {
        en: "Embed code or link",
        fr: "Code d'intégration ou lien",
        ar: "كود التضمين أو الرابط",
      },
      admin: {
        description: {
          ar: "الصق كود التضمين من فيسبوك أو إكس أو إنستغرام أو تيك توك أو يوتيوب — أو الصق الرابط فقط. كلاهما يعمل.",
          fr: "Collez le code d'intégration (Facebook, X, Instagram, TikTok, YouTube) — ou simplement le lien. Les deux fonctionnent.",
          en: "Paste the embed code from Facebook, X, Instagram, TikTok or YouTube — or just paste the link. Either works.",
        },
      },
    },
  ],
};
```

- [ ] **Step 2: Create the Gallery block**

Create `src/blocks/Gallery.ts`:

```ts
import type { Block } from "payload";

export const GalleryBlock: Block = {
  slug: "gallery",
  interfaceName: "GalleryBlock",
  labels: {
    singular: { en: "Photo gallery", fr: "Galerie photo", ar: "معرض صور" },
    plural: { en: "Photo galleries", fr: "Galeries photo", ar: "معارض صور" },
  },
  fields: [
    {
      name: "images",
      type: "upload",
      relationTo: "media",
      hasMany: true,
      required: true,
      label: { en: "Images", fr: "Images", ar: "الصور" },
      admin: {
        description: {
          ar: "اختر صورتين أو أكثر. تُعرض في شبكة متجاوبة بالترتيب الذي تختاره.",
          fr: "Choisissez deux images ou plus. Affichées en grille responsive, dans l'ordre choisi.",
          en: "Pick two or more images. Shown in a responsive grid, in the order you choose.",
        },
      },
    },
    {
      name: "caption",
      type: "text",
      label: { en: "Caption", fr: "Légende", ar: "التعليق" },
    },
  ],
};
```

- [ ] **Step 3: Create the Audio block**

Create `src/blocks/Audio.ts`:

```ts
import type { Block } from "payload";

export const AudioBlock: Block = {
  slug: "audio",
  interfaceName: "AudioBlock",
  labels: {
    singular: { en: "Audio", fr: "Audio", ar: "ملف صوتي" },
    plural: { en: "Audio files", fr: "Fichiers audio", ar: "ملفات صوتية" },
  },
  fields: [
    {
      name: "file",
      type: "upload",
      relationTo: "media",
      required: true,
      label: { en: "Audio file", fr: "Fichier audio", ar: "الملف الصوتي" },
      admin: {
        description: {
          ar: "ارفع ملف MP3 كما ترفع صورة. سيظهر مشغّل صوتي داخل المقال.",
          fr: "Téléversez un MP3 comme une image. Un lecteur audio apparaîtra dans l'article.",
          en: "Upload an MP3 the same way you upload a photo. A player appears in the article.",
        },
      },
    },
    {
      name: "title",
      type: "text",
      label: { en: "Title", fr: "Titre", ar: "العنوان" },
    },
  ],
};
```

- [ ] **Step 4: Create the Html block**

Create `src/blocks/Html.ts`:

```ts
import type { Block } from "payload";

export const HtmlBlock: Block = {
  slug: "html",
  interfaceName: "HtmlBlock",
  labels: {
    singular: { en: "Custom HTML", fr: "HTML personnalisé", ar: "HTML مخصص" },
    plural: { en: "Custom HTML", fr: "HTML personnalisé", ar: "HTML مخصص" },
  },
  fields: [
    {
      name: "code",
      type: "textarea",
      required: true,
      label: { en: "HTML code", fr: "Code HTML", ar: "كود HTML" },
      admin: {
        description: {
          ar: "لمن يعرف HTML. يُدرَج كما هو دون تعديل — تأكّد من مصدره.",
          fr: "Pour ceux qui connaissent le HTML. Inséré tel quel, sans modification — vérifiez la source.",
          en: "For those who know HTML. Inserted as-is, unmodified — be sure of the source.",
        },
      },
    },
  ],
};
```

- [ ] **Step 5: Verify the blocks typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors originating in `src/blocks/`.

Pre-existing errors elsewhere are not this task's problem — confirm none of the reported paths start with `src/blocks/`.

- [ ] **Step 6: Commit**

```bash
git add src/blocks/
git commit -m "feat(blocks): define embed, gallery, audio and custom-HTML blocks

Arabic-first labels with fr/en alongside, matching src/collections. No field is
marked localized: the parent body field already is, so each locale holds its own
copy of the block JSON and nesting localization would be redundant."
```

---

## Task 5: Block renderers

Four presentational components. Each returns `null` rather than throwing when its data is missing — an article page must never 500 on a malformed block.

**Files:**
- Create: `src/components/articles/blocks/EmbedRenderer.tsx`
- Create: `src/components/articles/blocks/GalleryRenderer.tsx`
- Create: `src/components/articles/blocks/AudioRenderer.tsx`
- Create: `src/components/articles/blocks/HtmlRenderer.tsx`
- Test: `src/components/articles/blocks/__tests__/renderers.test.tsx`

**Interfaces:**
- Consumes: `parseEmbed`, `executeScripts`, `loadEmbedScript` from `src/lib/embeds/`; `Media` from `@/payload-types`
- Produces:
  - `EmbedRenderer({ source?: string | null })`
  - `GalleryRenderer({ images?: (number | Media)[] | null; caption?: string | null })`
  - `AudioRenderer({ file?: number | Media | null; title?: string | null })`
  - `HtmlRenderer({ code?: string | null })`

- [ ] **Step 1: Write the failing test**

Create `src/components/articles/blocks/__tests__/renderers.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import type { Media } from "@/payload-types";

const image = (id: number): Media =>
  ({
    id,
    alt: `صورة ${id}`,
    url: `https://cdn.example.com/${id}.jpg`,
    mimeType: "image/jpeg",
    width: 1200,
    height: 800,
    filename: `${id}.jpg`,
    updatedAt: "2026-07-29T00:00:00.000Z",
    createdAt: "2026-07-29T00:00:00.000Z",
  }) as Media;

describe("EmbedRenderer", () => {
  it("renders a lazy iframe for a YouTube link", async () => {
    const { EmbedRenderer } = await import("../EmbedRenderer");
    const { container } = render(<EmbedRenderer source="https://youtu.be/dQw4w9WgXcQ" />);
    const iframe = container.querySelector("iframe");
    expect(iframe?.getAttribute("src")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(iframe?.getAttribute("loading")).toBe("lazy");
  });

  it("reserves an aspect ratio so the embed causes no layout shift", async () => {
    const { EmbedRenderer } = await import("../EmbedRenderer");
    const { container } = render(<EmbedRenderer source="https://youtu.be/dQw4w9WgXcQ" />);
    const box = container.firstElementChild as HTMLElement;
    expect(box.style.aspectRatio).not.toBe("");
  });

  it("renders nothing for empty or unusable input", async () => {
    const { EmbedRenderer } = await import("../EmbedRenderer");
    expect(render(<EmbedRenderer source="" />).container).toBeEmptyDOMElement();
    expect(render(<EmbedRenderer source="hello" />).container).toBeEmptyDOMElement();
  });

  it("injects pasted markup", async () => {
    const { EmbedRenderer } = await import("../EmbedRenderer");
    const { container } = render(
      <EmbedRenderer source='<blockquote class="twitter-tweet"><a href="https://x.com/a/status/1"></a></blockquote>' />,
    );
    expect(container.querySelector("blockquote.twitter-tweet")).not.toBeNull();
  });
});

describe("GalleryRenderer", () => {
  it("renders one img per image plus the caption", async () => {
    const { GalleryRenderer } = await import("../GalleryRenderer");
    const { container, getByText } = render(
      <GalleryRenderer images={[image(1), image(2), image(3)]} caption="من المباراة" />,
    );
    expect(container.querySelectorAll("img")).toHaveLength(3);
    expect(getByText("من المباراة")).toBeTruthy();
  });

  it("renders nothing when empty, null, or holding unpopulated ids", async () => {
    const { GalleryRenderer } = await import("../GalleryRenderer");
    expect(render(<GalleryRenderer images={[]} />).container).toBeEmptyDOMElement();
    expect(render(<GalleryRenderer images={null} />).container).toBeEmptyDOMElement();
    expect(render(<GalleryRenderer images={[7, 8]} />).container).toBeEmptyDOMElement();
  });
});

describe("AudioRenderer", () => {
  it("renders a controls-enabled player with the title", async () => {
    const { AudioRenderer } = await import("../AudioRenderer");
    const mp3 = {
      ...image(9),
      mimeType: "audio/mpeg",
      url: "https://cdn.example.com/9.mp3",
      filename: "9.mp3",
    } as Media;
    const { container, getByText } = render(<AudioRenderer file={mp3} title="مقابلة" />);
    const audio = container.querySelector("audio");
    expect(audio?.getAttribute("src")).toBe("https://cdn.example.com/9.mp3");
    expect(audio?.hasAttribute("controls")).toBe(true);
    expect(getByText("مقابلة")).toBeTruthy();
  });

  it("renders nothing for a missing or unpopulated file", async () => {
    const { AudioRenderer } = await import("../AudioRenderer");
    expect(render(<AudioRenderer file={null} />).container).toBeEmptyDOMElement();
    expect(render(<AudioRenderer file={42} />).container).toBeEmptyDOMElement();
  });
});

describe("HtmlRenderer", () => {
  it("injects the markup as-is", async () => {
    const { HtmlRenderer } = await import("../HtmlRenderer");
    const { container } = render(<HtmlRenderer code='<div id="widget">مرحبا</div>' />);
    expect(container.querySelector("#widget")?.textContent).toBe("مرحبا");
  });

  it("renders nothing for empty or whitespace-only code", async () => {
    const { HtmlRenderer } = await import("../HtmlRenderer");
    expect(render(<HtmlRenderer code="" />).container).toBeEmptyDOMElement();
    expect(render(<HtmlRenderer code="   " />).container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/components/articles/blocks/`
Expected: FAIL — cannot resolve `../EmbedRenderer`.

- [ ] **Step 3: Write the four components**

Create `src/components/articles/blocks/EmbedRenderer.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import { parseEmbed } from "@/lib/embeds/parseEmbed";
import { executeScripts } from "@/lib/embeds/executeScripts";
import { loadEmbedScript } from "@/lib/embeds/loadEmbedScript";

type Props = { source?: string | null };

export function EmbedRenderer({ source }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  // Memoised so the effect below has a stable dependency.
  const parsed = useMemo(() => parseEmbed(source), [source]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    if (parsed.kind === "script") {
      void loadEmbedScript(parsed.platform, host);
      return;
    }
    if (parsed.kind === "html") {
      // Run whatever loader the snippet brought, then fill any gap ourselves.
      executeScripts(host);
      for (const platform of parsed.platforms) {
        void loadEmbedScript(platform, host);
      }
    }
  }, [parsed]);

  if (parsed.kind === "invalid") return null;

  if (parsed.kind === "iframe") {
    return (
      <div
        className="my-6 overflow-hidden rounded-lg bg-muted/40"
        style={{ aspectRatio: String(parsed.ratio) }}
      >
        <iframe
          src={parsed.src}
          title={parsed.title}
          loading="lazy"
          allowFullScreen
          scrolling="no"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          className="h-full w-full border-0"
        />
      </div>
    );
  }

  return (
    <div
      ref={hostRef}
      className="my-6 min-h-[200px] [&_iframe]:max-w-full"
      dangerouslySetInnerHTML={{ __html: parsed.html }}
    />
  );
}
```

Create `src/components/articles/blocks/GalleryRenderer.tsx`:

```tsx
import Image from "next/image";
import type { Media } from "@/payload-types";

type Props = {
  images?: (number | Media)[] | null;
  caption?: string | null;
};

export function GalleryRenderer({ images, caption }: Props) {
  // Unpopulated relationships arrive as bare ids; there is nothing to render for those.
  const docs = (images ?? []).filter(
    (item): item is Media => typeof item === "object" && item !== null && Boolean(item.url),
  );
  if (docs.length === 0) return null;

  return (
    <figure className="not-prose my-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {docs.map((img) => (
          <Image
            key={img.id}
            src={img.url as string}
            alt={img.alt || ""}
            width={img.width ?? 1200}
            height={img.height ?? 800}
            className="h-40 w-full rounded-md object-cover sm:h-48"
          />
        ))}
      </div>
      {caption ? (
        <figcaption className="mt-2 text-center text-sm text-muted-foreground">{caption}</figcaption>
      ) : null}
    </figure>
  );
}
```

Create `src/components/articles/blocks/AudioRenderer.tsx`:

```tsx
import type { Media } from "@/payload-types";

type Props = {
  file?: number | Media | null;
  title?: string | null;
};

export function AudioRenderer({ file, title }: Props) {
  if (typeof file !== "object" || file === null || !file.url) return null;

  return (
    <figure className="not-prose my-6 rounded-lg border border-border bg-muted/40 p-4">
      {title ? <figcaption className="mb-2 font-semibold">{title}</figcaption> : null}
      <audio controls preload="metadata" src={file.url} className="w-full">
        <a href={file.url}>{file.filename}</a>
      </audio>
    </figure>
  );
}
```

Create `src/components/articles/blocks/HtmlRenderer.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { executeScripts } from "@/lib/embeds/executeScripts";

type Props = { code?: string | null };

/**
 * Injects author-supplied HTML verbatim.
 *
 * This is stored XSS by design and by decision -- see the Security section of the
 * design spec. The mitigation is authorization (only authenticated editors can
 * write articles), not sanitization: sanitizing would strip exactly the iframes
 * and scripts that make the feature worth having.
 */
export function HtmlRenderer({ code }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const html = code?.trim() ?? "";

  useEffect(() => {
    if (hostRef.current) executeScripts(hostRef.current);
  }, [html]);

  if (!html) return null;

  return (
    <div
      ref={hostRef}
      className="my-6 [&_iframe]:max-w-full"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/components/articles/blocks/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/articles/blocks/
git commit -m "feat(articles): render embed, gallery, audio and custom-HTML blocks

Every renderer returns null rather than throwing on missing or unpopulated data:
a malformed block must not turn an article's 200 into a 500, which the staged
indexation release depends on. Iframes are lazy and sit in a reserved
aspect-ratio box so embeds cause no layout shift."
```

---

## Task 6: Shared converters, wired into all three call sites

Blocks render as **nothing** unless converters are passed to `RichText`. There are three call sites and all three need them.

**Files:**
- Create: `src/components/articles/richTextConverters.tsx`
- Test: `src/components/articles/__tests__/richTextConverters.test.tsx`
- Modify: `src/components/articles/ArticleBody.tsx`
- Modify: `src/components/articles/InArticleAdInjector.tsx:36` and `:40`

**Interfaces:**
- Consumes: the four renderers from Task 5; `JSXConvertersFunction` from `@payloadcms/richtext-lexical/react`
- Produces: `const articleConverters: JSXConvertersFunction`

- [ ] **Step 1: Write the failing test**

Create `src/components/articles/__tests__/richTextConverters.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import type { Media } from "@/payload-types";
import { articleConverters } from "../richTextConverters";

// The converters function is handed the library's defaults; for these tests an
// empty object is enough, since we only assert on what we add.
const converters = articleConverters({ defaultConverters: {} as never }) as Record<string, any>;

function renderConverter(key: string, node: unknown) {
  const converter = key === "upload" ? converters.upload : converters.blocks[key];
  return render(<>{converter({ node, childIndex: 0, converters, nodesToJSX: () => [], parent: {} })}</>);
}

const photo = {
  id: 1,
  alt: "لاعب",
  caption: "الهدف الأول",
  url: "https://cdn.example.com/1.jpg",
  mimeType: "image/jpeg",
  width: 1200,
  height: 800,
  filename: "1.jpg",
} as Media;

describe("articleConverters", () => {
  it("registers a converter for every block slug", () => {
    expect(Object.keys(converters.blocks).sort()).toEqual(["audio", "embed", "gallery", "html"]);
  });

  it("renders an embed block as an iframe", () => {
    const { container } = renderConverter("embed", {
      type: "block",
      fields: { blockType: "embed", source: "https://youtu.be/dQw4w9WgXcQ" },
    });
    expect(container.querySelector("iframe")).not.toBeNull();
  });

  it("renders a gallery block", () => {
    const { container } = renderConverter("gallery", {
      type: "block",
      fields: { blockType: "gallery", images: [photo], caption: null },
    });
    expect(container.querySelectorAll("img")).toHaveLength(1);
  });

  it("renders an audio block", () => {
    const { container } = renderConverter("audio", {
      type: "block",
      fields: {
        blockType: "audio",
        file: { ...photo, mimeType: "audio/mpeg", url: "https://cdn.example.com/1.mp3" },
        title: null,
      },
    });
    expect(container.querySelector("audio")).not.toBeNull();
  });

  it("renders a custom-HTML block", () => {
    const { container } = renderConverter("html", {
      type: "block",
      fields: { blockType: "html", code: "<p id='x'>hi</p>" },
    });
    expect(container.querySelector("#x")).not.toBeNull();
  });

  it("renders an uploaded image as a figure carrying the media caption", () => {
    const { container } = renderConverter("upload", { type: "upload", value: photo, fields: {} });
    expect(container.querySelector("figure")).not.toBeNull();
    expect(container.querySelector("figcaption")?.textContent).toBe("الهدف الأول");
  });

  it("links rather than throws for a non-image upload", () => {
    const { container } = renderConverter("upload", {
      type: "upload",
      value: { ...photo, mimeType: "audio/mpeg", url: "https://cdn.example.com/1.mp3" },
      fields: {},
    });
    expect(container.querySelector("a")?.getAttribute("href")).toBe("https://cdn.example.com/1.mp3");
  });

  it("returns null instead of throwing when an upload has no mimeType", () => {
    expect(() =>
      renderConverter("upload", { type: "upload", value: { ...photo, mimeType: null }, fields: {} }),
    ).not.toThrow();
  });

  it("returns null instead of throwing for an unpopulated upload", () => {
    expect(() => renderConverter("upload", { type: "upload", value: 5, fields: {} })).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/components/articles/__tests__/richTextConverters.test.tsx`
Expected: FAIL — cannot resolve `../richTextConverters`.

- [ ] **Step 3: Write the converters**

Create `src/components/articles/richTextConverters.tsx`:

```tsx
import Image from "next/image";
import type { JSXConvertersFunction } from "@payloadcms/richtext-lexical/react";
import type { Media } from "@/payload-types";
import { EmbedRenderer } from "./blocks/EmbedRenderer";
import { GalleryRenderer } from "./blocks/GalleryRenderer";
import { AudioRenderer } from "./blocks/AudioRenderer";
import { HtmlRenderer } from "./blocks/HtmlRenderer";

/**
 * Converters shared by every RichText call site.
 *
 * Blocks render as nothing unless converters are passed, so all three call sites
 * (ArticleBody, and both halves of InArticleAdInjector) must use this.
 */

type BlockNode = { fields?: Record<string, unknown> };
type UploadNode = { value?: unknown; fields?: { alt?: string } };

export const articleConverters: JSXConvertersFunction = ({ defaultConverters }) => ({
  ...defaultConverters,

  // Replaces the library default, which renders a bare <img> and dereferences
  // mimeType without a null guard.
  upload: ({ node }: { node: UploadNode }) => {
    const doc = node.value;
    if (!doc || typeof doc !== "object") return null;

    const media = doc as Media;
    if (!media.url) return null;

    if (!media.mimeType?.startsWith("image")) {
      return (
        <a href={media.url} rel="noopener noreferrer">
          {media.filename}
        </a>
      );
    }

    return (
      <figure className="not-prose my-6">
        <Image
          src={media.url}
          alt={node.fields?.alt || media.alt || ""}
          width={media.width ?? 1200}
          height={media.height ?? 675}
          sizes="(max-width: 768px) 100vw, 720px"
          className="h-auto w-full rounded-lg"
        />
        {media.caption ? (
          <figcaption className="mt-2 text-center text-sm text-muted-foreground">
            {media.caption}
          </figcaption>
        ) : null}
      </figure>
    );
  },

  blocks: {
    embed: ({ node }: { node: BlockNode }) => (
      <EmbedRenderer source={node.fields?.source as string | undefined} />
    ),
    gallery: ({ node }: { node: BlockNode }) => (
      <GalleryRenderer
        images={node.fields?.images as (number | Media)[] | undefined}
        caption={node.fields?.caption as string | undefined}
      />
    ),
    audio: ({ node }: { node: BlockNode }) => (
      <AudioRenderer
        file={node.fields?.file as number | Media | undefined}
        title={node.fields?.title as string | undefined}
      />
    ),
    html: ({ node }: { node: BlockNode }) => (
      <HtmlRenderer code={node.fields?.code as string | undefined} />
    ),
  },
});
```

- [ ] **Step 4: Wire ArticleBody**

Modify `src/components/articles/ArticleBody.tsx` — add the import and the prop:

```tsx
import { RichText } from "@payloadcms/richtext-lexical/react";
import { articleConverters } from "./richTextConverters";
```

and change line 12 from `<RichText data={content} />` to:

```tsx
      <RichText data={content} converters={articleConverters} />
```

- [ ] **Step 5: Wire both halves of InArticleAdInjector**

Modify `src/components/articles/InArticleAdInjector.tsx`. Add to the imports:

```tsx
import { articleConverters } from "./richTextConverters";
```

Then update **all three** `RichText` usages — the early return at line 21 as well as the `before` and `after` halves at lines 36 and 40:

```tsx
    return <RichText data={content as never} converters={articleConverters} />;
```

```tsx
        <RichText data={before as never} converters={articleConverters} />
```

```tsx
        <RichText data={after as never} converters={articleConverters} />
```

- [ ] **Step 6: Run the full suite**

Run: `pnpm test:run`
Expected: PASS, including the pre-existing `InArticleAdInjector` tests — its mock of `@payloadcms/richtext-lexical/react` ignores the extra prop.

- [ ] **Step 7: Verify no `RichText` call site was missed**

Run: `grep -rn "<RichText" src/ | grep -v "converters"`
Expected: **no output**. Any line printed is a call site that will silently render blocks as nothing.

- [ ] **Step 8: Commit**

```bash
git add src/components/articles/richTextConverters.tsx src/components/articles/__tests__/richTextConverters.test.tsx src/components/articles/ArticleBody.tsx src/components/articles/InArticleAdInjector.tsx
git commit -m "feat(articles): share rich-text converters across every RichText call site

Blocks render as nothing unless converters are passed, and there are three call
sites -- ArticleBody plus both halves of InArticleAdInjector. Also replaces the
library's upload converter, which renders a bare <img> and dereferences mimeType
without a null guard; ours emits a figure with the media caption."
```

---

## Task 7: Turn the features on

The editor change and the Media change together — neither is independently useful, and they share one verification pass.

**Files:**
- Modify: `src/payload.config.ts`
- Modify: `src/collections/Media.ts`

**Interfaces:**
- Consumes: the four blocks from Task 4
- Produces: nothing consumed by later code

- [ ] **Step 1: Record the table list before the change**

The spec's central claim is zero DDL. Capture the evidence to compare against.

Use `mcp__neon__run_sql` with `projectId: "broad-snow-50246164"`:

```sql
SELECT count(*) AS table_count FROM information_schema.tables WHERE table_schema = 'public';
```

Write the number down. It must be identical in Step 6.

- [ ] **Step 2: Enable the toolbar and the blocks**

Modify `src/payload.config.ts`. Change the editor import:

```ts
import { lexicalEditor, FixedToolbarFeature, BlocksFeature } from '@payloadcms/richtext-lexical'
```

Add the block imports below the existing collection imports:

```ts
import { EmbedBlock } from './blocks/Embed'
import { GalleryBlock } from './blocks/Gallery'
import { AudioBlock } from './blocks/Audio'
import { HtmlBlock } from './blocks/Html'
```

Replace `editor: lexicalEditor(),` with:

```ts
  // defaultFeatures is spread first so UploadFeature (content images) and
  // everything else already in use is preserved. FixedToolbarFeature is what
  // makes any of it discoverable: without it the only entry point is typing "/"
  // and knowing the English command name.
  editor: lexicalEditor({
    features: ({ defaultFeatures }) => [
      ...defaultFeatures,
      FixedToolbarFeature(),
      BlocksFeature({ blocks: [EmbedBlock, GalleryBlock, AudioBlock, HtmlBlock] }),
    ],
  }),
```

- [ ] **Step 3: Let Media accept audio**

Modify `src/collections/Media.ts`. Replace the `mimeTypes` line with:

```ts
    mimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/svg+xml",
      // Audio for the article Audio block. Payload skips imageSizes for
      // non-image uploads, so this needs no schema change. Note these files are
      // far heavier than photos in the Blob store.
      "audio/mpeg",
      "audio/mp4",
      "audio/ogg",
      "audio/wav",
    ],
```

- [ ] **Step 4: Regenerate types and the import map**

```bash
pnpm generate:types
pnpm generate:importmap
```

Both connect to the database but only read; `push: false` in the Postgres adapter prevents any schema sync.

- [ ] **Step 5: Verify the blocks reached the generated types**

Run: `grep -n "EmbedBlock\|GalleryBlock\|AudioBlock\|HtmlBlock" src/payload-types.ts`
Expected: an `export interface` line for each of the four.

- [ ] **Step 6: Verify zero DDL — the spec's central claim**

Re-run the count from Step 1:

```sql
SELECT count(*) AS table_count FROM information_schema.tables WHERE table_schema = 'public';
```

Expected: **identical** to Step 1.

If it changed, **stop**. A new table means Lexical blocks are not serializing into the `jsonb` column as the spec assumed, and the zero-DDL premise is wrong. Report it rather than writing a migration.

- [ ] **Step 7: Verify the build and the suite**

```bash
pnpm test:run
pnpm build
```

Expected: both pass. A green build is not a behavioural assertion — Task 8 does the real verification — but a red one blocks everything.

- [ ] **Step 8: Commit**

```bash
git add src/payload.config.ts src/collections/Media.ts src/payload-types.ts src/app/\(payload\)/admin/importMap.js
git commit -m "feat(admin): add a fixed toolbar and the four content blocks

UploadFeature was already enabled and UploadJSXConverter already rendered, so
content images have always worked -- what was missing is discoverability. The
default feature set has only an inline toolbar, which appears on text selection,
so the sole entry point was typing '/' and knowing the English command name.

Media now accepts audio mime types for the Audio block. Verified zero new tables:
lexical block nodes serialize into the existing articles_locales.body jsonb
column, so no migration is needed."
```

---

## Task 8: Verify on production, on the served bytes

A green build proves nothing about what a reader receives. This task follows `docs/verification-principles.md`.

**Files:**
- Modify: `CLAUDE.md` (session state)

**Interfaces:**
- Consumes: everything
- Produces: nothing

- [ ] **Step 1: Open a PR and deploy**

```bash
git push -u origin feat/journalist-authoring-blocks
gh pr create --title "feat: journalist authoring blocks (embed, image, gallery, audio, HTML)" --body "$(cat <<'EOF'
## What

Gives journalists a visible toolbar in the article editor with five insertable things: content image, social embed, photo gallery, audio, and custom HTML. Also restores the missing title column in the articles list.

## Two symptoms had causes different from the report

- **The list title is a data problem.** `defaultColumns` and `useAsTitle` were already correct; `payload_preferences` row `id=8` had `{"active": false}` on the title accessor, and a saved preference overrides `defaultColumns` permanently.
- **Content images already worked.** `UploadFeature` and `UploadJSXConverter` are both Payload defaults. What was missing is a fixed toolbar — the default set has only an inline toolbar, so the sole entry point was typing `/` and knowing the English command name.

## Zero DDL

`articles_locales.body` is `jsonb` and lexical block nodes serialize inside it, so no migration is written or run. Verified by comparing `information_schema.tables` counts before and after.

## Trade-off accepted

The custom-HTML block and the pasted-markup path of the embed block inject author-supplied HTML. This is stored XSS by design — the mitigation is authorization, not sanitization, since sanitizing would strip exactly the iframes and scripts that make the feature useful. Same trust model WordPress ships with.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Merge once CI is green, and wait for the Vercel production deployment to finish.

- [ ] **Step 2: Confirm the toolbar and insert every block**

In `/admin`, create a draft article and use the fixed toolbar to insert **all five**: a content image, a YouTube link in an embed block, a gallery of three images, an MP3, and a trivial custom-HTML snippet. Publish it.

Confirm while editing: the toolbar is visible without selecting text, and its dropdown lists the blocks with **Arabic** labels.

- [ ] **Step 3: Assert on the served bytes**

Substitute the published slug. `grep -c` counts matching *lines* and the HTML is minified into one line, so `grep -o … | wc -l` is mandatory.

```bash
URL="https://www.mfmsport.ma/ar/articles/<slug>"

curl -s -o /dev/null -w "status=%{http_code}\n" "$URL"
curl -s "$URL" > /tmp/article.html

echo "iframes:  $(grep -o '<iframe' /tmp/article.html | wc -l)"
echo "audio:    $(grep -o '<audio' /tmp/article.html | wc -l)"
echo "figures:  $(grep -o '<figure' /tmp/article.html | wc -l)"
echo "imgs:     $(grep -o '<img' /tmp/article.html | wc -l)"
```

Expected: `status=200`; iframes ≥ 1; audio = 1; figures ≥ 5 (one image + one gallery + one audio, plus any others); imgs ≥ 4 (one content image + three gallery images), and more if the page has a hero.

- [ ] **Step 4: Confirm the landmines held**

```bash
echo "ad scripts on a 404: $(curl -s https://www.mfmsport.ma/ar/transfers | grep -o 'adsbygoogle.js' | wc -l)"
curl -s -o /dev/null -w "404 status=%{http_code}\n" https://www.mfmsport.ma/ar/transfers
```

Expected: `0` ad scripts, `404` status. This confirms the editor change did not disturb the error-page ad exclusion.

- [ ] **Step 5: Confirm the articles list**

Open `/admin/collections/articles`. The Arabic title is the first column and links to the edit view.

- [ ] **Step 6: Record the outcome in CLAUDE.md**

Add a section under `## Session state`, filling in the real observed numbers rather than the expectations above:

```markdown
### Journalist authoring blocks — shipped

Deployed <date>. Article editor now has a fixed toolbar with five insertable
things: content image, embed (Facebook / X / Instagram / TikTok / YouTube),
photo gallery, audio, custom HTML.

Zero DDL: lexical block nodes serialize into `articles_locales.body` (jsonb).
Table count in `public` unchanged at <N> before and after.

Verified on the served bytes of a test article: HTTP <status>, <n> iframes,
<n> audio, <n> figures, <n> imgs. 404s still carry 0 ad scripts.

The articles-list title column was a saved preference
(`payload_preferences` key `collection-articles`, `{"active": false}` on the
title accessor), not a code defect — `defaultColumns` was already correct.
```

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: record the journalist authoring blocks release and its verification"
```

---

## Self-Review

**Spec coverage** — every section maps to a task:

| Spec section | Task |
|---|---|
| Problem 1 — social embeds | 2, 3, 4, 5, 6, 7 |
| Problem 2 — content images | 6 (upload converter), 7 (toolbar makes it discoverable) |
| Problem 3 — gallery / audio / custom HTML | 4, 5, 6, 7 |
| Problem 4 — list title | 1 |
| Zero DDL claim | 7 Steps 1 and 6 (before/after table count) |
| Architecture 1 — editor features | 7 |
| Architecture 2 — block definitions | 4 |
| Architecture 3 — embed parser | 2 |
| Architecture 4 — block renderers | 5 |
| Architecture 5 — shared converters | 6 |
| Architecture 6 — three call sites | 6 Steps 4, 5, 7 |
| Architecture 7 — Media audio | 7 Step 3 |
| Architecture 8 — preference repair | 1 |
| Security | 5 (documented in `HtmlRenderer`), 8 (PR body) |
| Error handling table | 5 tests, 6 tests |
| Testing | 2, 3, 5, 6 unit; 8 production |
| Rollback | no task — reversing Task 7's two lines is the rollback |

**Two additions beyond the spec**, both discovered while reading the installed source:

- `executeScripts` (Task 3). The spec assumed injected markup would work; `innerHTML` leaves `<script>` tags inert per the HTML spec, so a pasted snippet carrying its own loader would render an inert blockquote. Without this, the custom-HTML block is decorative.
- The upload converter's `mimeType` null guard (Task 6). The library default calls `uploadDoc.mimeType.startsWith(...)` unguarded. Production currently has 0 rows with a null `mimeType`, so this is defensive rather than a live bug fix — but the "no renderer may throw" constraint requires it.

**Placeholder scan** — no TBD/TODO. Every code step carries complete code; `<slug>`, `<date>` and `<N>` in Task 8 are values observed at runtime, not deferred decisions.

**Type consistency** — `ParsedEmbed` uses `ratio` in Task 2, Task 5's renderer, and Task 5's test. `EmbedPlatform` is defined in `parseEmbed.ts` and imported by `loadEmbedScript.ts`. Block slugs `embed`/`gallery`/`audio`/`html` and field names `source`/`images`/`caption`/`file`/`title`/`code` match across Tasks 4, 5 and 6.
