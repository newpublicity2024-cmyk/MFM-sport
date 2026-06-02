# Boss Preview Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a polished, demo-ready preview of mfmsport.ma that the boss can open from a Vercel URL — featuring the real SVG logo in the header, real social icons in the footer, club crests + competition logos populated from API-Football's CDN, themed featured images on all 18 demo articles, populated About/Contact/Legal/Privacy pages, and a layout-QA pass through every key route in `/ar`, `/fr`, `/en`. WordPress migration explicitly stays out of scope (deferred to post-approval per user note "we will perform a wp migration last").

**Architecture:** Three layers of polish landed sequentially, each independently verifiable: (1) **Brand assets** — wire the existing `public/images/logo.svg` into the header and replace footer text social icons with `lucide-react` icons (already in `package.json`); (2) **Entity imagery** — add a `logoUrl` text fallback field to `Clubs` and `Competitions`, plus a `featuredImageUrl` text fallback to `Articles`, then update reading components to honor URL fallback when no `media` upload is set, then update `seed.ts` to populate club/competition logos from `media.api-sports.io` (already whitelisted in [next.config.ts:14-17](next.config.ts#L14-L17)) and update `seed-preview.ts` to attach featured images from a curated bundle of 12 royalty-free football photos saved to `public/images/seed/articles/`; (3) **Layout QA** — manual walkthrough of all key routes per locale via Playwright, fixing any visible issues. Then deploy to a Vercel preview URL via `vercel --prod=false` and share with the boss.

The text-fallback fields are deliberately additive (optional), so when WP migration runs later and writes real `Media` uploads, no schema collision occurs and the URL-fallback path simply stays empty — no migration of preview data needed.

**Tech Stack:** Next.js 16.2.4 / Payload 3.84.0 / Postgres (Neon) / Tailwind 3.4 / next-intl 4.9 / lucide-react (already installed) / Vercel CLI (preview deploy) / Playwright MCP (visual QA).

**Discovered state (from investigation):**
- Header text logo lives at [src/components/layout/Header.tsx:15-18](src/components/layout/Header.tsx#L15-L18); SVG asset already exists at [public/images/logo.svg](public/images/logo.svg)
- Footer text-letter social icons at [src/components/layout/Footer.tsx:8-13](src/components/layout/Footer.tsx#L8-L13); `lucide-react` already in `package.json:44`
- Demo articles created without `featuredImage` — see [scripts/seed-preview.ts:285-300](scripts/seed-preview.ts#L285-L300); ArticleCard renders grey placeholder when null at [src/components/articles/ArticleCard.tsx:31-43](src/components/articles/ArticleCard.tsx#L31-L43)
- Club/competition logo fields exist but unpopulated — [src/collections/Clubs.ts:12](src/collections/Clubs.ts#L12) and [src/collections/Competitions.ts:12](src/collections/Competitions.ts#L12); displayed via `club.logo?.url` at [src/app/(frontend)/[locale]/club/page.tsx:34](src/app/(frontend)/[locale]/club/page.tsx#L34) and `competition.logo?.url` at [src/app/(frontend)/[locale]/competition/page.tsx:59](src/app/(frontend)/[locale]/competition/page.tsx#L59) and [src/app/(frontend)/[locale]/club/[slug]/page.tsx:56-63](src/app/(frontend)/[locale]/club/[slug]/page.tsx#L56-L63)
- API-Football logo URLs are deterministic: `https://media.api-sports.io/football/teams/{apiFootballId}.png` and `.../leagues/{apiFootballId}.png` — confirmed because match cards already render team logos from this CDN at [src/components/football/MatchCard.tsx:25,63](src/components/football/MatchCard.tsx#L25)
- Static pages seeded with placeholder body via [scripts/seed.ts:227-255](scripts/seed.ts#L227-L255) — `about`, `contact`, `legal`, `privacy` all say only "{title} — محتوى قيد الإعداد"
- `getImageUrl` helper at [src/lib/utils.ts:29-35](src/lib/utils.ts#L29-L35) currently only reads from a Payload media object; needs URL fallback support
- Branch is clean (`feat/live-sports-surface`) — work happens here or on a new `feat/boss-preview-polish` branch (decided: new branch, smaller diff)
- Preview deploys via Vercel: `vercel link` already done if `.vercel/` exists; otherwise one-time link required
- `next.config.ts` whitelists only `media.api-sports.io` and local `/api/media/file/**`; bundling article photos into `/public/images/seed/` avoids any new whitelist work

---

## File Structure

**New files:**
- `public/images/seed/articles/01.jpg` through `12.jpg` — 12 royalty-free football photos (1200×630, ~150 KB each, sourced from Unsplash/Pexels with no-attribution licenses)
- `public/images/seed/README.md` — one-paragraph note on source + license

**Modified collections (additive only):**
- `src/collections/Clubs.ts` — add optional `logoUrl: text` field
- `src/collections/Competitions.ts` — add optional `logoUrl: text` field
- `src/collections/Articles.ts` — add optional `featuredImageUrl: text` field

**Generated:**
- `src/payload-types.ts` — regenerated by `pnpm generate:types` after schema changes (do not hand-edit)

**Modified UI components:**
- `src/components/layout/Header.tsx` — swap text spans for `<Image src="/images/logo.svg">`
- `src/components/layout/Footer.tsx` — swap text icon strings for `Facebook`, `Instagram`, `Twitter` (X), `Youtube` from `lucide-react`
- `src/lib/utils.ts` — add `getEntityLogoUrl(entity)` and `getArticleHeroUrl(article)` helpers that honor URL fallback
- `src/components/articles/ArticleCard.tsx` — use `getArticleHeroUrl`
- `src/components/home/HeroSection.tsx` — use `getArticleHeroUrl`
- `src/app/(frontend)/[locale]/articles/[slug]/page.tsx` — use `getArticleHeroUrl`
- `src/app/(frontend)/[locale]/club/page.tsx` — use `getEntityLogoUrl`
- `src/app/(frontend)/[locale]/club/[slug]/page.tsx` — use `getEntityLogoUrl`
- `src/app/(frontend)/[locale]/competition/page.tsx` — use `getEntityLogoUrl`
- `src/app/(frontend)/[locale]/competition/[slug]/page.tsx` — same (verified during task)

**Modified seeds (idempotent):**
- `scripts/seed.ts` — populate `logoUrl` on every existing club + competition; rewrite About/Contact/Legal/Privacy bodies with realistic content
- `scripts/seed-preview.ts` — assign `featuredImageUrl` from cycling through `01.jpg`...`12.jpg` for the 18 demo articles

**Tests (new):**
- `src/lib/__tests__/utils.test.ts` — covers `getEntityLogoUrl` and `getArticleHeroUrl` precedence
- Existing tests must continue to pass (`pnpm test:run`)

---

### Task 1: Real SVG logo in the header

**Files:**
- Modify: `src/components/layout/Header.tsx:15-18`

- [ ] **Step 1: Replace the text spans with the SVG via next/image**

Open [src/components/layout/Header.tsx](src/components/layout/Header.tsx) and replace lines 15–18 (the `<Link>` body) so it reads:

```tsx
<Link href={`/${locale}`} className="flex items-center" aria-label="MFM Sport">
  <Image
    src="/images/logo.svg"
    alt="MFM Sport"
    width={120}
    height={40}
    priority
    className="h-8 w-auto"
  />
</Link>
```

Add `import Image from "next/image";` at the top of the file (alongside the existing `Link` import).

- [ ] **Step 2: Run dev server and confirm visually**

Run: `pnpm dev` (kill any prior instance first; takes ~10s to bind to :3000)
Visit: `http://localhost:3000/ar`
Expected: red **MFM** + light **Sport** wordmark renders in the header at ~32px tall on desktop. No console warning about missing alt or layout shift.

- [ ] **Step 3: Commit**

```bash
git checkout -b feat/boss-preview-polish
git add src/components/layout/Header.tsx
git commit -m "feat(layout): swap text wordmark for real SVG logo in header"
```

---

### Task 2: Real social icons in the footer

**Files:**
- Modify: `src/components/layout/Footer.tsx:8-13` and `:47-60`

- [ ] **Step 1: Replace the text-letter array with lucide icon refs**

In [src/components/layout/Footer.tsx](src/components/layout/Footer.tsx), add this import below the existing `Link` import:

```tsx
import { Facebook, Instagram, Twitter, Youtube } from "lucide-react";
```

Then replace the `socialLinks` array (lines 8–13) with:

```tsx
const socialLinks = [
  { name: "Facebook", href: "https://facebook.com/mfmsport", Icon: Facebook },
  { name: "Instagram", href: "https://instagram.com/mfmsport", Icon: Instagram },
  { name: "X", href: "https://x.com/mfmsport", Icon: Twitter },
  { name: "YouTube", href: "https://youtube.com/mfmsport", Icon: Youtube },
];
```

And replace the `.map(...)` block at lines 47–60 with:

```tsx
{socialLinks.map(({ name, href, Icon }) => (
  <a
    key={name}
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center justify-center w-9 h-9 rounded-md bg-secondary text-muted-foreground hover:text-primary hover:bg-secondary/80 transition-colors"
    aria-label={name}
  >
    <Icon className="h-4 w-4" aria-hidden />
  </a>
))}
```

- [ ] **Step 2: Verify visually**

With dev server running, scroll to the bottom of `http://localhost:3000/ar`. Expected: four real glyph icons in the same red-on-hover boxes. Hover one — color shifts to brand red. Tab focus reaches each link.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Footer.tsx
git commit -m "feat(layout): replace text social icons with lucide glyphs"
```

---

### Task 3: Add `logoUrl` fallback to Clubs collection

**Files:**
- Modify: `src/collections/Clubs.ts`

- [ ] **Step 1: Add the field**

In [src/collections/Clubs.ts](src/collections/Clubs.ts), insert this field object inside the `fields` array, immediately after the `logo` upload field (after line 12):

```ts
{
  name: "logoUrl",
  type: "text",
  admin: {
    description: "Optional external logo URL fallback (used when 'logo' upload is empty). Useful for seeded preview data referencing API-Football's CDN.",
  },
},
```

- [ ] **Step 2: Regenerate Payload types**

Run: `pnpm generate:types`
Expected: `src/payload-types.ts` is regenerated; the `Club` interface now includes `logoUrl?: string | null`. No TypeScript errors when running `pnpm tsc --noEmit` (or `pnpm lint`).

- [ ] **Step 3: Commit**

```bash
git add src/collections/Clubs.ts src/payload-types.ts
git commit -m "feat(clubs): add optional logoUrl text fallback field"
```

---

### Task 4: Add `logoUrl` fallback to Competitions collection

**Files:**
- Modify: `src/collections/Competitions.ts`

- [ ] **Step 1: Add the field**

In [src/collections/Competitions.ts](src/collections/Competitions.ts), insert immediately after the `logo` upload field (after line 12):

```ts
{
  name: "logoUrl",
  type: "text",
  admin: {
    description: "Optional external logo URL fallback (used when 'logo' upload is empty). Useful for seeded preview data referencing API-Football's CDN.",
  },
},
```

- [ ] **Step 2: Regenerate Payload types**

Run: `pnpm generate:types`
Expected: `Competition` interface gains `logoUrl?: string | null`.

- [ ] **Step 3: Commit**

```bash
git add src/collections/Competitions.ts src/payload-types.ts
git commit -m "feat(competitions): add optional logoUrl text fallback field"
```

---

### Task 5: Add `featuredImageUrl` fallback to Articles collection

**Files:**
- Modify: `src/collections/Articles.ts`

- [ ] **Step 1: Add the field**

In [src/collections/Articles.ts](src/collections/Articles.ts), insert this field object immediately after the `featuredImage` upload (after line 43):

```ts
{
  name: "featuredImageUrl",
  type: "text",
  admin: {
    description: "Optional external image URL fallback (used when 'featuredImage' upload is empty). Used for preview seed data.",
  },
},
```

- [ ] **Step 2: Regenerate Payload types**

Run: `pnpm generate:types`
Expected: `Article` interface gains `featuredImageUrl?: string | null`.

- [ ] **Step 3: Commit**

```bash
git add src/collections/Articles.ts src/payload-types.ts
git commit -m "feat(articles): add optional featuredImageUrl text fallback field"
```

---

### Task 6: Generate Payload migration for the three new fields

**Files:**
- Create: a new file in `src/migrations/` (Payload names it automatically)

- [ ] **Step 1: Create the migration**

Run: `pnpm payload migrate:create boss-preview-fallbacks`
Expected: a file like `src/migrations/<timestamp>_boss_preview_fallbacks.ts` is created with `up` adding three nullable text columns (`articles.featured_image_url`, `clubs.logo_url`, `competitions.logo_url`) and `down` dropping them.

- [ ] **Step 2: Apply the migration to local Neon**

Run: `pnpm payload migrate`
Expected: console reports the migration as applied. No errors.

- [ ] **Step 3: Verify schema**

Open Payload admin at `http://localhost:3000/admin/collections/clubs`, click any club, scroll to find the new "Logo URL" field. Same check on a competition and an article.

- [ ] **Step 4: Commit**

```bash
git add src/migrations/
git commit -m "chore(db): migration for logoUrl + featuredImageUrl fallback columns"
```

---

### Task 7: Add `getEntityLogoUrl` and `getArticleHeroUrl` helpers (TDD)

**Files:**
- Modify: `src/lib/utils.ts`
- Create: `src/lib/__tests__/utils.test.ts`

- [ ] **Step 1: Write the failing tests**

Create [src/lib/__tests__/utils.test.ts](src/lib/__tests__/utils.test.ts):

```ts
import { describe, it, expect } from "vitest";
import { getEntityLogoUrl, getArticleHeroUrl } from "@/lib/utils";

describe("getEntityLogoUrl", () => {
  it("returns the upload's url when a Media object is set", () => {
    const entity = { logo: { url: "/api/media/file/wydad.png" }, logoUrl: null };
    expect(getEntityLogoUrl(entity)).toBe("/api/media/file/wydad.png");
  });

  it("falls back to logoUrl when logo is empty", () => {
    const entity = { logo: null, logoUrl: "https://media.api-sports.io/football/teams/965.png" };
    expect(getEntityLogoUrl(entity)).toBe("https://media.api-sports.io/football/teams/965.png");
  });

  it("prefers upload over logoUrl when both are set", () => {
    const entity = { logo: { url: "/api/media/file/x.png" }, logoUrl: "https://example.com/y.png" };
    expect(getEntityLogoUrl(entity)).toBe("/api/media/file/x.png");
  });

  it("returns null when neither is set", () => {
    expect(getEntityLogoUrl({ logo: null, logoUrl: null })).toBeNull();
    expect(getEntityLogoUrl({})).toBeNull();
  });

  it("treats logo as id (not object) by ignoring it and using logoUrl", () => {
    const entity = { logo: 42, logoUrl: "https://example.com/x.png" };
    expect(getEntityLogoUrl(entity)).toBe("https://example.com/x.png");
  });
});

describe("getArticleHeroUrl", () => {
  it("returns sized hero from upload when present", () => {
    const article = {
      featuredImage: { url: "/orig.jpg", sizes: { hero: { url: "/orig-1200.jpg" } } },
      featuredImageUrl: null,
    };
    expect(getArticleHeroUrl(article)).toBe("/orig-1200.jpg");
  });

  it("falls back to featuredImageUrl", () => {
    expect(
      getArticleHeroUrl({ featuredImage: null, featuredImageUrl: "/images/seed/articles/01.jpg" }),
    ).toBe("/images/seed/articles/01.jpg");
  });

  it("returns null when neither is set", () => {
    expect(getArticleHeroUrl({})).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm test:run src/lib/__tests__/utils.test.ts`
Expected: 8 failures with "getEntityLogoUrl is not a function" / "getArticleHeroUrl is not a function".

- [ ] **Step 3: Implement the helpers**

Append to [src/lib/utils.ts](src/lib/utils.ts):

```ts
type WithLogo = { logo?: unknown; logoUrl?: string | null };

export function getEntityLogoUrl(entity: WithLogo | null | undefined): string | null {
  if (!entity) return null;
  const logo = entity.logo;
  if (logo && typeof logo === "object" && "url" in logo && typeof (logo as { url: unknown }).url === "string") {
    return (logo as { url: string }).url;
  }
  if (typeof entity.logoUrl === "string" && entity.logoUrl.length > 0) {
    return entity.logoUrl;
  }
  return null;
}

type WithHero = { featuredImage?: unknown; featuredImageUrl?: string | null };

export function getArticleHeroUrl(article: WithHero | null | undefined, size: "thumbnail" | "card" | "hero" = "hero"): string | null {
  if (!article) return null;
  const upload = article.featuredImage;
  if (upload && typeof upload === "object") {
    const u = upload as { url?: string; sizes?: Record<string, { url?: string }> };
    const sized = u.sizes?.[size]?.url;
    if (sized) return sized;
    if (u.url) return u.url;
  }
  if (typeof article.featuredImageUrl === "string" && article.featuredImageUrl.length > 0) {
    return article.featuredImageUrl;
  }
  return null;
}
```

- [ ] **Step 4: Re-run tests and confirm they pass**

Run: `pnpm test:run src/lib/__tests__/utils.test.ts`
Expected: 8 passes, 0 failures.

- [ ] **Step 5: Confirm full suite still passes**

Run: `pnpm test:run`
Expected: green across the board (existing tests untouched).

- [ ] **Step 6: Commit**

```bash
git add src/lib/utils.ts src/lib/__tests__/utils.test.ts
git commit -m "feat(utils): add getEntityLogoUrl + getArticleHeroUrl with URL fallback"
```

---

### Task 8: Wire helpers into the four entity-card surfaces

**Files:**
- Modify: `src/components/articles/ArticleCard.tsx`
- Modify: `src/components/home/HeroSection.tsx`
- Modify: `src/app/(frontend)/[locale]/articles/[slug]/page.tsx`
- Modify: `src/app/(frontend)/[locale]/club/page.tsx`
- Modify: `src/app/(frontend)/[locale]/club/[slug]/page.tsx`
- Modify: `src/app/(frontend)/[locale]/competition/page.tsx`

- [ ] **Step 1: Update ArticleCard to use getArticleHeroUrl**

In [src/components/articles/ArticleCard.tsx](src/components/articles/ArticleCard.tsx), replace line 4's import:

```tsx
import { formatDate, getArticleHeroUrl, getImageAlt } from "@/lib/utils";
```

Replace lines 20–23 (the `imageUrl = getImageUrl(...)` block) with:

```tsx
const imageUrl = getArticleHeroUrl(article, size === "large" ? "hero" : "card");
```

- [ ] **Step 2: Update HeroSection identically**

In [src/components/home/HeroSection.tsx](src/components/home/HeroSection.tsx), update line 4's import to include `getArticleHeroUrl` and remove `getImageUrl`. Replace line 14:

```tsx
const heroImage = getArticleHeroUrl(featured, "hero");
```

- [ ] **Step 3: Update single article page**

In [src/app/(frontend)/[locale]/articles/[slug]/page.tsx](src/app/(frontend)/[locale]/articles/[slug]/page.tsx), update line 9's import to add `getArticleHeroUrl`. Replace line 25 and line 52 to use:

```tsx
const heroImageUrl = getArticleHeroUrl(article, "hero");
// ...
const heroImage = getArticleHeroUrl(article, "hero");
```

(`getImageUrl` may still be used for the author avatar; leave that import in place.)

- [ ] **Step 4: Update club index page**

In [src/app/(frontend)/[locale]/club/page.tsx](src/app/(frontend)/[locale]/club/page.tsx), add to the imports near the top:

```tsx
import { getEntityLogoUrl } from "@/lib/utils";
```

Replace line 34 (`const logoUrl = club.logo?.url ?? null;`) with:

```tsx
const logoUrl = getEntityLogoUrl(club);
```

- [ ] **Step 5: Update club detail page**

In [src/app/(frontend)/[locale]/club/[slug]/page.tsx](src/app/(frontend)/[locale]/club/[slug]/page.tsx), update line 10's import to:

```tsx
import { getEntityLogoUrl, getImageUrl } from "@/lib/utils";
```

Replace line 56:

```tsx
const logoUrl = getEntityLogoUrl(club);
```

(Note: the existing call also passed `"thumbnail"` size — drop that arg, the URL fallback is unsized; the `Image` component still renders at width=64 height=64 from the `<Image>` props on line 63.)

- [ ] **Step 6: Update competition index page**

In [src/app/(frontend)/[locale]/competition/page.tsx](src/app/(frontend)/[locale]/competition/page.tsx), add to imports:

```tsx
import { getEntityLogoUrl } from "@/lib/utils";
```

Replace line 59 (`const logoUrl = competition.logo?.url ?? null;`) with:

```tsx
const logoUrl = getEntityLogoUrl(competition);
```

- [ ] **Step 7: Inspect competition detail page**

Read [src/app/(frontend)/[locale]/competition/[slug]/page.tsx](src/app/(frontend)/[locale]/competition/[slug]/page.tsx) end-to-end. If it accesses `competition.logo?.url` or similar, replace with `getEntityLogoUrl(competition)` after adding the import. If it does not display a logo, no change needed — note this in the commit message.

- [ ] **Step 8: Run the test suite to confirm nothing regressed**

Run: `pnpm test:run`
Expected: all green.

- [ ] **Step 9: Commit**

```bash
git add src/components/articles/ArticleCard.tsx src/components/home/HeroSection.tsx src/app/\(frontend\)/\[locale\]
git commit -m "feat(ui): wire url-fallback helpers into card + hero + entity pages"
```

---

### Task 9: Bundle 12 royalty-free football photos

**Files:**
- Create: `public/images/seed/articles/01.jpg` through `12.jpg`
- Create: `public/images/seed/README.md`

- [ ] **Step 1: Make the directory**

Run: `mkdir -p public/images/seed/articles`

- [ ] **Step 2: Source 12 photos (manual step — agent should pause here for the user)**

Use Pexels (`https://www.pexels.com/license/` — free, no attribution required) or Unsplash (`https://unsplash.com/license` — free, attribution appreciated but not required). Search terms: "football", "soccer stadium", "soccer ball", "football crowd", "football match". Pick **12 photos** that read as generic football imagery (no recognizable Moroccan or specific team branding — those would mislead readers viewing the preview).

Save each as `public/images/seed/articles/01.jpg`...`12.jpg`. Target dimensions: 1200×630 (16:9, matches the `hero` image size in [src/collections/Media.ts:21-25](src/collections/Media.ts#L21-L25)). Target file size: under 200 KB each. Use any image tool to crop/compress (`sharp` is in deps and can be invoked from a quick node script if needed).

If the user has not supplied photos within 5 min of starting this step, fall back to using Pexels' API or `https://picsum.photos/seed/{n}/1200/630` URLs saved locally with `curl` — but generic Picsum images won't be football-themed, so prefer real photos.

- [ ] **Step 3: Verify file sizes**

Run: `ls -lh public/images/seed/articles/`
Expected: 12 .jpg files, each between 50 KB and 200 KB. If any exceed 200 KB, compress with `npx sharp -i in.jpg -o out.jpg --quality 80`.

- [ ] **Step 4: Write the README**

Create [public/images/seed/README.md](public/images/seed/README.md):

```markdown
# Seed Images

Bundled royalty-free football photos used by `scripts/seed-preview.ts` to give
the 18 demo articles a featured image during the boss-preview phase.

**Source:** Pexels (free, no-attribution license) — see https://www.pexels.com/license/
**Replacement:** these are removed once the WordPress migration runs and real
article imagery lands in Vercel Blob via Payload's `featuredImage` upload field.
```

- [ ] **Step 5: Commit**

```bash
git add public/images/seed/
git commit -m "chore(assets): bundle 12 royalty-free football photos for preview seed"
```

---

### Task 10: Update `seed.ts` — populate club + competition logos and rewrite static page bodies

**Files:**
- Modify: `scripts/seed.ts`

- [ ] **Step 1: Populate logoUrl on clubs**

In [scripts/seed.ts](scripts/seed.ts), inside the `clubs` array (lines 197–202), extend each entry with the API-Football logo URL. Pattern: `https://media.api-sports.io/football/teams/{apiFootballId}.png`. So:

```ts
const clubs: Array<{
  name: string;
  slug: string;
  apiFootballId: number;
  country: string;
  venue?: string;
  logoUrl: string;
}> = [
  { name: "Wydad AC", slug: "wydad-ac", apiFootballId: 965, country: "Morocco", venue: "Stade Mohammed V", logoUrl: "https://media.api-sports.io/football/teams/965.png" },
  { name: "Raja CA", slug: "raja-ca", apiFootballId: 967, country: "Morocco", venue: "Stade Mohammed V", logoUrl: "https://media.api-sports.io/football/teams/967.png" },
  { name: "FAR Rabat", slug: "far-rabat", apiFootballId: 973, country: "Morocco", venue: "Stade El Bachir", logoUrl: "https://media.api-sports.io/football/teams/973.png" },
  { name: "RS Berkane", slug: "rs-berkane", apiFootballId: 981, country: "Morocco", venue: "Stade Municipal de Berkane", logoUrl: "https://media.api-sports.io/football/teams/981.png" },
];
```

Then in the `payload.create({ collection: "clubs", data: { ... } })` call (lines 210–222) add `logoUrl: c.logoUrl,` to the data object.

**Idempotency note:** the existing `if (existing) { skip }` check at line 205 means re-running the seed will NOT update existing clubs. To force re-seed of `logoUrl` only, replace the skip with an `update` when an existing club is missing `logoUrl`:

```ts
for (const c of clubs) {
  const existing = await findBySlug(payload, "clubs", c.slug);
  if (existing) {
    if (!(existing as any).logoUrl) {
      await payload.update({
        collection: "clubs",
        id: existing.id,
        data: { logoUrl: c.logoUrl },
        overrideAccess: true,
      });
      console.log(`  [updated logoUrl] ${c.name}`);
    } else {
      console.log(`  [skip] ${c.name}`);
    }
    continue;
  }
  // ... rest of create logic
}
```

- [ ] **Step 2: Populate logoUrl on competitions**

In the `competitions` array (lines 132–153), add `logoUrl: \`https://media.api-sports.io/football/leagues/${apiFootballId}.png\`` to each entry. Easier: build it in the loop. Inside the `for (const c of competitions)` block at line 155, extend the data object on the create call:

```ts
await payload.create({
  collection: "competitions",
  data: {
    name: c.name,
    slug: c.slug,
    type: c.type,
    apiFootballId: c.apiFootballId,
    season: c.season,
    country: c.country,
    category: categoryId as any,
    logoUrl: `https://media.api-sports.io/football/leagues/${c.apiFootballId}.png`,
  },
  // ...
});
```

Apply the same idempotent-update pattern as Step 1 for existing rows missing `logoUrl`.

- [ ] **Step 3: Rewrite static page bodies with realistic content**

Replace the `placeholderBody` helper at lines 27–57 with a `paragraphBody(paragraphs: string[])` helper that builds a multi-paragraph Lexical doc:

```ts
function paragraphBody(paragraphs: string[], direction: "ltr" | "rtl" = "rtl") {
  return {
    root: {
      type: "root",
      format: "",
      indent: 0,
      version: 1,
      direction,
      children: paragraphs.map((text) => ({
        type: "paragraph",
        format: "",
        indent: 0,
        version: 1,
        direction,
        children: [
          { type: "text", text, format: 0, style: "", mode: "normal", detail: 0, version: 1 },
        ],
      })),
    },
  };
}
```

Then update `seedPages` (lines 227–255) to write real bodies for each page. About:

```ts
const aboutBody = [
  "MFM Sport هي بوابة مغربية متخصصة في كرة القدم، تقدم تغطية شاملة لأخبار البطولة الوطنية، المنتخبات المغربية والأفريقية، والدوريات الأوروبية الكبرى.",
  "نهدف إلى تقديم محتوى تحريري عميق ومحدث لحظة بلحظة، مع تركيز خاص على الكرة المغربية وإنجازات أسود الأطلس.",
  "فريقنا التحريري يعمل على مدار الساعة لتزويدكم بأحدث الأخبار، التحليلات، والإحصائيات من ملاعب كرة القدم حول العالم.",
];
```

Contact:

```ts
const contactBody = [
  "للتواصل مع فريق التحرير: editorial@mfmsport.ma",
  "للإعلان والشراكات: ads@mfmsport.ma",
  "نرحب بمساهماتكم وأفكاركم. تابعونا أيضاً على شبكاتنا الاجتماعية للتفاعل المباشر.",
];
```

Legal:

```ts
const legalBody = [
  "جميع المحتويات المنشورة على موقع MFM Sport محمية بموجب قوانين الملكية الفكرية المغربية والدولية.",
  "يحظر إعادة نشر أي محتوى دون إذن خطي مسبق من إدارة الموقع.",
  "MFM Sport غير مسؤولة عن محتوى المواقع الخارجية المرتبطة عبر روابط من هذا الموقع.",
];
```

Privacy:

```ts
const privacyBody = [
  "نحترم خصوصيتكم. لا نجمع بياناتكم الشخصية إلا عند الاشتراك في النشرة الإخبارية أو التواصل معنا.",
  "نستخدم ملفات تعريف الارتباط (cookies) لتحسين تجربة التصفح وقياس أداء الموقع عبر Google Analytics وVercel Analytics.",
  "يمكنكم طلب حذف بياناتكم في أي وقت عبر التواصل على privacy@mfmsport.ma.",
];
```

Map each slug to its body in the `pages` array, then in the create call:

```ts
const pages: Array<{ title: string; slug: string; body: string[] }> = [
  { title: "من نحن", slug: "about", body: aboutBody },
  { title: "اتصل بنا", slug: "contact", body: contactBody },
  { title: "إشعار قانوني", slug: "legal", body: legalBody },
  { title: "سياسة الخصوصية", slug: "privacy", body: privacyBody },
];

for (const p of pages) {
  const existing = await findBySlug(payload, "pages", p.slug);
  // For existing pages with placeholder body, force-update
  if (existing) {
    await payload.update({
      collection: "pages",
      id: existing.id,
      data: { body: paragraphBody(p.body, "rtl") as any },
      locale: "ar",
      overrideAccess: true,
    });
    console.log(`  [updated body] ${p.title}`);
    continue;
  }
  await payload.create({
    collection: "pages",
    data: { title: p.title, slug: p.slug, body: paragraphBody(p.body, "rtl") as any },
    locale: "ar",
    overrideAccess: true,
  });
  console.log(`  [created] ${p.title}`);
}
```

- [ ] **Step 4: Run the seed against local DB**

Stop the dev server first (release the DB connection).
Run: `pnpm seed`
Expected output snippet:
```
--- Seeding Clubs ---
  [updated logoUrl] Wydad AC
  [updated logoUrl] Raja CA
  [updated logoUrl] FAR Rabat
  [updated logoUrl] RS Berkane
--- Seeding Competitions ---
  [updated logoUrl] Botola Pro 1
  ... (12 competitions total)
--- Seeding Pages ---
  [updated body] من نحن
  [updated body] اتصل بنا
  [updated body] إشعار قانوني
  [updated body] سياسة الخصوصية
=== Seed Complete ===
```

- [ ] **Step 5: Spot-check via admin**

Restart the dev server. Visit `http://localhost:3000/admin/collections/clubs/{any-id}` — confirm the new "Logo URL" field shows the api-sports.io URL. Same for any competition.

- [ ] **Step 6: Commit**

```bash
git add scripts/seed.ts
git commit -m "feat(seed): populate club + competition logoUrl + rewrite static page bodies"
```

---

### Task 11: Update `seed-preview.ts` — attach featured images to demo articles

**Files:**
- Modify: `scripts/seed-preview.ts`

- [ ] **Step 1: Add image cycling to the seed script**

In [scripts/seed-preview.ts](scripts/seed-preview.ts), in `seedArticles` near the top of the function (around line 256), add:

```ts
const SEED_IMAGE_COUNT = 12;
function seedImageFor(index: number): string {
  const n = String((index % SEED_IMAGE_COUNT) + 1).padStart(2, "0");
  return `/images/seed/articles/${n}.jpg`;
}
```

Then in the loop (line 269 onwards), give each demo article a `featuredImageUrl`:

```ts
let articleIndex = 0;
for (const a of DEMO_ARTICLES) {
  const slug = `${DEMO_PREFIX}${a.slugSuffix}`;
  const featuredImageUrl = seedImageFor(articleIndex++);
  const existing = await payload.find({ /* ... unchanged ... */ });
  if (existing.docs[0]) {
    // Backfill if missing — no-op if already populated
    if (!(existing.docs[0] as any).featuredImageUrl) {
      await payload.update({
        collection: "articles",
        id: existing.docs[0].id,
        data: { featuredImageUrl },
        overrideAccess: true,
      });
      console.log(`  [backfilled image] ${slug}`);
    } else {
      console.log(`  [skip] ${slug}`);
    }
    continue;
  }
  // ... existing create logic ...
  const created = await payload.create({
    collection: "articles",
    data: {
      // ... existing fields ...
      featuredImageUrl,  // <-- add this
    },
    locale: "ar",
    overrideAccess: true,
  });
  // ... rest unchanged
}
```

- [ ] **Step 2: Run the preview seed**

Run: `pnpm seed:preview`
Expected: 18 lines reading `[backfilled image] demo-...` (because the demo articles already exist from a prior run). If the DB was wiped, expect `[created] demo-...` lines instead.

- [ ] **Step 3: Smoke-test the homepage**

Restart dev server. Visit `http://localhost:3000/ar`. Expected: hero card and the secondary stack now show real football photos. Card grids in "أهم الأخبار" and "آخر الأخبار" sections show varied images instead of grey "MFM Sport" placeholders.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-preview.ts
git commit -m "feat(seed-preview): attach featured images to all 18 demo articles"
```

---

### Task 12: Layout QA pass via Playwright — homepage in all 3 locales

**Files:** None edited in this task; create a screenshots dump for self-review.

- [ ] **Step 1: Start the dev server (if not running)**

Run: `pnpm dev` in the background.

- [ ] **Step 2: Visit each homepage variant via Playwright MCP**

Use the `mcp__plugin_playwright_playwright__browser_navigate` tool for each URL, then `mcp__plugin_playwright_playwright__browser_take_screenshot` (full page, save to `/tmp/preview-qa-<locale>.png`):

- `http://localhost:3000/ar` (RTL)
- `http://localhost:3000/fr` (LTR)
- `http://localhost:3000/en` (LTR)

For each: also resize to mobile (375×667) via `browser_resize` and re-screenshot to `/tmp/preview-qa-<locale>-mobile.png`.

- [ ] **Step 3: Read each screenshot and list issues**

For each of the 6 screenshots, scan for:
- Hero image present and not stretched/distorted
- Cards render with images (no grey placeholders for demo articles)
- Header logo SVG renders crisply (not pixelated)
- Footer social icons render as glyphs (not broken text)
- Match cards have team logos (api-sports.io)
- Live "Live Now" section either shows fixtures or is gracefully hidden when none are live
- RTL layout on /ar: text right-aligned, nav reads right-to-left, logo on the right
- No horizontal scroll on mobile
- No raw `[object Object]` strings, no untranslated keys (e.g., literal `home.topNews`)

Write a `/tmp/preview-qa-issues.md` listing each issue found, with locale + viewport + selector + suggested fix.

- [ ] **Step 4: Fix issues, one by one**

For each issue: open the affected file, make the minimal fix, re-screenshot, mark resolved. If a fix touches new files outside this plan, **ask the user before extending scope**.

- [ ] **Step 5: Commit any fixes as one polish commit**

```bash
git add -A
git commit -m "fix(layout): polish pass on homepage across ar/fr/en, desktop+mobile"
```

(If no fixes were needed, skip the commit and note "no layout issues found" in the next step's summary.)

---

### Task 13: Layout QA pass — article detail, club detail, competition detail, matches, search

**Files:** None edited unless issues are found.

- [ ] **Step 1: Capture screenshots for each route**

For locale = `ar` (the primary surface, also exercises RTL — if issues appear here, also recheck `fr` and `en`):
- `http://localhost:3000/ar/articles` (paginated list)
- `http://localhost:3000/ar/articles/demo-botola-matchday-review` (single article — the most-recent demo)
- `http://localhost:3000/ar/club` (clubs index)
- `http://localhost:3000/ar/club/wydad-ac` (single club — should now show crest)
- `http://localhost:3000/ar/competition` (competitions index)
- `http://localhost:3000/ar/competition/botola-pro-1` (single competition)
- `http://localhost:3000/ar/matches` (today's matches)
- `http://localhost:3000/ar/category/el-botola` (category archive)
- `http://localhost:3000/ar/videos` (video hub — likely empty since no demo article is flagged `isVideo`; confirm graceful empty state)
- `http://localhost:3000/ar/search?q=الوداد` (search)
- `http://localhost:3000/ar/about` (now has real content from Task 10)

Screenshot each at desktop (1280×800) and mobile (375×667). Save under `/tmp/preview-qa-route/`.

- [ ] **Step 2: Audit each screenshot**

Look for: missing images, broken layouts, untranslated strings, overflow, RTL bugs, empty states with no helpful copy. List issues in `/tmp/preview-qa-issues.md`.

- [ ] **Step 3: Fix found issues**

Common likely fixes:
- Empty videos page: ensure the `videos.noVideos` translation renders (already in [messages/ar.json:131](messages/ar.json#L131)) — no code change needed; just verify
- Empty search results: ensure the input + "no results" copy looks intentional
- Club crest not rendering: confirm `getEntityLogoUrl` was wired into ALL club display surfaces (re-check Task 8 step 5)

For each fix, edit the affected file, re-screenshot, confirm resolved.

- [ ] **Step 4: Commit fixes**

```bash
git add -A
git commit -m "fix(layout): polish pass on article + club + competition + matches + search"
```

(Skip if no fixes were needed.)

---

### Task 14: Add favicon + open-graph default image

**Files:**
- Create: `src/app/icon.png` (32×32 favicon, derived from `public/images/logo.svg`)
- Create: `src/app/apple-icon.png` (180×180)
- Create: `src/app/opengraph-image.png` (1200×630 default OG)

- [ ] **Step 1: Generate the favicon and apple touch icon**

Use sharp via a quick one-shot node script (no need to commit the script):

```bash
node -e "
const sharp = require('sharp');
const fs = require('fs');
const svg = fs.readFileSync('public/images/logo.svg');
sharp(svg).resize(32, 32).png().toFile('src/app/icon.png');
sharp(svg).resize(180, 180).png().toFile('src/app/apple-icon.png');
"
```

Expected: two PNG files appear in `src/app/`.

- [ ] **Step 2: Generate a default OG image**

Either reuse one of the bundled seed photos as a stand-in:

```bash
cp public/images/seed/articles/01.jpg src/app/opengraph-image.jpg
```

(Next.js auto-detects `.jpg` and `.png` extensions for `opengraph-image`.)

Or create a branded variant via sharp (overlay logo on photo) — only if time permits. The simple cp is acceptable for a preview.

- [ ] **Step 3: Verify**

Restart dev server. Visit `http://localhost:3000/ar` and view source — confirm `<link rel="icon">` and `<meta property="og:image">` references resolve to 200 OK responses (open the URLs in a new tab to confirm).

- [ ] **Step 4: Commit**

```bash
git add src/app/icon.png src/app/apple-icon.png src/app/opengraph-image.jpg
git commit -m "chore(brand): add favicon, apple-touch-icon, default OG image"
```

---

### Task 15: Run the full local test + lint + build check

**Files:** None — verification only.

- [ ] **Step 1: Lint**

Run: `pnpm lint`
Expected: zero errors. If warnings appear from existing files (pre-this-plan), note them but do not fix in this plan.

- [ ] **Step 2: Tests**

Run: `pnpm test:run`
Expected: all green.

- [ ] **Step 3: Production build (catches SSR/RSC issues that dev mode hides)**

Run: `pnpm build`
Expected: completes without error. The build will complain if any new image URL hits a non-whitelisted host or if any TS error slipped through. Common gotcha: `media.api-sports.io` is whitelisted but other hosts are not — verify only that host (and local `/images/seed/...`) are referenced in the seeded data.

- [ ] **Step 4: Production server smoke test**

Run: `pnpm start` (background)
Visit `http://localhost:3000/ar` — confirm same visual result as `pnpm dev`.

- [ ] **Step 5: Commit any quick fixes from the build**

If `pnpm build` surfaced a fix (e.g., missing `Image` import after Task 1), commit it now:

```bash
git add -A
git commit -m "fix: production build issues surfaced during pre-deploy check"
```

(Skip if clean.)

---

### Task 16: Deploy to Vercel preview URL

**Files:** None — deploy step.

- [ ] **Step 1: Confirm Vercel CLI is linked to the project**

Run: `npx vercel whoami`
Expected: prints the linked account email. If not linked, run `npx vercel login` and follow the prompt — the user will need to authorize via browser.

Run: `ls .vercel/` — if the directory does not exist, run `npx vercel link` and accept defaults to link to the existing `mfm-sport` Vercel project.

- [ ] **Step 2: Push the branch to git**

Confirm the branch is `feat/boss-preview-polish` (created in Task 1):

```bash
git push -u origin feat/boss-preview-polish
```

- [ ] **Step 3: Trigger a preview deployment**

Run: `npx vercel --no-clipboard`
Expected: Vercel uploads, builds, and prints a preview URL in the form `https://mfm-sport-<hash>.vercel.app`. Build duration ~3-5 min.

If env vars are not yet set on Vercel for this branch (DATABASE_URL, PAYLOAD_SECRET, BLOB_READ_WRITE_TOKEN), the build will fail with a clear missing-env message. In that case, ask the user to either (a) supply the production env values to copy, or (b) use the production-aliased database for the preview (acceptable since this is read-only-from-public-perspective preview).

- [ ] **Step 4: Smoke-test the preview URL**

Visit the printed URL in a browser — confirm:
- Homepage renders identical to local
- All 3 locales work (`/ar`, `/fr`, `/en`)
- Images load (both bundled seed photos AND api-sports.io logos)
- No 500s in the Vercel function logs (`npx vercel logs <url>`)

- [ ] **Step 5: Capture the URL and write a hand-off note**

Create [docs/superpowers/specs/2026-05-06-boss-preview-handoff.md](docs/superpowers/specs/2026-05-06-boss-preview-handoff.md):

```markdown
# Boss Preview — Handoff

**Preview URL:** <PASTE the vercel URL>
**Branch:** feat/boss-preview-polish
**Built from commit:** <git rev-parse --short HEAD>
**Date:** 2026-05-06

## What's in this preview
- Real SVG logo + lucide social icons
- 18 demo articles with themed featured photos (royalty-free Pexels)
- 4 Moroccan clubs (Wydad, Raja, FAR, Berkane) with API-Football crests
- 12 competitions (Botola, CAF, Premier League, La Liga, etc.) with logos
- Live match data via API-Football (today's fixtures + live polling)
- AR / FR / EN locales, RTL on Arabic
- About / Contact / Legal / Privacy with real copy (Arabic only — FR/EN deferred)
- Newsletter signup form (functional with Resend if RESEND_API_KEY is set)

## What's NOT in this preview (intentional)
- WordPress migration content (deferred to post-approval per project plan)
- French / English translations of static pages (Arabic is the primary surface)
- Real ad slots (NEXT_PUBLIC_ADSENSE_CLIENT_ID intentionally unset)
- Full club hubs with squads / player profiles (Phase 2 per PROJECT_MEMORY.md §10)

## To swap to production content after approval
1. Run `pnpm seed:preview:reset` (deletes demo- prefixed docs)
2. Follow [WP_MIGRATION_HANDOFF.md](../../../WP_MIGRATION_HANDOFF.md) to import 200 real articles
```

- [ ] **Step 6: Commit the handoff note and final push**

```bash
git add docs/superpowers/specs/2026-05-06-boss-preview-handoff.md
git commit -m "docs: boss preview handoff with deployment URL"
git push
```

- [ ] **Step 7: Share the URL with the user**

Print the Vercel preview URL prominently in the agent's final message and instruct the user to forward it to the boss.

---

## Out of Scope (do NOT implement in this plan)

- WordPress migration (`pnpm migrate:wp`) — explicitly deferred per user note
- Translating About/Contact/Legal/Privacy to FR/EN — Arabic is the primary surface; if the boss demands it, follow up in a separate plan
- Production custom domain DNS cutover (`mfmsport.ma`) — preview URL is sufficient for boss review
- AdSense activation — separate workflow, awaiting approval per [project_ad_banners memory](../../memory/project_ad_banners.md)
- Squad / player profile pages — Phase 2
- Live event timeline beyond what already exists — already shipped on `feat/live-sports-surface`
- Replacing demo article bodies with longer content — short bodies are intentional placeholders for "coming after migration"

---

## Self-Review

**Spec coverage check (against the user's request):**
- "working preview of the websites" → Task 16 (Vercel preview URL) ✓
- "logos" → Task 1 (header), Task 2 (footer), Tasks 3+4+8+10 (clubs + competitions) ✓
- "the images" → Tasks 5+8+9+11 (featured images on demo articles) ✓
- "some blogs for the showing" → Existing seed-preview.ts already creates 18 articles; Task 11 gives them images ✓
- "wp migration last" → explicitly out of scope (see Out of Scope section) ✓
- "refine the design and the look so there won't be problems in the layout" → Tasks 12+13 (Playwright QA pass on every key route in all 3 locales, with mobile + desktop) ✓

**Type consistency check:**
- `getEntityLogoUrl(entity)` used identically in Tasks 7, 8, 10 ✓
- `getArticleHeroUrl(article, size?)` used identically in Tasks 7, 8 ✓
- `featuredImageUrl` field name used identically in Tasks 5, 6, 7, 11 ✓
- `logoUrl` field name used identically in Tasks 3, 4, 6, 7, 8, 10 ✓
- Migration field name `clubs.logo_url` (snake_case) matches Postgres convention used in [src/migrations/](src/migrations/) ✓

**Placeholder scan:** No "TBD", "implement later", or "similar to Task N" found. Every code step shows the actual code. Every command shows the actual command and expected output. ✓

**Decomposition check:** Each task produces an independently reviewable, working state — header polish ships independently of footer, schema changes ship independently of seed updates, etc. The deploy step at the end is the only one that requires all prior tasks to be complete.

---

*Plan complete.*
