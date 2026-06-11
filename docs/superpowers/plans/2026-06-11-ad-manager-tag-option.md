# Ad-Manager Tag Option Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin choose, per ad placement, to paste an ad-manager embed snippet (Google Ad Manager / AdSense / any network) instead of uploading a static image, and have the network fill the slot automatically — without changing the existing static-image flow.

**Architecture:** Add a `type` discriminator (`image` | `tag`) plus an `embedCode` text field to the existing Payload `Ads` collection. The data layer (`groupAds`) maps tag ads into a new `AdItem` variant. A new `AdEmbed` client component injects the embed HTML and re-executes its `<script>` tags. The single rendering entry point — `AdCarousel` — detects a tag ad in a slot and renders the embed standalone (the network owns the slot, so no rotation), otherwise behaves exactly as today. Because all six admin placements (top-banner, hero-news, news-videos, videos-matches, news-card, article-sidebar) already render through `AdCarousel`, this one branch covers every placement.

**Tech Stack:** Next.js 16.2.4 (App Router), React 19, Payload CMS 3.84.0 + `@payloadcms/db-postgres` (Neon), TypeScript 5.7, Vitest 3 + Testing Library, Tailwind.

**Decisions locked in (from brainstorming):**
- Tag format = **generic embed code** (free-text HTML/JS snippet; works for any network).
- Tag option available on **all 6 placements**.
- A tag ad is **standalone** — if a placement has a tag ad, render only the tag (no carousel, no image mixing).

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `src/collections/Ads.ts` | Modify | Add `type` + `embedCode` fields; make `image` conditional on `type !== "tag"` |
| `src/payload-types.ts` | Regenerate | Generated `Ad` interface gains `type` + `embedCode`, `image` becomes nullable |
| `src/migrations/20260611_000000_ads_tag.ts` | Create | DB columns `type` (enum) + `embed_code`; drop `image_id` NOT NULL |
| `src/migrations/index.ts` | Modify | Register the new migration |
| `src/lib/payload/ads.ts` | Modify | Extend `AdItem` (image\|tag); `groupAds` maps tag ads |
| `src/lib/payload/__tests__/ads.test.ts` | Modify | Update image expectations; add tag-mapping tests |
| `src/components/ads/AdEmbed.tsx` | Create | Client component: inject embed HTML + re-execute scripts |
| `src/components/ads/__tests__/AdEmbed.test.tsx` | Create | Test markup injection, sizing, script recreation |
| `src/components/ads/AdCarousel.tsx` | Modify | Branch to `AdEmbed` when slot has a tag ad |
| `src/components/ads/__tests__/AdCarousel.test.tsx` | Modify | Add `type` to fixtures; add tag-rendering tests |

No changes needed to page files, `scripts/seed-ads.ts`, `LeagueNewsSection.tsx`, `NewsGrid2x2.tsx`, or `ArticleGrid.tsx` — they pass `AdItem[]` straight through to `AdCarousel`.

---

## Task 1: Add `type` and `embedCode` fields to the Ads collection

**Files:**
- Modify: `src/collections/Ads.ts:25-67` (the `fields` array) and `src/collections/Ads.ts:18` (`defaultColumns`)

This task is config + type regeneration; it has no unit test. Verification is a successful type generation that shows the new fields on the `Ad` interface.

- [ ] **Step 1: Add the `type` field and make `image` conditional**

In `src/collections/Ads.ts`, update `defaultColumns` (line 18) from:

```ts
    defaultColumns: ["name", "placement", "active", "order"],
```

to:

```ts
    defaultColumns: ["name", "type", "placement", "active", "order"],
```

Then replace the **`image`** field block (currently lines 32-41):

```ts
    {
      name: "image",
      type: "upload",
      relationTo: "media",
      required: true,
      admin: {
        description:
          "Banners: design ~1600×376 (wide). News cards: design 16:9 (e.g. 600×400). Article side rail: design 300×600 (vertical).",
      },
    },
```

