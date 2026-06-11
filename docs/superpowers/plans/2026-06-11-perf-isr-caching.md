# P0 Performance: ISR Caching + Path-Based Pagination — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve article-detail and articles/category listing pages from the edge CDN as ISR-cached static pages (instead of per-request dynamic renders that hit a US-East database from EU functions), with on-demand revalidation so content stays instantly fresh.

**Architecture:** Move listing pagination out of `?page=` (which forces dynamic rendering) into `/page/[n]` path segments so listings can be statically cached. Add `revalidate = 3600` to detail + listings, `generateStaticParams` (with safe DB-failure fallback) to article detail, and Payload `afterChange`/`afterDelete` hooks that call `revalidatePath()` so edits appear immediately. Listing bodies are extracted into shared server components so the base route and `/page/[n]` route share one implementation.

**Tech Stack:** Next.js 16 App Router, Payload CMS 3, next-intl, TypeScript, Vitest, pnpm. Spec: [docs/superpowers/specs/2026-06-11-perf-isr-caching-design.md](../specs/2026-06-11-perf-isr-caching-design.md).

---

## File Structure

**Create:**
- `src/lib/pagination.ts` — pure helpers `parsePageParam`, `pageHref`.
- `src/lib/pagination.test.ts` — tests for the above.
- `src/lib/payload/revalidate.ts` — pure path builders `articlePaths`/`categoryPaths` + Payload hooks.
- `src/lib/payload/revalidate.test.ts` — tests for the path builders.
- `src/components/articles/ArticlesListing.tsx` — shared articles-listing server component.
- `src/components/articles/CategoryListing.tsx` — shared category-listing server component.
- `src/app/(frontend)/[locale]/articles/page/[n]/page.tsx` — articles listing page 2+.
- `src/app/(frontend)/[locale]/category/[slug]/page/[n]/page.tsx` — category listing page 2+.

**Modify:**
- `src/components/shared/Pagination.tsx` — emit path-based URLs.
- `src/lib/payload/queries.ts` — add `getAllArticleSlugs`.
- `src/app/(frontend)/[locale]/articles/[slug]/page.tsx` — add `revalidate` + `generateStaticParams`.
- `src/app/(frontend)/[locale]/articles/page.tsx` — drop `searchParams`, delegate to `ArticlesListing`, add `revalidate`.
- `src/app/(frontend)/[locale]/category/[slug]/page.tsx` — drop `searchParams`, delegate to `CategoryListing`, add `revalidate`.
- `src/collections/Articles.ts` — wire revalidation hooks.
- `src/collections/Categories.ts` — wire revalidation hooks.
- `next.config.ts` — add `redirects()` for legacy `?page=N`.

---

## Task 1: Pagination helpers (pure, TDD)

**Files:**
- Create: `src/lib/pagination.ts`
- Test: `src/lib/pagination.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/pagination.test.ts
import { describe, it, expect } from "vitest";
import { parsePageParam, pageHref } from "./pagination";

describe("parsePageParam", () => {
  it("defaults to 1 when undefined", () => {
    expect(parsePageParam(undefined)).toBe(1);
  });
  it("parses a positive integer string", () => {
    expect(parsePageParam("4")).toBe(4);
  });
  it("falls back to 1 for non-numeric input", () => {
    expect(parsePageParam("abc")).toBe(1);
  });
  it("falls back to 1 for zero or negative", () => {
    expect(parsePageParam("0")).toBe(1);
    expect(parsePageParam("-3")).toBe(1);
  });
});

describe("pageHref", () => {
  it("returns the base path for page 1", () => {
    expect(pageHref("/ar/articles", 1)).toBe("/ar/articles");
  });
  it("appends /page/N for pages beyond 1", () => {
    expect(pageHref("/ar/articles", 2)).toBe("/ar/articles/page/2");
    expect(pageHref("/fr/category/foot", 5)).toBe("/fr/category/foot/page/5");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/pagination.test.ts`
Expected: FAIL — `Failed to resolve import "./pagination"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/pagination.ts

/** Parse a page value from a URL segment/param. Returns a 1-based page, defaulting to 1. */
export function parsePageParam(raw: string | undefined): number {
  const n = parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Build a listing href: page 1 → base path, page N>1 → `${basePath}/page/${N}`. */
export function pageHref(basePath: string, page: number): string {
  return page <= 1 ? basePath : `${basePath}/page/${page}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/pagination.test.ts`
Expected: PASS (8 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pagination.ts src/lib/pagination.test.ts
git commit -m "feat(perf): add path-based pagination helpers"
```

