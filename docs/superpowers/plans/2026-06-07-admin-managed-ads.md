# Admin-Managed Ad Placeholders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hard-coded static `<AdBanner>` images with admin-managed ad **placeholders**. Each placeholder is a slot that pulls its ads from a new Payload `ads` collection and rotates through them as a slider. Two placeholder shapes: full-width rectangular **banners** (between homepage sections) and blog-card-sized **cards** mixed into the news grids.

**Architecture:** A single `ads` Payload collection (image + link + placement + active + order) is the editable surface in the admin. A server helper (`getAds`) fetches active ads grouped by placement. One client `AdCarousel` component renders any placement as an auto-rotating slider in one of two formats — `banner` (fixed-height, full container width) or `card` (blog-card sized, fills a grid cell). The homepage and the `/articles` listing fetch ads server-side and drop carousels into the existing layout. A one-off seed migrates the four current banner images into the collection so the live site looks identical at switchover.

**Tech Stack:** Payload CMS 3.84 (Postgres adapter, migration-managed schema, Vercel Blob uploads), Next.js 16 RSC, React 19, Tailwind v3, Vitest + @testing-library/react.

---

## Background (verified facts)

- The schema is **migration-managed** — `push: false` in [payload.config.ts:55-64](../../../src/payload.config.ts#L55-L64). A new collection therefore requires a generated migration (`payload migrate:create`) applied with `payload migrate`. Migrations are registered in [src/migrations/index.ts](../../../src/migrations/index.ts) (the generator updates this file automatically).
- Collections follow a simple pattern — see [Videos.ts](../../../src/collections/Videos.ts) and [Media.ts](../../../src/collections/Media.ts). Public read is `access: { read: () => true }`. Uploads (Media) already store to Vercel Blob and expose `url` + `sizes.{thumbnail,card,hero}.url`.
- Current static ads live in [page.tsx:98-165](../../../src/app/(frontend)/[locale]/page.tsx#L98-L165): four `<AdBanner>` instances (`ocp-banner`, `cargo-banner`, `car1-banner`, `car2-banner`), each `mx-auto max-w-[970px]` and **outside** the `container` (so narrower than the sections). The owner wants them **full container width** and **~75% of their current height** with the image **covering** the slot.
- Sections are wrapped in `<div className="container ...">`; `container` is centered with responsive side padding 1rem→6rem ([tailwind.config.ts:12-21](../../../tailwind.config.ts#L12-L21)). "Full width minus side padding" == `container` width.
- Blog cards: [ArticleCard.tsx](../../../src/components/articles/ArticleCard.tsx) (used in `/articles` via [ArticleGrid.tsx](../../../src/components/articles/ArticleGrid.tsx)) and [NewsGrid2x2.tsx](../../../src/components/home/NewsGrid2x2.tsx) (homepage league grid). Both use a rounded card with an `aspect-video` `object-cover` image. CSS grid stretches cells to the tallest row sibling, so an `h-full` ad cell automatically matches blog-card height.
- Data-fetch pattern: `getPayloadClient()` from [queries.ts:8-10](../../../src/lib/payload/queries.ts#L8-L10); media URL/alt helpers `getImageUrl`/`getImageAlt` in [utils.ts:29-40](../../../src/lib/utils.ts#L29-L40).
- The existing AdSense system (`AdSlot`, `withAds`, `StickyMobileAd`) is a **separate** concern and stays untouched; it renders nothing while AdSense is inactive.
- Decisions locked with the owner: **one `ads` collection**; banners use **fixed slot + object-cover**; news-card ads are **cards mixed into the news grids**; height target ≈ **75% of the current ~250px ⇒ a `h-[150px] sm:h-[188px]` slot**.
- Test command (single file): `pnpm test:run <path-substring>`. Payload CLI via `pnpm payload <cmd>`; types via `pnpm generate:types`.

> ⚠️ **DB caution:** `pnpm payload migrate` applies SQL to whatever `DATABASE_URL` in `.env` points at (Neon). Before applying to production, run it against a Neon dev branch (or confirm the target). `migrate:create` only **reads** the schema to compute a diff — it does not mutate data.

## File Structure

- **Create** `src/collections/Ads.ts` — the collection.
- **Modify** `src/payload.config.ts` — register `Ads`.
- **Generated** `src/payload-types.ts` (via `generate:types`) + `src/migrations/<ts>_ads.ts` and `src/migrations/index.ts` (via `migrate:create`).
- **Create** `src/lib/payload/ads.ts` — `AdPlacement`, `AdItem`, pure `groupAds()`, and `getAds()`.
- **Create** `src/lib/payload/__tests__/ads.test.ts` — tests for `groupAds()`.
- **Create** `src/components/ads/AdCarousel.tsx` — the slider (banner | card formats).
- **Create** `src/components/ads/__tests__/AdCarousel.test.tsx` — slider tests.
- **Modify** `src/app/(frontend)/[locale]/page.tsx` — fetch ads, swap the 4 `<AdBanner>` for `<AdCarousel format="banner">` in `container`, pass news-card ads down.
- **Modify** `src/components/home/LeagueNewsSection.tsx` + `src/components/home/NewsGrid2x2.tsx` — accept news-card ads, render 3 articles + 1 ad cell.
- **Modify** `src/components/articles/ArticleGrid.tsx` — inject ad-card carousels into the grid.
- **Modify** `src/app/(frontend)/[locale]/articles/page.tsx` — fetch + pass news-card ads.
- **Create** `scripts/seed-ads.ts` — upload the 4 existing banner images into Media + create 4 banner ads.

---

### Task 1: The `ads` collection

**Files:**
- Create: `src/collections/Ads.ts`
- Modify: `src/payload.config.ts:9-20,49`

- [ ] **Step 1: Create the collection**

```ts
// src/collections/Ads.ts
import type { CollectionConfig } from "payload";

// The five placeholder slots. Keep these values in sync with
// AdPlacement in src/lib/payload/ads.ts.
export const AD_PLACEMENTS = [
  { label: "Home — Top banner (above hero)", value: "top-banner" },
  { label: "Home — Between hero & news", value: "hero-news" },
  { label: "Home — Between news & videos", value: "news-videos" },
  { label: "Home — Between videos & matches", value: "videos-matches" },
  { label: "News card (blog-sized, in the news grid)", value: "news-card" },
] as const;

export const Ads: CollectionConfig = {
  slug: "ads",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "placement", "active", "order"],
    description:
      "Each row is one ad creative. Multiple ads sharing a placement rotate as a slider in that slot.",
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      admin: { description: "Internal label (e.g. 'OCP SIAM — June')." },
    },
    {
      name: "image",
      type: "upload",
      relationTo: "media",
      required: true,
      admin: {
        description:
          "Banners: design ~1600×376 (wide). News cards: design 16:9 (e.g. 600×400).",
      },
    },
    {
      name: "linkUrl",
      type: "text",
      admin: { description: "Optional. Clicking the ad opens this in a new tab." },
    },
    {
      name: "placement",
      type: "select",
      required: true,
      index: true,
      options: [...AD_PLACEMENTS],
    },
    {
      name: "active",
      type: "checkbox",
      defaultValue: true,
      index: true,
      admin: { description: "Uncheck to hide without deleting." },
    },
    {
      name: "order",
      type: "number",
      defaultValue: 0,
      admin: { description: "Lower shows first in the slider rotation." },
    },
  ],
};
```

- [ ] **Step 2: Register the collection in the Payload config**

In [payload.config.ts](../../../src/payload.config.ts), add the import alongside the others (after line 20 `Videos`):

```ts
import { Videos } from './collections/Videos'
import { Ads } from './collections/Ads'
```

And add `Ads` to the `collections` array (line 49):

```ts
  collections: [Users, Media, Categories, Tags, Authors, Articles, Competitions, Clubs, Subscribers, Pages, Redirects, Videos, Ads],
```

- [ ] **Step 3: Regenerate Payload types**

Run: `pnpm generate:types`
Expected: `src/payload-types.ts` now contains an `Ad` interface and `ads` is added to the `Config['collections']` map. No errors.

- [ ] **Step 4: Generate the migration**

Run: `pnpm payload migrate:create ads`
Expected: a new file `src/migrations/<timestamp>_ads.ts` is created and `src/migrations/index.ts` is updated to register it. The migration `up` creates an `ads` table + the `enum__ads_placement` enum.

- [ ] **Step 5: Apply the migration (against a dev DB / Neon dev branch first)**

Run: `pnpm payload migrate`
Expected: output reports the `<timestamp>_ads` migration applied successfully.

- [ ] **Step 6: Verify in the admin**

Run: `pnpm dev`, open `http://localhost:3000/admin`, confirm an **Ads** collection exists with the fields above and that you can create a row (image + placement).

- [ ] **Step 7: Commit**

```bash
git add src/collections/Ads.ts src/payload.config.ts src/payload-types.ts src/migrations/
git commit -m "feat(ads): add admin-managed ads collection + migration"
```

---

### Task 2: `getAds` data helper (TDD on the pure grouping fn)

**Files:**
- Create: `src/lib/payload/ads.ts`
- Test: `src/lib/payload/__tests__/ads.test.ts`

- [ ] **Step 1: Write the failing test for the pure grouping function**

```ts
// src/lib/payload/__tests__/ads.test.ts
import { describe, it, expect } from "vitest";
import { groupAds } from "@/lib/payload/ads";

// Minimal fake Payload docs (image populated to depth 1).
const doc = (over: Record<string, unknown>) => ({
  id: 1,
  name: "Ad",
  placement: "top-banner",
  linkUrl: null,
  image: { url: "https://blob/x.jpg", alt: "alt text", sizes: {} },
  ...over,
});

describe("groupAds", () => {
  it("returns an entry for every placement, empty when no docs", () => {
    const g = groupAds([]);
    expect(Object.keys(g).sort()).toEqual(
      ["hero-news", "news-card", "news-videos", "top-banner", "videos-matches"].sort(),
    );
    expect(g["top-banner"]).toEqual([]);
  });

  it("maps a doc into an AdItem under its placement", () => {
    const g = groupAds([doc({ id: 7, placement: "hero-news", linkUrl: "https://ex.com" })]);
    expect(g["hero-news"]).toEqual([
      { id: 7, imageUrl: "https://blob/x.jpg", alt: "alt text", linkUrl: "https://ex.com" },
    ]);
    expect(g["top-banner"]).toEqual([]);
  });

  it("prefers media alt, falls back to the ad name", () => {
    const g = groupAds([
      doc({ id: 2, image: { url: "https://blob/y.jpg", alt: "", sizes: {} }, name: "Fallback" }),
    ]);
    expect(g["top-banner"][0].alt).toBe("Fallback");
  });

  it("skips docs whose image has no usable URL", () => {
    const g = groupAds([doc({ id: 3, image: null })]);
    expect(g["top-banner"]).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:run src/lib/payload/__tests__/ads.test.ts`
Expected: FAIL — cannot resolve `groupAds` from `@/lib/payload/ads`.

- [ ] **Step 3: Implement `ads.ts`**

```ts
// src/lib/payload/ads.ts
import type { Ad, Config } from "@/payload-types";
import { getImageAlt, getImageUrl } from "@/lib/utils";
import { getPayloadClient } from "./queries";

type Locale = Config["locale"];

export type AdPlacement =
  | "top-banner"
  | "hero-news"
  | "news-videos"
  | "videos-matches"
  | "news-card";

export const AD_PLACEMENTS: AdPlacement[] = [
  "top-banner",
  "hero-news",
  "news-videos",
  "videos-matches",
  "news-card",
];

export type AdItem = {
  id: number | string;
  imageUrl: string;
  alt: string;
  linkUrl?: string;
};

export type AdsByPlacement = Record<AdPlacement, AdItem[]>;

function emptyGroups(): AdsByPlacement {
  return {
    "top-banner": [],
    "hero-news": [],
    "news-videos": [],
    "videos-matches": [],
    "news-card": [],
  };
}

// Pure: turn populated Payload ad docs into AdItems grouped by placement.
export function groupAds(docs: Ad[]): AdsByPlacement {
  const groups = emptyGroups();
  for (const ad of docs) {
    const placement = ad.placement as AdPlacement;
    if (!groups[placement]) continue;
    const imageUrl = getImageUrl(ad.image, "hero") ?? getImageUrl(ad.image, "card");
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

// Fetch all active ads for a locale, grouped by placement and ordered.
export async function getAds(locale: Locale): Promise<AdsByPlacement> {
  const payload = await getPayloadClient();
  const res = await payload.find({
    collection: "ads",
    where: { active: { equals: true } },
    locale,
    sort: "order",
    depth: 1,
    limit: 100,
  });
  return groupAds(res.docs as Ad[]);
}
```

> Note: `getImageUrl`/`getImageAlt` accept `any`, so passing `ad.image` (which is `number | Media`) is fine; they guard against the unpopulated `number` case and return `null`/`""`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test:run src/lib/payload/__tests__/ads.test.ts`
Expected: PASS (4 passing).

- [ ] **Step 5: Commit**

```bash
git add src/lib/payload/ads.ts src/lib/payload/__tests__/ads.test.ts
git commit -m "feat(ads): getAds helper + pure placement grouping"
```

---

### Task 3: `AdCarousel` slider component (TDD)

**Files:**
- Create: `src/components/ads/AdCarousel.tsx`
- Test: `src/components/ads/__tests__/AdCarousel.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ads/__tests__/AdCarousel.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import { AdCarousel } from "@/components/ads/AdCarousel";
import type { AdItem } from "@/lib/payload/ads";

const ads: AdItem[] = [
  { id: 1, imageUrl: "https://blob/a.jpg", alt: "Ad A", linkUrl: "https://a.com" },
  { id: 2, imageUrl: "https://blob/b.jpg", alt: "Ad B" },
];

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("AdCarousel", () => {
  it("renders nothing when there are no ads", () => {
    const { container } = render(<AdCarousel ads={[]} format="banner" />);
    expect(container.firstChild).toBeNull();
  });

  it("banner format applies the fixed-height slot", () => {
    const { container } = render(<AdCarousel ads={[ads[0]]} format="banner" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("h-[150px]");
    expect(root.className).toContain("sm:h-[188px]");
    const img = container.querySelector("img");
    expect(img?.className).toContain("object-cover");
    expect(img?.getAttribute("alt")).toBe("Ad A");
  });

  it("card format fills its grid cell (h-full) and matches blog-card chrome", () => {
    const { container } = render(<AdCarousel ads={[ads[0]]} format="card" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("h-full");
    expect(root.className).toContain("rounded-xl");
  });

  it("wraps a slide in a new-tab link when linkUrl is set, plain when not", () => {
    const withLink = render(<AdCarousel ads={[ads[0]]} format="banner" />);
    const a = withLink.container.querySelector("a");
    expect(a).toHaveAttribute("href", "https://a.com");
    expect(a).toHaveAttribute("target", "_blank");
    expect(a).toHaveAttribute("rel", "noopener noreferrer");

    const noLink = render(<AdCarousel ads={[ads[1]]} format="banner" />);
    expect(noLink.container.querySelector("a")).toBeNull();
  });

  it("shows dots only when there is more than one ad, and a dot click switches slides", () => {
    const single = render(<AdCarousel ads={[ads[0]]} format="banner" />);
    expect(single.container.querySelectorAll("[data-ad-dot]")).toHaveLength(0);

    const { container } = render(<AdCarousel ads={ads} format="banner" />);
    const dots = container.querySelectorAll("[data-ad-dot]");
    expect(dots).toHaveLength(2);
    // First ad visible initially.
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("Ad A");
    fireEvent.click(dots[1]);
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("Ad B");
  });

  it("auto-advances on its interval", () => {
    vi.useFakeTimers();
    const { container } = render(<AdCarousel ads={ads} format="banner" intervalMs={3000} />);
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("Ad A");
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("Ad B");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:run src/components/ads/__tests__/AdCarousel.test.tsx`
Expected: FAIL — cannot resolve `@/components/ads/AdCarousel`.

- [ ] **Step 3: Implement the component**

```tsx
// src/components/ads/AdCarousel.tsx
"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { AdItem } from "@/lib/payload/ads";

type Props = {
  ads: AdItem[];
  format: "banner" | "card";
  className?: string;
  intervalMs?: number;
};

export function AdCarousel({ ads, format, className, intervalMs = 5000 }: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const count = ads.length;

  useEffect(() => {
    if (count <= 1 || paused) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, intervalMs);
    return () => clearInterval(id);
  }, [count, paused, intervalMs]);

  if (count === 0) return null;

  const active = ads[Math.min(index, count - 1)];

  const rootClass =
    format === "banner"
      ? "relative w-full h-[150px] sm:h-[188px] overflow-hidden rounded-xl"
      : "relative h-full w-full overflow-hidden rounded-xl border border-border bg-background";

  const slide = (
    <Image
      key={active.id}
      src={active.imageUrl}
      alt={active.alt}
      fill
      sizes={format === "banner" ? "100vw" : "(max-width: 1024px) 100vw, 33vw"}
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
          {ads.map((ad, i) => (
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

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test:run src/components/ads/__tests__/AdCarousel.test.tsx`
Expected: PASS (6 passing).

- [ ] **Step 5: Commit**

```bash
git add src/components/ads/AdCarousel.tsx src/components/ads/__tests__/AdCarousel.test.tsx
git commit -m "feat(ads): AdCarousel slider (banner + card formats, autoplay, dots)"
```

---

### Task 4: Swap the homepage banner ads for managed carousels

**Files:**
- Modify: `src/app/(frontend)/[locale]/page.tsx:13,67-69,98-165`

- [ ] **Step 1: Import the ads helper + carousel, drop the static AdBanner import**

In [page.tsx](../../../src/app/(frontend)/[locale]/page.tsx), replace the `AdBanner` import (line 13):

```tsx
import { AdCarousel } from "@/components/ads/AdCarousel";
import { getAds } from "@/lib/payload/ads";
```

- [ ] **Step 2: Fetch ads alongside the other homepage data**

After the `latest`/`articlesByLeague` block (after line 69), add:

```tsx
  const articlesByLeague = buildLeagueArticles(latest.docs.slice(5), LEAGUES);

  const ads = await getAds(locale as Config["locale"]);
```

- [ ] **Step 3: Replace the four `<AdBanner>` instances with full-width carousels**

Replace the **top** banner (lines 97-105):

```tsx
      {/* Top ad — full section width, above the hero + leagues carousel. */}
      <div className="container">
        <AdCarousel ads={ads["top-banner"]} format="banner" />
      </div>
```

Replace the **hero→news** banner (lines 118-125):

```tsx
      {/* Between hero and latest news. */}
      <div className="container">
        <AdCarousel ads={ads["hero-news"]} format="banner" />
      </div>
```

Replace the **news→videos** banner (lines 135-142):

```tsx
      {/* Between latest news and the first YouTube section. */}
      <div className="container">
        <AdCarousel ads={ads["news-videos"]} format="banner" />
      </div>
```

Replace the **videos→matches** banner (lines 158-165):

```tsx
      {/* Between the second YouTube section and the matches section. */}
      <div className="container">
        <AdCarousel ads={ads["videos-matches"]} format="banner" />
      </div>
```

> The `ads` object also carries `ads["news-card"]`, which Task 5 passes into the league news section.

- [ ] **Step 4: Verify types**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no errors. (`AdBanner` is no longer referenced in this file — its component + test remain in the repo, untouched.)

- [ ] **Step 5: Commit**

```bash
git add src/app/(frontend)/[locale]/page.tsx
git commit -m "feat(ads): homepage banners now full-width managed carousels"
```

---

### Task 5: Mix a news-card ad into the homepage league grid

**Files:**
- Modify: `src/components/home/NewsGrid2x2.tsx:1-14,12`
- Modify: `src/components/home/LeagueNewsSection.tsx:9-16,30-34`
- Modify: `src/app/(frontend)/[locale]/page.tsx` (pass the prop)

- [ ] **Step 1: Teach `NewsGrid2x2` to render an ad cell**

The grid shows up to 4 cells. When `ads` are supplied, show **3 articles + 1 ad-card carousel** (4th cell) so the 2×2 footprint is preserved.

Replace the top of [NewsGrid2x2.tsx](../../../src/components/home/NewsGrid2x2.tsx) (lines 1-14) with:

```tsx
import Image from "next/image";
import Link from "next/link";
import { cn, formatDate } from "@/lib/utils";
import { AdCarousel } from "@/components/ads/AdCarousel";
import type { AdItem } from "@/lib/payload/ads";
import type { LeagueCardArticle } from "@/lib/home/cards";

type Props = {
  articles: LeagueCardArticle[];
  locale: string;
  className?: string;
  ads?: AdItem[];
};

export function NewsGrid2x2({ articles, locale, className, ads = [] }: Props) {
  const hasAd = ads.length > 0;
  const shownArticles = hasAd ? articles.slice(0, 3) : articles.slice(0, 4);
  return (
    <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2", className)}>
      {shownArticles.map((article) => (
```

Then, immediately **after** the existing `.map(...)` closes (after line 59's `))}`) and **before** the closing `</div>` (line 60), insert the ad cell:

```tsx
      ))}
      {hasAd && <AdCarousel ads={ads} format="card" />}
    </div>
```

- [ ] **Step 2: Thread the prop through `LeagueNewsSection`**

In [LeagueNewsSection.tsx](../../../src/components/home/LeagueNewsSection.tsx), extend the imports + props (lines 9-16):

```tsx
import { LEAGUES } from "@/lib/home/leagues";
import type { LeagueCardArticle } from "@/lib/home/cards";
import type { AdItem } from "@/lib/payload/ads";

type Props = {
  title: string;
  locale: string;
  articlesByLeague: Record<string, LeagueCardArticle[]>;
  ads?: AdItem[];
};
```

Update the function signature + the `NewsGrid2x2` usage (lines 18, 30-34):

```tsx
export function LeagueNewsSection({ title, locale, articlesByLeague, ads = [] }: Props) {
```

```tsx
        <NewsGrid2x2
          className="lg:col-span-2 lg:row-span-2 lg:grid-rows-subgrid"
          articles={articles}
          locale={locale}
          ads={ads}
        />
```

- [ ] **Step 3: Pass news-card ads from the homepage**

In [page.tsx](../../../src/app/(frontend)/[locale]/page.tsx), update the `LeagueNewsSection` usage (around line 128):

```tsx
        <LeagueNewsSection
          title={t("byLeague")}
          locale={locale}
          articlesByLeague={articlesByLeague}
          ads={ads["news-card"]}
        />
```

- [ ] **Step 4: Verify types + suite**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Run: `pnpm test:run`
Expected: no type errors; all tests pass.

- [ ] **Step 5: Manual check**

With `pnpm dev` and at least one **news-card** ad created in the admin, confirm the homepage league grid shows 3 articles + 1 blog-sized ad that visually matches the cards. With no news-card ad, the grid shows the normal 4 articles.

- [ ] **Step 6: Commit**

```bash
git add src/components/home/NewsGrid2x2.tsx src/components/home/LeagueNewsSection.tsx src/app/(frontend)/[locale]/page.tsx
git commit -m "feat(ads): blog-sized ad card mixed into the homepage league grid"
```

---

### Task 6: Inject ad cards into the `/articles` news grid

**Files:**
- Modify: `src/components/articles/ArticleGrid.tsx:1-39`
- Modify: `src/app/(frontend)/[locale]/articles/page.tsx:5-6,28-37`

- [ ] **Step 1: Add ad-card injection to `ArticleGrid`**

Replace [ArticleGrid.tsx](../../../src/components/articles/ArticleGrid.tsx) in full with:

```tsx
import { Fragment } from "react";
import { ArticleCard } from "./ArticleCard";
import { AdSlot } from "@/components/ads/AdSlot";
import { AdCarousel } from "@/components/ads/AdCarousel";
import type { AdItem } from "@/lib/payload/ads";

type Props = {
  articles: any[];
  locale: string;
  columns?: 2 | 3 | 4;
  withAds?: boolean;
  adCards?: AdItem[];
};

const AD_EVERY = 8; // AdSense full-width strip cadence (unchanged)
const AD_CARD_EVERY = 6; // managed blog-sized ad-card cadence

export function ArticleGrid({
  articles,
  locale,
  columns = 3,
  withAds = false,
  adCards = [],
}: Props) {
  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  };

  const hasAdCards = adCards.length > 0;

  return (
    <div className={`grid gap-4 ${gridCols[columns]}`}>
      {articles.map((article, index) => {
        const insertAdAfter =
          withAds && (index + 1) % AD_EVERY === 0 && index !== articles.length - 1;
        const insertAdCardAfter =
          hasAdCards &&
          (index + 1) % AD_CARD_EVERY === 0 &&
          index !== articles.length - 1;
        return (
          <Fragment key={article.id}>
            <ArticleCard article={article} locale={locale} />
            {insertAdCardAfter && (
              <AdCarousel ads={adCards} format="card" />
            )}
            {insertAdAfter && (
              <div className="col-span-full">
                <AdSlot slotName="inGrid" format="in-grid" loading="lazy" />
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Fetch + pass ad cards from the articles page**

In [articles/page.tsx](../../../src/app/(frontend)/[locale]/articles/page.tsx), add the import (after line 5 `getArticles`):

```tsx
import { getArticles } from "@/lib/payload/queries";
import { getAds } from "@/lib/payload/ads";
```

Fetch ads next to the articles query (after line 28) and pass them to the grid (line 37):

```tsx
  const result = await getArticles({ locale: locale as Config["locale"], page: currentPage, limit: 12 });
  const ads = await getAds(locale as Config["locale"]);
  const t = await getTranslations({ locale, namespace: "article" });
```

```tsx
          <ArticleGrid articles={result.docs} locale={locale} columns={3} withAds adCards={ads["news-card"]} />
```

- [ ] **Step 3: Verify types + suite**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Run: `pnpm test:run`
Expected: no type errors; all tests pass.

- [ ] **Step 4: Manual check**

On `/ar/articles` with a news-card ad created and ≥6 articles, confirm an ad card appears after the 6th card, blending with the blog cards.

- [ ] **Step 5: Commit**

```bash
git add src/components/articles/ArticleGrid.tsx src/app/(frontend)/[locale]/articles/page.tsx
git commit -m "feat(ads): inject managed ad cards into the /articles news grid"
```

---

### Task 7: Seed the four current banners so the live site is unchanged at switchover

**Files:**
- Create: `scripts/seed-ads.ts`

- [ ] **Step 1: Write the seed script**

This uploads the existing `/public/images/*.jpeg` banners into Media and creates one banner ad per main placement. It is **idempotent** — it skips an ad whose `name` already exists.

```ts
// scripts/seed-ads.ts
import path from "path";
import { fileURLToPath } from "url";
import { getPayload } from "payload";
import configPromise from "../src/payload.config";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const publicImages = path.resolve(dirname, "../public/images");

// Maps the current static banners to their placements (see page.tsx history).
const SEED = [
  { name: "OCP — SIAM (seed)", file: "ocp-banner.jpeg", placement: "top-banner", alt: "OCP — SIAM" },
  { name: "MSC (seed)", file: "cargo-banner.jpeg", placement: "hero-news", alt: "MSC" },
  { name: "OMODA C5 (seed)", file: "car1-banner.jpeg", placement: "news-videos", alt: "OMODA C5" },
  { name: "JETOUR (seed)", file: "car2-banner.jpeg", placement: "videos-matches", alt: "JETOUR" },
] as const;

async function main() {
  const payload = await getPayload({ config: configPromise });

  for (const item of SEED) {
    const existing = await payload.find({
      collection: "ads",
      where: { name: { equals: item.name } },
      limit: 1,
    });
    if (existing.docs.length > 0) {
      console.log(`skip (exists): ${item.name}`);
      continue;
    }

    const media = await payload.create({
      collection: "media",
      data: { alt: item.alt },
      filePath: path.join(publicImages, item.file),
    });

    await payload.create({
      collection: "ads",
      data: {
        name: item.name,
        image: media.id,
        placement: item.placement,
        active: true,
        order: 0,
      },
    });
    console.log(`created ad: ${item.name} (${item.placement})`);
  }

  console.log("seed-ads done");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Add a script alias**

In [package.json](../../../package.json) scripts (after line 32 `seed:preview:reset`), add:

```json
    "seed:ads": "tsx scripts/seed-ads.ts",
```

- [ ] **Step 3: Run the seed (dev DB / Neon dev branch first)**

Run: `pnpm seed:ads`
Expected: logs `created ad: ...` for all four; re-running logs `skip (exists)` for each.

- [ ] **Step 4: Verify parity**

With `pnpm dev`, confirm the homepage shows the four banners (now full container width, ~188px tall, image-covered) in the same positions as before, sourced from the admin. Edit one ad's image in `/admin` and confirm the homepage reflects it.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-ads.ts package.json
git commit -m "chore(ads): seed existing banners into the ads collection"
```

---

### Task 8: Full verification pass

- [ ] **Step 1: Lint, types, tests**

Run: `pnpm lint`
Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Run: `pnpm test:run`
Expected: all clean / green.

- [ ] **Step 2: Production build**

Run: `pnpm build`
Expected: build succeeds. (The homepage + `/articles` are dynamic — they call `getAds()` — which is consistent with their existing Payload queries.)

- [ ] **Step 3: Deploy-time migration note**

Before/at deploy, ensure the `ads` migration is applied to the **production** Neon DB (`pnpm payload migrate` against the prod `DATABASE_URL`, or via the project's existing deploy migration step). Without it, production queries to `ads` will fail.

---

## Self-Review

**Spec coverage:**
- "Each front-page ad becomes a holder we can insert ads into" → `getAds` + `AdCarousel` per placement (Tasks 2-6). ✅
- "A single placeholder can display multiple ads as sliders" → `AdCarousel` autoplay + dots (Task 3). ✅
- "Managed through the admin dashboard" → `ads` collection (Task 1). ✅
- "Two placeholder types" → `format="banner"` and `format="card"` (Task 3). ✅
- Main banners: height = 75% of current, width = full section width, image covers → `container` wrapper + `h-[150px] sm:h-[188px]` + `object-cover` (Tasks 3-4). ✅
- Smaller banners = blog-card dimensions, blend with blogs → `format="card"` `h-full` cells matching `aspect-video` card chrome, injected into homepage league grid + `/articles` grid (Tasks 5-6). ✅
- Continuity (site unchanged at switchover) → seed (Task 7). ✅

**Placeholder scan:** No TBD/TODO. Generated artifacts (`payload-types.ts`, migration file) are produced by named commands, not hand-waved. ✅

**Type consistency:** `AdPlacement`, `AdItem`, `AdsByPlacement`, `groupAds`, `getAds` defined in Task 2 and used identically in Tasks 3-6. `AD_PLACEMENTS` values in `Ads.ts` (Task 1) match the `AdPlacement` union (Task 2). `AdCarousel` prop shape (`ads`, `format`, `className`, `intervalMs`) is consistent across Tasks 3-6. ✅

**Open for discussion (owner asked to "discuss more after"):**
- News-card placement cadence: homepage shows 3 articles + 1 ad; `/articles` inserts after every 6 cards. Easy to retune.
- Whether banners should carry a small "إعلان/Sponsored" label (currently none, to maximize blend-in per the request).
- Whether to keep the inactive AdSense `withAds` strip in `/articles` alongside the managed ad cards (left untouched here).