with this — a `type` selector inserted **before** `image`, and `image` made conditional (no longer unconditionally `required`):

```ts
    {
      name: "type",
      type: "select",
      required: true,
      defaultValue: "image",
      options: [
        { label: "Image upload (static creative we host)", value: "image" },
        { label: "Ad-manager tag (embed code — network fills the slot)", value: "tag" },
      ],
      admin: {
        description:
          "Image = upload a creative. Ad-manager tag = paste an embed snippet from your network (Google Ad Manager, AdSense, etc.) and it fills the slot automatically.",
      },
    },
    {
      name: "image",
      type: "upload",
      relationTo: "media",
      admin: {
        condition: (_, siblingData) => siblingData?.type !== "tag",
        description:
          "Banners: design ~1600×376 (wide). News cards: design 16:9 (e.g. 600×400). Article side rail: design 300×600 (vertical). Only used for Image-type ads.",
      },
      validate: (value, { siblingData }) => {
        const t = (siblingData as { type?: string })?.type;
        if (t !== "tag" && !value) return "An image is required for image-type ads.";
        return true;
      },
    },
    {
      name: "embedCode",
      type: "textarea",
      admin: {
        condition: (_, siblingData) => siblingData?.type === "tag",
        description:
          "Paste the full ad snippet from your network (the <ins>/<script> code). It runs as-is and the network fills the slot. Leave Image empty for tag ads.",
      },
      validate: (value, { siblingData }) => {
        const t = (siblingData as { type?: string })?.type;
        if (t === "tag" && (typeof value !== "string" || !value.trim())) {
          return "Paste the ad-manager embed code for tag-type ads.";
        }
        return true;
      },
    },
```

Leave the `linkUrl`, `placement`, `active`, and `order` fields exactly as they are (they follow after `embedCode`).

- [ ] **Step 2: Regenerate Payload types**

Run: `pnpm generate:types`
Expected: completes without error and rewrites `src/payload-types.ts`.

- [ ] **Step 3: Verify the generated `Ad` interface gained the fields**

Run: `pnpm exec grep -nE "type\??:|embedCode\??:|image\??:" src/payload-types.ts | grep -i -A0 ad` is brittle; instead open `src/payload-types.ts`, find `export interface Ad {`, and confirm it now contains:

```ts
  type: 'image' | 'tag';
  image?: (number | null) | Media;
  embedCode?: string | null;
```

Expected: `type` is present (required), `image` is now optional/nullable, `embedCode` is present. (Exact optionality markers may vary slightly by Payload version; the key checks are that all three appear and `image` is no longer non-null required.)

- [ ] **Step 4: Commit**

```bash
git add src/collections/Ads.ts src/payload-types.ts
git commit -m "feat(ads): add image|tag type + embedCode field to Ads collection"
```

---

## Task 2: Database migration for the new columns

**Files:**
- Create: `src/migrations/20260611_000000_ads_tag.ts`
- Modify: `src/migrations/index.ts`

Local dev uses Payload `push` (columns sync automatically when you restart `pnpm dev`). This migration file is the production deploy path and keeps the migration history consistent — the repo already ships migrations in this exact style (see `src/migrations/20260607_165307_ads.ts`).

- [ ] **Step 1: Create the migration file**

Create `src/migrations/20260611_000000_ads_tag.ts` with exactly:

```ts
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_ads_type" AS ENUM('image', 'tag');
  ALTER TABLE "ads" ADD COLUMN "type" "enum_ads_type" DEFAULT 'image' NOT NULL;
  ALTER TABLE "ads" ADD COLUMN "embed_code" varchar;
  ALTER TABLE "ads" ALTER COLUMN "image_id" DROP NOT NULL;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Note: re-adding NOT NULL will fail if any tag ad (image_id IS NULL) exists.
  // Delete tag-type ads before rolling back.
  await db.execute(sql`
   ALTER TABLE "ads" ALTER COLUMN "image_id" SET NOT NULL;
  ALTER TABLE "ads" DROP COLUMN "embed_code";
  ALTER TABLE "ads" DROP COLUMN "type";
  DROP TYPE "public"."enum_ads_type";`)
}
```