---

## Task 2: Pagination component uses path-based URLs

**Files:**
- Modify: `src/components/shared/Pagination.tsx`

- [ ] **Step 1: Replace the inline `pageUrl` with the shared helper**

In `src/components/shared/Pagination.tsx`, add the import at the top (below the existing imports):

```ts
import { pageHref } from "@/lib/pagination";
```

Then delete this local function:

```ts
  function pageUrl(page: number) {
    return page === 1 ? basePath : `${basePath}?page=${page}`;
  }
```

And replace the three `pageUrl(...)` call sites so they use `pageHref(basePath, ...)`:
- `pageUrl(currentPage - 1)` → `pageHref(basePath, currentPage - 1)`
- `pageUrl(page)` → `pageHref(basePath, page)`
- `pageUrl(currentPage + 1)` → `pageHref(basePath, currentPage + 1)`

- [ ] **Step 2: Typecheck/lint the file**

Run: `pnpm lint`
Expected: PASS (no new errors in `Pagination.tsx`).

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/Pagination.tsx
git commit -m "feat(perf): pagination links use /page/[n] paths"
```

---

## Task 3: Revalidation path builders (pure, TDD)

**Files:**
- Create: `src/lib/payload/revalidate.ts` (builders only in this task; hooks added in Task 8)
- Test: `src/lib/payload/revalidate.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/payload/revalidate.test.ts
import { describe, it, expect } from "vitest";
import { articlePaths, categoryPaths } from "./revalidate";

describe("articlePaths", () => {
  it("includes homepage + articles listing for every locale", () => {
    const paths = articlePaths({}, []);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/ar", "/fr", "/en",
        "/ar/articles", "/fr/articles", "/en/articles",
      ]),
    );
  });
  it("includes the localized article path when a slug exists for that locale", () => {
    const paths = articlePaths({ ar: "كرة", fr: "foot", en: "ball" }, []);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/ar/articles/كرة", "/fr/articles/foot", "/en/articles/ball",
      ]),
    );
  });
  it("includes category paths for every locale when category slugs are given", () => {
    const paths = articlePaths({}, ["foot", "tennis"]);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/ar/category/foot", "/fr/category/tennis", "/en/category/foot",
      ]),
    );
  });
  it("does not duplicate paths", () => {
    const paths = articlePaths({ ar: "x" }, ["foot", "foot"]);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe("categoryPaths", () => {
  it("includes homepage, articles listing, and the category page per locale", () => {
    expect(categoryPaths("foot")).toEqual(
      expect.arrayContaining([
        "/ar", "/ar/articles", "/ar/category/foot",
        "/fr/category/foot", "/en/category/foot",
      ]),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/payload/revalidate.test.ts`
Expected: FAIL — `Failed to resolve import "./revalidate"`.

- [ ] **Step 3: Write minimal implementation (builders only)**

```ts
// src/lib/payload/revalidate.ts
const LOCALES = ["ar", "fr", "en"] as const;

/** Pages affected when an article changes: homepage + listing per locale,
 *  the localized article page where a slug exists, and each category page. */
export function articlePaths(
  slugByLocale: Partial<Record<string, string>>,
  categorySlugs: string[],
): string[] {
  const paths = new Set<string>();
  for (const locale of LOCALES) {
    paths.add(`/${locale}`);
    paths.add(`/${locale}/articles`);
    const slug = slugByLocale[locale];
    if (slug) paths.add(`/${locale}/articles/${slug}`);
    for (const c of categorySlugs) {
      if (c) paths.add(`/${locale}/category/${c}`);
    }
  }
  return [...paths];
}

/** Pages affected when a category changes (category slug is not localized). */
export function categoryPaths(categorySlug: string): string[] {
  const paths = new Set<string>();
  for (const locale of LOCALES) {
    paths.add(`/${locale}`);
    paths.add(`/${locale}/articles`);
    if (categorySlug) paths.add(`/${locale}/category/${categorySlug}`);
  }
  return [...paths];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/payload/revalidate.test.ts`
Expected: PASS (5 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/lib/payload/revalidate.ts src/lib/payload/revalidate.test.ts
git commit -m "feat(perf): add revalidate path builders for articles/categories"
```

---

## Task 4: `getAllArticleSlugs` query helper

**Files:**
- Modify: `src/lib/payload/queries.ts`

- [ ] **Step 1: Add the helper**

Append to `src/lib/payload/queries.ts` (after `getArticles`, anywhere at module top level):

```ts
/** All published article slugs across every locale — for generateStaticParams. */
export async function getAllArticleSlugs(): Promise<
  Array<{ locale: Locale; slug: string }>
> {
  const payload = await getPayloadClient();
  const res = await payload.find({
    collection: "articles",
    where: { status: { equals: "published" } },
    locale: "all",
    depth: 0,
    pagination: false,
    limit: 0,
  });
  const out: Array<{ locale: Locale; slug: string }> = [];
  for (const doc of res.docs) {
    const slugByLocale = doc.slug as unknown as Partial<Record<Locale, string>>;
    for (const locale of ["ar", "fr", "en"] as const) {
      const slug = slugByLocale[locale];
      if (slug) out.push({ locale, slug });
    }
  }
  return out;
}
```

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: PASS (no new errors in `queries.ts`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/payload/queries.ts
git commit -m "feat(perf): add getAllArticleSlugs for static params"
```

---

## Task 5: Article detail — ISR + generateStaticParams

**Files:**
- Modify: `src/app/(frontend)/[locale]/articles/[slug]/page.tsx`

- [ ] **Step 1: Add the import**

In `src/app/(frontend)/[locale]/articles/[slug]/page.tsx`, add `getAllArticleSlugs` to the existing import from `@/lib/payload/queries` (which already imports `getArticleBySlug`, `resolveArticleBySlug`, etc.):

```ts
import {
  getArticleBySlug,
  getArticleLocalizedSlugs,
  resolveArticleBySlug,
  getRelatedArticles,
  getArticles,
  getAllArticleSlugs,
} from "@/lib/payload/queries";
```

- [ ] **Step 2: Add `revalidate` + `generateStaticParams`**

Directly below the existing `type Props = { ... }` declaration (around line 37), add:

```ts
export const revalidate = 3600;

export async function generateStaticParams() {
  try {
    const slugs = await getAllArticleSlugs();
    return slugs.map(({ locale, slug }) => ({ locale, slug }));
  } catch (err) {
    // DB unreachable at build time → fall back to on-demand rendering.
    console.error("[articles/[slug]] generateStaticParams failed:", err);
    return [];
  }
}
```

(`dynamicParams` stays at its default `true`, so slugs not in the prebuilt set still render on demand.)

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: PASS (no new errors in the file).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(frontend)/[locale]/articles/[slug]/page.tsx"
git commit -m "feat(perf): ISR + static params for article detail pages"
```

---

## Task 6: Articles listing — shared component + page-1 + /page/[n]

**Files:**
- Create: `src/components/articles/ArticlesListing.tsx`
- Modify: `src/app/(frontend)/[locale]/articles/page.tsx`
- Create: `src/app/(frontend)/[locale]/articles/page/[n]/page.tsx`

- [ ] **Step 1: Create the shared listing component**

```tsx
// src/components/articles/ArticlesListing.tsx
import type { Config } from "@/payload-types";
import { getTranslations } from "next-intl/server";
import { getArticles } from "@/lib/payload/queries";
import { getAds } from "@/lib/payload/ads";
import { ArticleGrid } from "@/components/articles/ArticleGrid";
import { Pagination } from "@/components/shared/Pagination";

export async function ArticlesListing({
  locale,
  page,
}: {
  locale: string;
  page: number;
}) {
  const loc = locale as Config["locale"];
  const [result, ads, t] = await Promise.all([
    getArticles({ locale: loc, page, limit: 12 }),
    getAds(loc),
    getTranslations({ locale, namespace: "article" }),
  ]);

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">{t("allArticles")}</h1>

      {result.docs.length > 0 ? (
        <>
          <ArticleGrid
            articles={result.docs}
            locale={locale}
            columns={3}
            withAds
            adCards={ads["news-card"]}
          />
          <Pagination
            currentPage={result.page!}
            totalPages={result.totalPages}
            basePath={`/${locale}/articles`}
          />
        </>
      ) : (
        <p className="text-muted-foreground text-center py-12">
          {t("noArticles")}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Replace the base articles page**

Overwrite `src/app/(frontend)/[locale]/articles/page.tsx` with:

```tsx
import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ArticlesListing } from "@/components/articles/ArticlesListing";

export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "article" });
  return {
    title: `${t("allArticles")} | MFM Sport`,
  };
}

export default async function ArticlesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ArticlesListing locale={locale} page={1} />;
}
```

- [ ] **Step 3: Create the `/page/[n]` route**

```tsx
// src/app/(frontend)/[locale]/articles/page/[n]/page.tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ArticlesListing } from "@/components/articles/ArticlesListing";
import { parsePageParam } from "@/lib/pagination";

export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string; n: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "article" });
  return {
    title: `${t("allArticles")} | MFM Sport`,
    robots: { index: false, follow: true },
  };
}

export default async function ArticlesPageN({ params }: Props) {
  const { locale, n } = await params;
  setRequestLocale(locale);
  const page = parsePageParam(n);
  if (page <= 1) redirect(`/${locale}/articles`);
  return <ArticlesListing locale={locale} page={page} />;
}
```

- [ ] **Step 4: Lint**

Run: `pnpm lint`
Expected: PASS (no new errors in the three files).

- [ ] **Step 5: Commit**

```bash
git add "src/components/articles/ArticlesListing.tsx" \
        "src/app/(frontend)/[locale]/articles/page.tsx" \
        "src/app/(frontend)/[locale]/articles/page/[n]/page.tsx"
git commit -m "feat(perf): cacheable articles listing with /page/[n] routing"
```

---

## Task 7: Category listing — shared component + page-1 + /page/[n]

**Files:**
- Create: `src/components/articles/CategoryListing.tsx`
- Modify: `src/app/(frontend)/[locale]/category/[slug]/page.tsx`
- Create: `src/app/(frontend)/[locale]/category/[slug]/page/[n]/page.tsx`

- [ ] **Step 1: Create the shared category listing component**

```tsx
// src/components/articles/CategoryListing.tsx
import type { Config } from "@/payload-types";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCategoryBySlug, getArticlesByCategory } from "@/lib/payload/queries";
import { ArticleGrid } from "@/components/articles/ArticleGrid";
import { Pagination } from "@/components/shared/Pagination";