- [ ] **Step 2: Register the migration**

In `src/migrations/index.ts`, add the import after line 4:

```ts
import * as migration_20260611_000000_ads_tag from './20260611_000000_ads_tag';
```

and add this object as the **last** entry of the `migrations` array (after the `20260607_165307_ads` entry, keeping the trailing structure valid):

```ts
  {
    up: migration_20260611_000000_ads_tag.up,
    down: migration_20260611_000000_ads_tag.down,
    name: '20260611_000000_ads_tag',
  },
```

- [ ] **Step 3: Type-check the migration files**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no errors referencing `src/migrations/`. (Pre-existing errors elsewhere, if any, are out of scope — confirm none are in the two files you touched.)

- [ ] **Step 4: Commit**

```bash
git add src/migrations/20260611_000000_ads_tag.ts src/migrations/index.ts
git commit -m "feat(ads): migration for ads.type + embed_code, nullable image_id"
```

---

## Task 3: Extend `AdItem` and map tag ads in `groupAds`

**Files:**
- Modify: `src/lib/payload/ads.ts:24-29` (`AdItem` type) and `src/lib/payload/ads.ts:54-70` (`groupAds`)
- Test: `src/lib/payload/__tests__/ads.test.ts`

- [ ] **Step 1: Update the tests to the new shape (write the failing test)**

Replace the entire body of `src/lib/payload/__tests__/ads.test.ts` with:

```ts
// src/lib/payload/__tests__/ads.test.ts
import { describe, it, expect } from "vitest";
import type { Ad } from "@/payload-types";
import { groupAds } from "@/lib/payload/ads";

// Minimal fake Payload docs (image populated to depth 1). Cast to Ad — these
// stubs intentionally omit timestamp fields groupAds never reads.
const doc = (over: Record<string, unknown>) =>
  ({
    id: 1,
    name: "Ad",
    type: "image",
    placement: "top-banner",
    linkUrl: null,
    image: { url: "https://blob/x.jpg", alt: "alt text", sizes: {} },
    ...over,
  }) as unknown as Ad;

describe("groupAds", () => {
  it("returns an entry for every placement, empty when no docs", () => {
    const g = groupAds([]);
    expect(Object.keys(g).sort()).toEqual(
      [
        "article-sidebar",
        "hero-news",
        "news-card",
        "news-videos",
        "top-banner",
        "videos-matches",
      ].sort(),
    );
    expect(g["top-banner"]).toEqual([]);
  });

  it("maps an image doc into an image AdItem under its placement", () => {
    const g = groupAds([doc({ id: 7, placement: "hero-news", linkUrl: "https://ex.com" })]);
    expect(g["hero-news"]).toEqual([
      {
        id: 7,
        type: "image",
        imageUrl: "https://blob/x.jpg",
        alt: "alt text",
        linkUrl: "https://ex.com",
      },
    ]);
    expect(g["top-banner"]).toEqual([]);
  });

  it("prefers media alt, falls back to the ad name", () => {
    const g = groupAds([
      doc({ id: 2, image: { url: "https://blob/y.jpg", alt: "", sizes: {} }, name: "Fallback" }),
    ]);
    expect(g["top-banner"][0].alt).toBe("Fallback");
  });

  it("skips image docs whose image has no usable URL", () => {
    const g = groupAds([doc({ id: 3, image: null })]);
    expect(g["top-banner"]).toEqual([]);
  });

  it("treats a doc with no type as an image ad (legacy rows)", () => {
    const g = groupAds([doc({ id: 11, type: undefined })]);
    expect(g["top-banner"][0].type).toBe("image");
  });

  it("maps a tag ad into a tag AdItem (no image needed)", () => {
    const g = groupAds([
      doc({ id: 9, type: "tag", embedCode: "<ins>x</ins>", image: null, placement: "news-card" }),
    ]);
    expect(g["news-card"]).toEqual([{ id: 9, type: "tag", embedCode: "<ins>x</ins>" }]);
  });

  it("skips a tag ad whose embed code is blank", () => {
    const g = groupAds([doc({ id: 10, type: "tag", embedCode: "   ", image: null })]);
    expect(g["top-banner"]).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/lib/payload/__tests__/ads.test.ts`
Expected: FAIL — image expectations now include `type: "image"` which `groupAds` does not yet emit, and the tag tests expect tag handling that does not exist.

- [ ] **Step 3: Update `AdItem` and `groupAds`**

In `src/lib/payload/ads.ts`, replace the `AdItem` type (lines 24-29):

```ts
export type AdItem = {
  id: number | string;
  imageUrl: string;
  alt: string;
  linkUrl?: string;
};
```

with:

```ts
export type AdItem = {
  id: number | string;
  type: "image" | "tag";
  imageUrl?: string;
  alt?: string;
  linkUrl?: string;
  embedCode?: string;
};
```

Then replace the `groupAds` function (lines 54-70):

```ts
// Pure: turn populated Payload ad docs into AdItems grouped by placement.
export function groupAds(docs: Ad[]): AdsByPlacement {
  const groups = emptyGroups();
  for (const ad of docs) {
    const placement = ad.placement as AdPlacement;
    if (!groups[placement]) continue;
    const imageUrl = adImageUrl(ad.image);
    if (!imageUrl) continue;
    groups[placement].push({
      id: ad.id,
      imageUrl,
      alt: getImageAlt(ad.image) || ad.name,
      linkUrl: ad.linkUrl ?? undefined,
    });
  }
  return groups;
}
```

with:

```ts
// Pure: turn populated Payload ad docs into AdItems grouped by placement.
export function groupAds(docs: Ad[]): AdsByPlacement {
  const groups = emptyGroups();
  for (const ad of docs) {
    const placement = ad.placement as AdPlacement;
    if (!groups[placement]) continue;

    // A tag ad owns its slot: no image, the network fills it via the snippet.
    if (ad.type === "tag") {
      const embedCode = ad.embedCode?.trim();
      if (!embedCode) continue;
      groups[placement].push({ id: ad.id, type: "tag", embedCode });
      continue;
    }

    // Image ad (the default; legacy rows have no `type`).
    const imageUrl = adImageUrl(ad.image);
    if (!imageUrl) continue;
    groups[placement].push({
      id: ad.id,
      type: "image",
      imageUrl,
      alt: getImageAlt(ad.image) || ad.name,
      linkUrl: ad.linkUrl ?? undefined,
    });
  }
  return groups;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/lib/payload/__tests__/ads.test.ts`