export async function CategoryListing({
  locale,
  slug,
  page,
}: {
  locale: string;
  slug: string;
  page: number;
}) {
  const loc = locale as Config["locale"];
  const category = await getCategoryBySlug(slug, loc);
  if (!category) notFound();

  const [result, t] = await Promise.all([
    getArticlesByCategory(category.id, loc, page),
    getTranslations({ locale, namespace: "category" }),
  ]);

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-2">{category.name}</h1>
      {category.description && (
        <p className="text-muted-foreground mb-6">{category.description}</p>
      )}

      {result.docs.length > 0 ? (
        <>
          <ArticleGrid articles={result.docs} locale={locale} columns={3} withAds />
          <Pagination
            currentPage={result.page!}
            totalPages={result.totalPages}
            basePath={`/${locale}/category/${slug}`}
          />
        </>
      ) : (
        <p className="text-muted-foreground text-center py-12">
          {t("allIn")} {category.name}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Replace the base category page**

Overwrite `src/app/(frontend)/[locale]/category/[slug]/page.tsx` with:

```tsx
import type { Metadata } from "next";
import type { Config } from "@/payload-types";
import { setRequestLocale } from "next-intl/server";
import { getCategoryBySlug } from "@/lib/payload/queries";
import { CategoryListing } from "@/components/articles/CategoryListing";

export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const category = await getCategoryBySlug(slug, locale as Config["locale"]);
  if (!category) return { title: "Not Found" };
  return {
    title: `${category.name} | MFM Sport`,
    description: category.description || undefined,
  };
}

export default async function CategoryPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <CategoryListing locale={locale} slug={slug} page={1} />;
}
```

- [ ] **Step 3: Create the `/page/[n]` route**

```tsx
// src/app/(frontend)/[locale]/category/[slug]/page/[n]/page.tsx
import type { Metadata } from "next";
import type { Config } from "@/payload-types";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getCategoryBySlug } from "@/lib/payload/queries";
import { CategoryListing } from "@/components/articles/CategoryListing";
import { parsePageParam } from "@/lib/pagination";

export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string; slug: string; n: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const category = await getCategoryBySlug(slug, locale as Config["locale"]);
  if (!category) return { title: "Not Found" };
  return {
    title: `${category.name} | MFM Sport`,
    description: category.description || undefined,
    robots: { index: false, follow: true },
  };
}

export default async function CategoryPageN({ params }: Props) {
  const { locale, slug, n } = await params;
  setRequestLocale(locale);
  const page = parsePageParam(n);
  if (page <= 1) redirect(`/${locale}/category/${slug}`);
  return <CategoryListing locale={locale} slug={slug} page={page} />;
}
```

- [ ] **Step 4: Lint**

Run: `pnpm lint`
Expected: PASS (no new errors in the three files).

- [ ] **Step 5: Commit**

```bash
git add "src/components/articles/CategoryListing.tsx" \
        "src/app/(frontend)/[locale]/category/[slug]/page.tsx" \
        "src/app/(frontend)/[locale]/category/[slug]/page/[n]/page.tsx"
git commit -m "feat(perf): cacheable category listing with /page/[n] routing"
```

---

## Task 8: Payload revalidation hooks

**Files:**
- Modify: `src/lib/payload/revalidate.ts` (add hooks below the builders from Task 3)
- Modify: `src/collections/Articles.ts`
- Modify: `src/collections/Categories.ts`

- [ ] **Step 1: Add the hooks to `revalidate.ts`**

Append to `src/lib/payload/revalidate.ts` (keep the `articlePaths`/`categoryPaths` builders above unchanged):

```ts
import { revalidatePath } from "next/cache";
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
} from "payload";

/** Re-fetch the article across all locales to collect localized slugs + category slugs. */
async function articleRevalidateTargets(
  req: Parameters<CollectionAfterChangeHook>[0]["req"],
  id: string | number,
): Promise<string[]> {
  const doc = await req.payload.findByID({
    collection: "articles",
    id,
    locale: "all",
    depth: 1,
  });
  const slugByLocale = doc.slug as unknown as Partial<Record<string, string>>;
  const cats = Array.isArray(doc.categories) ? doc.categories : [];
  const categorySlugs = cats
    .map((c: unknown) =>
      c && typeof c === "object" && "slug" in c ? (c as { slug?: string }).slug : undefined,
    )
    .filter((s): s is string => Boolean(s));
  return articlePaths(slugByLocale, categorySlugs);
}

export const revalidateArticleChange: CollectionAfterChangeHook = async ({ doc, req }) => {
  try {
    const paths = await articleRevalidateTargets(req, doc.id);
    paths.forEach((p) => revalidatePath(p));
  } catch (err) {
    req.payload.logger.error({ err }, "[revalidate] article afterChange failed");
  }
  return doc;
};

export const revalidateArticleDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  try {
    // The doc is the just-deleted record in req's locale; revalidate listings,
    // homepage, and (best-effort) this locale's article path.
    const slug = typeof doc?.slug === "string" ? doc.slug : undefined;
    const slugByLocale = slug && req.locale ? { [req.locale]: slug } : {};
    articlePaths(slugByLocale, []).forEach((p) => revalidatePath(p));
  } catch (err) {
    req.payload.logger.error({ err }, "[revalidate] article afterDelete failed");
  }
  return doc;
};

export const revalidateCategoryChange: CollectionAfterChangeHook = async ({ doc, req }) => {
  try {
    const slug = typeof doc?.slug === "string" ? doc.slug : "";
    categoryPaths(slug).forEach((p) => revalidatePath(p));
  } catch (err) {
    req.payload.logger.error({ err }, "[revalidate] category afterChange failed");
  }
  return doc;
};

export const revalidateCategoryDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  try {
    const slug = typeof doc?.slug === "string" ? doc.slug : "";
    categoryPaths(slug).forEach((p) => revalidatePath(p));
  } catch (err) {
    req.payload.logger.error({ err }, "[revalidate] category afterDelete failed");
  }
  return doc;
};
```

- [ ] **Step 2: Re-run the Task 3 tests (builders must still pass)**

Run: `pnpm vitest run src/lib/payload/revalidate.test.ts`
Expected: PASS — the added hooks don't change builder behavior.

> Note: the hooks call `revalidatePath` from `next/cache`, which is a server-only side effect; they are verified at build + on the preview deploy (Task 10), not in vitest.

- [ ] **Step 3: Wire hooks into Articles collection**

In `src/collections/Articles.ts`, add the import at the top:

```ts
import { revalidateArticleChange, revalidateArticleDelete } from "@/lib/payload/revalidate";
```

Then add a `hooks` block inside the `Articles` config object (e.g. directly after the `slug: "articles",` line):

```ts
  hooks: {
    afterChange: [revalidateArticleChange],
    afterDelete: [revalidateArticleDelete],
  },
```

- [ ] **Step 4: Wire hooks into Categories collection**

In `src/collections/Categories.ts`, add the import at the top:

```ts
import { revalidateCategoryChange, revalidateCategoryDelete } from "@/lib/payload/revalidate";
```

Then add a `hooks` block inside the `Categories` config object (directly after `slug: "categories",`):

```ts
  hooks: {
    afterChange: [revalidateCategoryChange],
    afterDelete: [revalidateCategoryDelete],
  },
```

- [ ] **Step 5: Lint**

Run: `pnpm lint`
Expected: PASS (no new errors).

- [ ] **Step 6: Commit**

```bash
git add src/lib/payload/revalidate.ts src/collections/Articles.ts src/collections/Categories.ts
git commit -m "feat(perf): on-demand revalidation hooks for articles/categories"
```

---

## Task 9: Redirect legacy `?page=N` URLs

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Add a `redirects()` function to the config**

In `next.config.ts`, inside the `nextConfig` object (alongside the existing `async headers()`), add:

```ts
  async redirects() {
    return [
      {
        source: "/:locale/articles",
        has: [{ type: "query", key: "page", value: "(?<n>\\d+)" }],
        destination: "/:locale/articles/page/:n",
        permanent: true,
      },
      {
        source: "/:locale/category/:slug",
        has: [{ type: "query", key: "page", value: "(?<n>\\d+)" }],
        destination: "/:locale/category/:slug/page/:n",
        permanent: true,
      },
    ];
  },
```

(Legacy `?page=1` redirects to `/page/1`, which the `/page/[n]` route then redirects to the clean base URL — a rare two-hop for an old URL, acceptable.)

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat(perf): 301 legacy ?page=N listing URLs to /page/[n]"
```

---

## Task 10: Full build + verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `pnpm test:run`
Expected: PASS — all existing tests plus the new `pagination` and `revalidate` suites.

- [ ] **Step 2: Lint the whole project**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 3: Production build**

Run: `pnpm build`
Expected: Build succeeds. In the route summary, confirm:
- `/[locale]/articles` and `/[locale]/category/[slug]` are **not** marked `ƒ (Dynamic)` — they should be static/ISR (`○` or `●`).
- `/[locale]/articles/page/[n]` and `/[locale]/category/[slug]/page/[n]` appear in the route list.
- The build does not fail even if `generateStaticParams` logs the fallback warning (DB reachable on Vercel; the try/catch is the safety net).

- [ ] **Step 4: Push the branch and open a preview**

```bash
git push -u origin feat/perf-isr-caching
```

Then on the Vercel preview deployment, verify manually:
- Load `/ar/category/<slug>` twice; the second response has header `x-vercel-cache: HIT`.
- Pagination "next" navigates to `/ar/category/<slug>/page/2` and renders the next page.
- Visiting `/ar/category/<slug>?page=2` 301-redirects to `/ar/category/<slug>/page/2`.
- Edit an article in Payload admin and confirm its page reflects the change within seconds (on-demand revalidation).
- Re-run PageSpeed/Speed Insights against the preview URL and confirm TTFB on listing/detail routes drops toward edge-cache levels.

- [ ] **Step 5: Final state**

Branch `feat/perf-isr-caching` is pushed with all tasks committed, ready for `/gsd:ship` or a PR. Do **not** merge until the preview verification in Step 4 passes.

---

## Self-Review Notes

- **Spec coverage:** §1 detail ISR → Task 5; §2 path-based pagination → Tasks 6–7 (+ helper Task 1, component Task 2); §3 Pagination component → Task 2; §4 on-demand revalidation → Tasks 3, 8; §5 legacy redirects → Task 9. Verification → Task 10. All spec sections mapped.
- **Type consistency:** hook exports `revalidateArticleChange`/`revalidateArticleDelete`/`revalidateCategoryChange`/`revalidateCategoryDelete` are referenced with the same names in Tasks 8.3/8.4. `pageHref`/`parsePageParam` (Task 1) reused in Tasks 2, 6, 7. `articlePaths`/`categoryPaths` (Task 3) reused in Task 8. `getAllArticleSlugs` (Task 4) consumed in Task 5.
- **No DB-backed unit tests:** routing/hook/config behavior is verified by build + preview (Task 10), since the project's vitest setup is jsdom/unit-only and Payload/DB integration isn't wired for it.