Expected: PASS (all 7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/payload/ads.ts src/lib/payload/__tests__/ads.test.ts
git commit -m "feat(ads): map tag ads into AdItem variant in groupAds"
```

---

## Task 4: `AdEmbed` component (injects embed HTML, re-executes scripts)

**Files:**
- Create: `src/components/ads/AdEmbed.tsx`
- Test: `src/components/ads/__tests__/AdEmbed.test.tsx`

Browsers do **not** execute `<script>` tags inserted via `innerHTML`. The component re-creates each script node so the browser will run it — this is what makes a pasted network snippet actually load.

- [ ] **Step 1: Write the failing test**

Create `src/components/ads/__tests__/AdEmbed.test.tsx`:

```tsx
// src/components/ads/__tests__/AdEmbed.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { AdEmbed } from "@/components/ads/AdEmbed";

describe("AdEmbed", () => {
  it("injects the embed markup into the container", () => {
    const { container } = render(
      <AdEmbed html='<ins class="adsbygoogle" data-x="1"></ins>' format="banner" />,
    );
    const host = container.querySelector("[data-ad-embed]");
    expect(host).not.toBeNull();
    expect(host?.querySelector("ins.adsbygoogle")).not.toBeNull();
  });

  it("applies the format wrapper sizing", () => {
    const { container } = render(<AdEmbed html="<span>hi</span>" format="tower" />);
    const host = container.querySelector("[data-ad-embed]") as HTMLElement;
    expect(host.className).toContain("min-h-[600px]");
  });

  it("re-creates <script> tags so the browser will execute them", () => {
    const { container } = render(
      <AdEmbed html="<script>window.__adRan=1</script>" format="banner" />,
    );
    const host = container.querySelector("[data-ad-embed]") as HTMLElement;
    // The component replaces inert innerHTML scripts with freshly created
    // <script> nodes; assert the node is present (execution depends on the host).
    expect(host.querySelector("script")).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/ads/__tests__/AdEmbed.test.tsx`
Expected: FAIL with a module-not-found / cannot-resolve error for `@/components/ads/AdEmbed`.

- [ ] **Step 3: Write the component**

Create `src/components/ads/AdEmbed.tsx`:

```tsx
// src/components/ads/AdEmbed.tsx
"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type Props = {
  html: string;
  format: "banner" | "card" | "tower";
  className?: string;
};

// Reserve roughly the same footprint as the equivalent image slot so the page
// does not jump before the network fills the ad. Width matches the image slots;
// height is a min so the network's own creative size can grow it.
const WRAP: Record<Props["format"], string> = {
  banner: "mx-auto w-full max-w-[970px] min-h-[90px]",
  card: "w-full min-h-[250px]",
  tower: "w-full min-h-[600px]",
};

export function AdEmbed({ html, format, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;

    host.innerHTML = html;

    // <script> nodes inserted via innerHTML are inert. Replace each with a
    // freshly created element so the browser parses and executes it.
    const scripts = Array.from(host.querySelectorAll("script"));
    for (const old of scripts) {
      const next = document.createElement("script");
      for (const attr of Array.from(old.attributes)) {
        next.setAttribute(attr.name, attr.value);
      }
      next.text = old.textContent ?? "";
      old.replaceWith(next);
    }

    return () => {
      host.innerHTML = "";
    };
  }, [html]);

  return (
    <div
      ref={ref}
      data-ad-embed
      className={cn("flex items-center justify-center overflow-hidden", WRAP[format], className)}
    />
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/components/ads/__tests__/AdEmbed.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ads/AdEmbed.tsx src/components/ads/__tests__/AdEmbed.test.tsx
git commit -m "feat(ads): AdEmbed component that injects + executes ad-manager snippets"
```

---

## Task 5: Branch `AdCarousel` to render tag ads standalone

**Files:**
- Modify: `src/components/ads/AdCarousel.tsx` (whole component)
- Test: `src/components/ads/__tests__/AdCarousel.test.tsx`

- [ ] **Step 1: Update fixtures and add failing tests**

In `src/components/ads/__tests__/AdCarousel.test.tsx`, replace the `ads` fixture (lines 7-10):

```ts
const ads: AdItem[] = [
  { id: 1, imageUrl: "https://blob/a.jpg", alt: "Ad A", linkUrl: "https://a.com" },
  { id: 2, imageUrl: "https://blob/b.jpg", alt: "Ad B" },
];
```

with (adds the now-required `type` discriminator):

```ts
const ads: AdItem[] = [
  { id: 1, type: "image", imageUrl: "https://blob/a.jpg", alt: "Ad A", linkUrl: "https://a.com" },
  { id: 2, type: "image", imageUrl: "https://blob/b.jpg", alt: "Ad B" },
];
```

Then add these two tests inside the `describe("AdCarousel", ...)` block (e.g. just before its closing `});`):

```ts
  it("renders a tag ad as an embed slot, not an image carousel", () => {
    const tag: AdItem = { id: 9, type: "tag", embedCode: '<ins id="net"></ins>' };
    const { container } = render(<AdCarousel ads={[tag]} format="banner" />);
    expect(container.querySelector("[data-ad-embed]")).not.toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  it("a tag ad in the slot overrides image ads (the network owns the slot)", () => {
    const mixed: AdItem[] = [
      { id: 1, type: "image", imageUrl: "https://blob/a.jpg", alt: "A" },
      { id: 2, type: "tag", embedCode: "<ins></ins>" },
    ];
    const { container } = render(<AdCarousel ads={mixed} format="banner" />);
    expect(container.querySelector("[data-ad-embed]")).not.toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `pnpm exec vitest run src/components/ads/__tests__/AdCarousel.test.tsx`
Expected: FAIL — the two new tests find no `[data-ad-embed]` element because `AdCarousel` does not yet branch on tag ads. (Existing tests still pass.)

- [ ] **Step 3: Rewrite `AdCarousel` to branch on tag ads**

Replace the entire contents of `src/components/ads/AdCarousel.tsx` with:

```tsx
// src/components/ads/AdCarousel.tsx
"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { AdItem } from "@/lib/payload/ads";
import { AdEmbed } from "./AdEmbed";

type Props = {
  ads: AdItem[];
  format: "banner" | "card" | "tower";
  className?: string;
  intervalMs?: number;
};

export function AdCarousel({ ads, format, className, intervalMs = 5000 }: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  // A tag ad owns the slot: the network handles its own rotation/refresh, so if
  // any tag creative is present we render it standalone and ignore images.
  const tagAd = ads.find((a) => a.type === "tag" && a.embedCode);

  const imageAds = ads.filter((a) => a.type !== "tag" && a.imageUrl);
  const count = imageAds.length;

  useEffect(() => {
    if (count <= 1 || paused) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, intervalMs);
    return () => clearInterval(id);
  }, [count, paused, intervalMs]);

  if (tagAd) {
    return <AdEmbed html={tagAd.embedCode!} format={format} className={className} />;
  }

  if (count === 0) return null;

  const active = imageAds[Math.min(index, count - 1)];

  const rootClass =
    format === "banner"
      ? // Standard 970x250 billboard: fixed ratio, capped at 970px wide, centered.
        "relative mx-auto w-full max-w-[970px] aspect-[970/250] overflow-hidden rounded-xl"
      : format === "tower"
        ? // Standard 300x600 half-page / tower. Design creatives at 300x600.
          "relative w-full aspect-[300/600] overflow-hidden rounded-xl border border-border bg-background"
        : // Standard 300x250 medium rectangle (6:5). Design creatives at 300x250.
          "relative w-full aspect-[300/250] overflow-hidden rounded-xl border border-border bg-background";

  const slide = (
    <Image
      key={active.id}
      src={active.imageUrl!}
      alt={active.alt ?? ""}
      fill
      sizes={format === "banner" ? "100vw" : "300px"}
      className="object-cover"
    />
  );

  return (
    <div
      className={cn(rootClass, className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {active.linkUrl ? (
        <a
          href={active.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 block"
        >
          {slide}
        </a>
      ) : (
        slide
      )}

      {count > 1 && (
        <div className="absolute inset-x-0 bottom-2 z-10 flex justify-center gap-1.5">
          {imageAds.map((ad, i) => (
            <button
              key={ad.id}
              type="button"
              data-ad-dot
              aria-label={`Show ad ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index ? "w-4 bg-white" : "w-1.5 bg-white/60 hover:bg-white/80",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the full ads test suite to verify everything passes**

Run: `pnpm exec vitest run src/components/ads/__tests__/AdCarousel.test.tsx`
Expected: PASS — all original tests plus the two new tag tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/ads/AdCarousel.tsx src/components/ads/__tests__/AdCarousel.test.tsx
git commit -m "feat(ads): AdCarousel renders tag ads standalone via AdEmbed"
```

---

## Task 6: Full verification (suite, lint, build, manual admin check)

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

Run: `pnpm test:run`
Expected: PASS, no regressions. (If unrelated, pre-existing failures appear, confirm they exist on `main` before this branch and are out of scope.)

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: no new errors in `src/collections/Ads.ts`, `src/lib/payload/ads.ts`, `src/components/ads/AdEmbed.tsx`, `src/components/ads/AdCarousel.tsx`, or the migration files.

- [ ] **Step 3: Production build**

Run: `pnpm build`
Expected: build succeeds. (This also type-checks the whole app, catching any `AdItem` consumer that broke.)

- [ ] **Step 4: Manual admin + frontend check**

Run: `pnpm dev`

Then in a browser:
1. Open the Payload admin → **Ads** → **Create New**.
2. Confirm a **Type** dropdown appears with "Image upload" and "Ad-manager tag".
3. Select **Ad-manager tag** → confirm the **Image** upload disappears and an **Embed code** textarea appears.
4. Try to save with an empty embed code → expect the validation message "Paste the ad-manager embed code for tag-type ads."
5. Paste a visible test snippet (so you can see it render without a real network), e.g.:
   ```html
   <div style="width:100%;height:90px;background:#16a34a;color:#fff;display:flex;align-items:center;justify-content:center;font:700 16px sans-serif">TAG AD OK</div>
   ```
   Set **Placement** = "Home — Top banner", **Active** = checked, Save.
6. Open the homepage (`http://localhost:3000`). Confirm the top-banner slot shows the green "TAG AD OK" block (not an image carousel).
7. Edit the same ad → switch **Type** back to **Image**, confirm the upload field returns and an image is required again.

Expected: all seven checks pass.

- [ ] **Step 5: Confirm existing static ads still work**

On the homepage, confirm the other placements that still use uploaded images (seeded via `pnpm seed:ads`) render and rotate exactly as before.

Expected: no change to existing static-image behavior.

- [ ] **Step 6: Final commit (if any verification fixes were needed)**

```bash
git add -A
git commit -m "chore(ads): verification fixes for tag-ad option"
```

(Skip if Steps 1-5 required no changes.)

---

## Self-Review

**Spec coverage:**
- "Use ad manager — insert only a tag, ads display automatically" → Task 1 (`embedCode` field) + Task 4 (`AdEmbed` executes the snippet) + Task 5 (renders it in the slot). ✅
- "Add it as an option, not change the setup" → `type` defaults to `image`; image path in `groupAds`/`AdCarousel` is unchanged; legacy rows with no `type` resolve to image (Task 3 test "treats a doc with no type as an image ad"). ✅
- "All 6 placements" → all flow through `AdCarousel`, which now branches for any of them. ✅
- "Standalone (tag replaces rotation)" → `AdCarousel` returns `<AdEmbed>` and ignores images when a tag ad is present (Task 5 test "tag ad overrides image ads"). ✅

**Placeholder scan:** No "TBD"/"add error handling"/"write tests for the above" — every code and test block is complete. ✅

**Type consistency:** `AdItem` defined once in Task 3 with `type: "image" | "tag"`, `imageUrl?`, `embedCode?`. `AdEmbed` props (`html`, `format`, `className`) are identical in Task 4's component and test and in Task 5's call site. `groupAds` emits `{ id, type, embedCode }` for tags (matches Task 3 test) and `{ id, type, imageUrl, alt, linkUrl }` for images (matches updated Task 3 test). Migration column names (`type`, `embed_code`) match Payload's snake_case mapping of `type`/`embedCode`. ✅

**Edge cases handled:** blank embed code skipped (lib) and rejected (admin validate); legacy rows without `type` treated as image; `image_id` made nullable so tag ads save; page-jump mitigated by `min-h` in `AdEmbed`.
