# MFM Sport — Plan 2: Editorial Pages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete editorial reading experience — articles and authors in the CMS, a homepage with news sections, paginated article lists, single article pages, category/tag archives, author profiles, and search.

**Architecture:** Server components fetch data from Payload's local API via reusable query helpers. Pages are ISR-cached. ArticleCard is the atomic UI unit reused across all list/grid views. Pagination uses URL query params (`?page=N`) for SSR compatibility. Rich text rendered via Payload's Lexical react renderer.

**Tech Stack:** Payload 3.0 collections, Payload local API, Next.js 15 server components, Lexical rich text, @tailwindcss/typography, shadcn/ui Card + Badge, next-intl translations

---

## Depends On

Plan 1 (Foundation) must be complete. The following exist:
- Payload with Users, Media, Categories, Tags collections
- Trilingual i18n (ar/fr/en) with RTL support
- Design tokens (Moroccan dark palette)
- shadcn/ui (button, card, badge, input, skeleton, separator)
- Header/Footer/Nav layout shell
- Vitest + Testing Library

---

## File Structure (new/modified files in this plan)

```
src/
  collections/
    Articles.ts                              # Task 1
    Authors.ts                               # Task 2
  lib/
    payload/
      queries.ts                             # Task 4
    utils.ts                                 # Task 3 (add formatDate, getImageUrl)
  components/
    articles/
      ArticleCard.tsx                        # Task 5
      ArticleGrid.tsx                        # Task 5
      ArticleBody.tsx                        # Task 8
      RelatedArticles.tsx                    # Task 8
    shared/
      CategoryBadge.tsx                      # Task 5
      Pagination.tsx                         # Task 6
      SectionHeader.tsx                      # Task 11
    author/
      AuthorCard.tsx                         # Task 10
    home/
      HeroSection.tsx                        # Task 11
      NewsSection.tsx                        # Task 11
  app/
    (frontend)/
      [locale]/
        page.tsx                             # Task 11 (homepage rewrite)
        articles/
          page.tsx                           # Task 7
          [slug]/
            page.tsx                         # Task 8
        category/
          [slug]/
            page.tsx                         # Task 9
        tag/
          [slug]/
            page.tsx                         # Task 9
        author/
          [slug]/
            page.tsx                         # Task 10
        search/
          page.tsx                           # Task 12
messages/
  ar.json                                   # Task 3 (add keys)
  fr.json                                   # Task 3 (add keys)
  en.json                                   # Task 3 (add keys)
src/payload.config.ts                        # Tasks 1-2 (register collections)
tailwind.config.ts                           # Task 8 (add typography plugin)
```

---

## Task 1: Articles Collection

**Files:**
- Create: `src/collections/Articles.ts`
- Modify: `src/payload.config.ts`

- [ ] **Step 1: Create Articles collection**

Create `src/collections/Articles.ts`:

```ts
import type { CollectionConfig } from "payload";

export const Articles: CollectionConfig = {
  slug: "articles",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "status", "author", "publishedAt"],
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      localized: true,
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      admin: {
        description: "URL-friendly identifier (ASCII, lowercase, hyphens)",
      },
    },
    {
      name: "excerpt",
      type: "textarea",
      localized: true,
      admin: {
        description: "Short summary for cards and SEO meta description",
      },
    },
    {
      name: "body",
      type: "richText",
      required: true,
      localized: true,
    },
    {
      name: "featuredImage",
      type: "upload",
      relationTo: "media",
    },
    {
      name: "author",
      type: "relationship",
      relationTo: "authors",
      required: true,
    },
    {
      name: "categories",
      type: "relationship",
      relationTo: "categories",
      hasMany: true,
    },
    {
      name: "tags",
      type: "relationship",
      relationTo: "tags",
      hasMany: true,
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "draft",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Published", value: "published" },
      ],
      admin: {
        position: "sidebar",
      },
    },
    {
      name: "publishedAt",
      type: "date",
      admin: {
        position: "sidebar",
        date: {
          pickerAppearance: "dayAndTime",
        },
      },
    },
    {
      name: "isVideo",
      type: "checkbox",
      defaultValue: false,
      admin: {
        position: "sidebar",
        description: "Mark as video article (shows YouTube embed)",
      },
    },
    {
      name: "videoUrl",
      type: "text",
      admin: {
        condition: (data) => Boolean(data?.isVideo),
        description: "YouTube video URL (e.g., https://youtube.com/watch?v=...)",
      },
    },
  ],
};
```

- [ ] **Step 2: Register in payload.config.ts**

Add import and register the collection. In `src/payload.config.ts`, add:

```ts
import { Articles } from "./collections/Articles";
```

Update the collections array:

```ts
collections: [Users, Media, Categories, Tags, Articles],
```

Note: Articles must come AFTER Categories, Tags, and Media since it references them. Authors doesn't exist yet — we'll add it in Task 2. The `author` field on Articles will cause an error until Authors is created. **To avoid this, temporarily comment out the `author` field** or set `required: false` and change `relationTo: "authors"` to be added in Task 2.

Actually, a cleaner approach: add both collections (Tasks 1 and 2) before running the dev server. So in this step, just add the file and import — we'll register both collections together at the end of Task 2.

- [ ] **Step 3: Commit**

```bash
git add src/collections/Articles.ts
git commit -m "feat: add Articles collection schema"
```

---

## Task 2: Authors Collection

**Files:**
- Create: `src/collections/Authors.ts`
- Modify: `src/payload.config.ts`

- [ ] **Step 1: Create Authors collection**

Create `src/collections/Authors.ts`:

```ts
import type { CollectionConfig } from "payload";

export const Authors: CollectionConfig = {
  slug: "authors",
  admin: {
    useAsTitle: "name",
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      localized: true,
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
    },
    {
      name: "bio",
      type: "textarea",
      localized: true,
    },
    {
      name: "avatar",
      type: "upload",
      relationTo: "media",
    },
    {
      name: "social",
      type: "group",
      fields: [
        { name: "twitter", type: "text" },
        { name: "facebook", type: "text" },
        { name: "instagram", type: "text" },
      ],
    },
  ],
};
```

- [ ] **Step 2: Register both Articles and Authors in payload.config.ts**

In `src/payload.config.ts`, add both imports:

```ts
import { Articles } from "./collections/Articles";
import { Authors } from "./collections/Authors";
```

Update the collections array (Authors must come before Articles since Articles references Authors):

```ts
collections: [Users, Media, Categories, Tags, Authors, Articles],
```

- [ ] **Step 3: Verify collections in admin**

```bash
pnpm dev
```

Navigate to `http://localhost:3000/admin`. Verify:
- **Authors** and **Articles** appear in the sidebar
- Create a test author (name: "Test Author", slug: "test-author")
- Create a test article (title: "Test Article", slug: "test-article", select the test author, set status to "published", set publishedAt)
- Verify localized fields show locale tabs (AR/FR/EN) in the admin

- [ ] **Step 4: Commit**

```bash
git add src/collections/Authors.ts src/payload.config.ts
git commit -m "feat: add Authors collection and register Articles + Authors"
```

---

## Task 3: i18n Messages + Utility Functions

**Files:**
- Modify: `messages/ar.json`, `messages/fr.json`, `messages/en.json`
- Modify: `src/lib/utils.ts`

- [ ] **Step 1: Add article/author/search keys to Arabic messages**

Add these sections to `messages/ar.json` (keep existing keys, add new ones):

```json
{
  "article": {
    "by": "بقلم",
    "publishedOn": "نشر في",
    "views": "مشاهدة",
    "relatedNews": "أخبار ذات صلة",
    "tags": "الوسوم",
    "shareArticle": "شارك المقال",
    "videoArticle": "مقال فيديو",
    "allArticles": "جميع المقالات",
    "noArticles": "لا توجد مقالات"
  },
  "author": {
    "articles": "مقالات",
    "bio": "نبذة",
    "followOn": "تابع على"
  },
  "search": {
    "title": "البحث",
    "placeholder": "ابحث عن مقالات...",
    "results": "نتائج البحث عن",
    "noResults": "لم يتم العثور على نتائج",
    "searching": "جاري البحث..."
  },
  "pagination": {
    "previous": "السابق",
    "next": "التالي",
    "page": "صفحة"
  },
  "category": {
    "allIn": "جميع المقالات في"
  }
}
```

- [ ] **Step 2: Add French message keys**

Add to `messages/fr.json`:

```json
{
  "article": {
    "by": "Par",
    "publishedOn": "Publie le",
    "views": "vues",
    "relatedNews": "Articles connexes",
    "tags": "Tags",
    "shareArticle": "Partager l'article",
    "videoArticle": "Article video",
    "allArticles": "Tous les articles",
    "noArticles": "Aucun article"
  },
  "author": {
    "articles": "Articles",
    "bio": "Biographie",
    "followOn": "Suivre sur"
  },
  "search": {
    "title": "Recherche",
    "placeholder": "Rechercher des articles...",
    "results": "Resultats pour",
    "noResults": "Aucun resultat",
    "searching": "Recherche en cours..."
  },
  "pagination": {
    "previous": "Precedent",
    "next": "Suivant",
    "page": "Page"
  },
  "category": {
    "allIn": "Tous les articles dans"
  }
}
```

- [ ] **Step 3: Add English message keys**

Add to `messages/en.json`:

```json
{
  "article": {
    "by": "By",
    "publishedOn": "Published on",
    "views": "views",
    "relatedNews": "Related News",
    "tags": "Tags",
    "shareArticle": "Share Article",
    "videoArticle": "Video Article",
    "allArticles": "All Articles",
    "noArticles": "No articles found"
  },
  "author": {
    "articles": "Articles",
    "bio": "Biography",
    "followOn": "Follow on"
  },
  "search": {
    "title": "Search",
    "placeholder": "Search articles...",
    "results": "Results for",
    "noResults": "No results found",
    "searching": "Searching..."
  },
  "pagination": {
    "previous": "Previous",
    "next": "Next",
    "page": "Page"
  },
  "category": {
    "allIn": "All articles in"
  }
}
```

- [ ] **Step 4: Add utility functions**

Add these functions to `src/lib/utils.ts` (keep the existing `cn` function):

```ts
export function formatDate(date: string, locale: string): string {
  return new Date(date).toLocaleDateString(
    locale === "ar" ? "ar-MA" : locale === "fr" ? "fr-FR" : "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  );
}

export function formatTime(date: string, locale: string): string {
  return new Date(date).toLocaleTimeString(
    locale === "ar" ? "ar-MA" : locale === "fr" ? "fr-FR" : "en-US",
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  );
}

export function getImageUrl(
  image: any,
  size: "thumbnail" | "card" | "hero" = "card",
): string | null {
  if (!image || typeof image === "string") return null;
  return image.sizes?.[size]?.url || image.url || null;
}

export function getImageAlt(image: any): string {
  if (!image || typeof image === "string") return "";
  return image.alt || "";
}
```

- [ ] **Step 5: Commit**

```bash
git add messages/ src/lib/utils.ts
git commit -m "feat: add editorial i18n messages and utility functions"
```

---

## Task 4: Payload Query Helpers

**Files:**
- Create: `src/lib/payload/queries.ts`

- [ ] **Step 1: Create query helpers module**

Create `src/lib/payload/queries.ts`:

```ts
import { getPayload } from "payload";
import configPromise from "@payload-config";

export async function getPayloadClient() {
  return getPayload({ config: configPromise });
}

export async function getArticles(options: {
  locale: string;
  page?: number;
  limit?: number;
  sort?: string;
}) {
  const payload = await getPayloadClient();
  return payload.find({
    collection: "articles",
    where: {
      status: { equals: "published" },
    },
    locale: options.locale,
    page: options.page || 1,
    limit: options.limit || 12,
    sort: options.sort || "-publishedAt",
    depth: 2,
  });
}

export async function getArticleBySlug(slug: string, locale: string) {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "articles",
    where: {
      slug: { equals: slug },
      status: { equals: "published" },
    },
    locale,
    limit: 1,
    depth: 2,
  });
  return result.docs[0] || null;
}

export async function getArticlesByCategory(
  categoryId: string | number,
  locale: string,
  page: number = 1,
  limit: number = 12,
) {
  const payload = await getPayloadClient();
  return payload.find({
    collection: "articles",
    where: {
      categories: { equals: categoryId },
      status: { equals: "published" },
    },
    locale,
    page,
    limit,
    sort: "-publishedAt",
    depth: 2,
  });
}

export async function getArticlesByTag(
  tagId: string | number,
  locale: string,
  page: number = 1,
  limit: number = 12,
) {
  const payload = await getPayloadClient();
  return payload.find({
    collection: "articles",
    where: {
      tags: { equals: tagId },
      status: { equals: "published" },
    },
    locale,
    page,
    limit,
    sort: "-publishedAt",
    depth: 2,
  });
}

export async function getArticlesByAuthor(
  authorId: string | number,
  locale: string,
  page: number = 1,
  limit: number = 12,
) {
  const payload = await getPayloadClient();
  return payload.find({
    collection: "articles",
    where: {
      author: { equals: authorId },
      status: { equals: "published" },
    },
    locale,
    page,
    limit,
    sort: "-publishedAt",
    depth: 2,
  });
}

export async function getRelatedArticles(
  articleId: string | number,
  categoryIds: (string | number)[],
  locale: string,
  limit: number = 4,
) {
  const payload = await getPayloadClient();
  return payload.find({
    collection: "articles",
    where: {
      id: { not_equals: articleId },
      categories: { in: categoryIds.map(String) },
      status: { equals: "published" },
    },
    locale,
    limit,
    sort: "-publishedAt",
    depth: 2,
  });
}

export async function getCategoryBySlug(slug: string, locale: string) {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "categories",
    where: { slug: { equals: slug } },
    locale,
    limit: 1,
  });
  return result.docs[0] || null;
}

export async function getTagBySlug(slug: string, locale: string) {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "tags",
    where: { slug: { equals: slug } },
    locale,
    limit: 1,
  });
  return result.docs[0] || null;
}

export async function getAuthorBySlug(slug: string, locale: string) {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "authors",
    where: { slug: { equals: slug } },
    locale,
    limit: 1,
    depth: 1,
  });
  return result.docs[0] || null;
}

export async function searchArticles(
  query: string,
  locale: string,
  page: number = 1,
  limit: number = 12,
) {
  const payload = await getPayloadClient();
  return payload.find({
    collection: "articles",
    where: {
      or: [
        { title: { like: query } },
        { excerpt: { like: query } },
      ],
      status: { equals: "published" },
    },
    locale,
    page,
    limit,
    sort: "-publishedAt",
    depth: 2,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/payload/queries.ts
git commit -m "feat: add Payload query helpers for articles, authors, categories, tags, search"
```

---

## Task 5: ArticleCard + CategoryBadge + ArticleGrid

**Files:**
- Create: `src/components/shared/CategoryBadge.tsx`
- Create: `src/components/articles/ArticleCard.tsx`
- Create: `src/components/articles/ArticleGrid.tsx`

- [ ] **Step 1: Create CategoryBadge component**

Create `src/components/shared/CategoryBadge.tsx`:

```tsx
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

type Props = {
  name: string;
  slug: string;
  locale: string;
};

export function CategoryBadge({ name, slug, locale }: Props) {
  return (
    <Link href={`/${locale}/category/${slug}`}>
      <Badge className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium">
        {name}
      </Badge>
    </Link>
  );
}
```

- [ ] **Step 2: Create ArticleCard component**

Create `src/components/articles/ArticleCard.tsx`:

```tsx
import Image from "next/image";
import Link from "next/link";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import { formatDate, getImageUrl, getImageAlt } from "@/lib/utils";

type Props = {
  article: {
    title: string;
    slug: string;
    featuredImage?: any;
    categories?: any[];
    publishedAt?: string;
    isVideo?: boolean;
  };
  locale: string;
  size?: "default" | "large";
};

export function ArticleCard({ article, locale, size = "default" }: Props) {
  const imageUrl = getImageUrl(
    article.featuredImage,
    size === "large" ? "hero" : "card",
  );
  const imageAlt = getImageAlt(article.featuredImage);
  const category = article.categories?.[0];

  return (
    <Link
      href={`/${locale}/articles/${article.slug}`}
      className="group block"
    >
      <article className="overflow-hidden rounded-lg bg-card border border-border transition-colors hover:border-primary/30">
        {/* Image */}
        <div className="relative aspect-video overflow-hidden">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={imageAlt}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes={size === "large" ? "100vw" : "(max-width: 768px) 100vw, 33vw"}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-secondary">
              <span className="text-muted-foreground text-sm">MFM Sport</span>
            </div>
          )}
          {/* Category badge overlay */}
          {category && (
            <div className="absolute bottom-2 start-2" onClick={(e) => e.preventDefault()}>
              <CategoryBadge
                name={typeof category === "object" ? category.name : ""}
                slug={typeof category === "object" ? category.slug : ""}
                locale={locale}
              />
            </div>
          )}
          {/* Video indicator */}
          {article.isVideo && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/90">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3">
          <h3
            className={`font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors ${
              size === "large" ? "text-lg" : "text-sm"
            }`}
          >
            {article.title}
          </h3>
          {article.publishedAt && (
            <time className="mt-1 block text-xs text-muted-foreground">
              {formatDate(article.publishedAt, locale)}
            </time>
          )}
        </div>
      </article>
    </Link>
  );
}
```

- [ ] **Step 3: Create ArticleGrid component**

Create `src/components/articles/ArticleGrid.tsx`:

```tsx
import { ArticleCard } from "./ArticleCard";

type Props = {
  articles: any[];
  locale: string;
  columns?: 2 | 3 | 4;
};

export function ArticleGrid({ articles, locale, columns = 3 }: Props) {
  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  };

  return (
    <div className={`grid gap-4 ${gridCols[columns]}`}>
      {articles.map((article) => (
        <ArticleCard key={article.id} article={article} locale={locale} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/CategoryBadge.tsx src/components/articles/
git commit -m "feat: add ArticleCard, ArticleGrid, CategoryBadge components"
```

---

## Task 6: Pagination Component

**Files:**
- Create: `src/components/shared/Pagination.tsx`

- [ ] **Step 1: Create Pagination component**

Create `src/components/shared/Pagination.tsx`:

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";

type Props = {
  currentPage: number;
  totalPages: number;
  basePath: string;
};

export function Pagination({ currentPage, totalPages, basePath }: Props) {
  if (totalPages <= 1) return null;

  function pageUrl(page: number) {
    return page === 1 ? basePath : `${basePath}?page=${page}`;
  }

  // Build visible page numbers with ellipsis
  const pages: (number | "ellipsis")[] = [];
  const delta = 2;

  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= currentPage - delta && i <= currentPage + delta)
    ) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "ellipsis") {
      pages.push("ellipsis");
    }
  }

  return (
    <nav className="flex items-center justify-center gap-1 py-8" aria-label="Pagination">
      {/* Previous */}
      {currentPage > 1 ? (
        <Link href={pageUrl(currentPage - 1)}>
          <Button variant="ghost" size="sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15,18 9,12 15,6" />
            </svg>
          </Button>
        </Link>
      ) : (
        <Button variant="ghost" size="sm" disabled>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15,18 9,12 15,6" />
          </svg>
        </Button>
      )}

      {/* Page numbers */}
      {pages.map((page, i) =>
        page === "ellipsis" ? (
          <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground">
            ...
          </span>
        ) : (
          <Link key={page} href={pageUrl(page)}>
            <Button
              variant={page === currentPage ? "default" : "ghost"}
              size="sm"
              className={page === currentPage ? "bg-primary text-primary-foreground" : ""}
            >
              {page}
            </Button>
          </Link>
        ),
      )}

      {/* Next */}
      {currentPage < totalPages ? (
        <Link href={pageUrl(currentPage + 1)}>
          <Button variant="ghost" size="sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9,6 15,12 9,18" />
            </svg>
          </Button>
        </Link>
      ) : (
        <Button variant="ghost" size="sm" disabled>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9,6 15,12 9,18" />
          </svg>
        </Button>
      )}
    </nav>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shared/Pagination.tsx
git commit -m "feat: add Pagination component with numbered pages and ellipsis"
```

---

## Task 7: Article List Page

**Files:**
- Create: `src/app/(frontend)/[locale]/articles/page.tsx`

- [ ] **Step 1: Create article list page**

Create `src/app/(frontend)/[locale]/articles/page.tsx`:

```tsx
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getArticles } from "@/lib/payload/queries";
import { ArticleGrid } from "@/components/articles/ArticleGrid";
import { Pagination } from "@/components/shared/Pagination";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "article" });
  return {
    title: `${t("allArticles")} | MFM Sport`,
  };
}

export default async function ArticlesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { page } = await searchParams;
  setRequestLocale(locale);

  const currentPage = Math.max(1, parseInt(page || "1", 10));
  const result = await getArticles({ locale, page: currentPage, limit: 12 });
  const t = await getTranslations({ locale, namespace: "article" });

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">{t("allArticles")}</h1>

      {result.docs.length > 0 ? (
        <>
          <ArticleGrid articles={result.docs} locale={locale} columns={3} />
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

- [ ] **Step 2: Commit**

```bash
git add src/app/\(frontend\)/\[locale\]/articles/
git commit -m "feat: add paginated article list page"
```

---

## Task 8: Single Article Page

**Files:**
- Create: `src/app/(frontend)/[locale]/articles/[slug]/page.tsx`
- Create: `src/components/articles/ArticleBody.tsx`
- Create: `src/components/articles/RelatedArticles.tsx`
- Modify: `tailwind.config.ts` (add typography plugin)

- [ ] **Step 1: Install typography plugin**

```bash
pnpm add -D @tailwindcss/typography
```

- [ ] **Step 2: Add typography plugin to Tailwind config**

In `tailwind.config.ts`, update the plugins array:

```ts
import typography from "@tailwindcss/typography";

// ... existing config ...

plugins: [typography],
```

- [ ] **Step 3: Create ArticleBody component**

Create `src/components/articles/ArticleBody.tsx`:

```tsx
import { RichText } from "@payloadcms/richtext-lexical/react";

type Props = {
  content: any;
};

export function ArticleBody({ content }: Props) {
  if (!content) return null;

  return (
    <div className="prose prose-invert prose-lg max-w-none prose-headings:text-foreground prose-p:text-foreground/90 prose-a:text-primary prose-strong:text-foreground prose-blockquote:border-primary prose-blockquote:text-muted-foreground leading-arabic">
      <RichText data={content} />
    </div>
  );
}
```

- [ ] **Step 4: Create RelatedArticles component**

Create `src/components/articles/RelatedArticles.tsx`:

```tsx
import { ArticleCard } from "./ArticleCard";

type Props = {
  articles: any[];
  locale: string;
  title: string;
};

export function RelatedArticles({ articles, locale, title }: Props) {
  if (articles.length === 0) return null;

  return (
    <section className="mt-12 pt-8 border-t border-border">
      <h2 className="text-xl font-bold mb-4">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} locale={locale} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Create single article page**

Create `src/app/(frontend)/[locale]/articles/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getArticleBySlug, getRelatedArticles } from "@/lib/payload/queries";
import { formatDate, formatTime, getImageUrl, getImageAlt } from "@/lib/utils";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import { ArticleBody } from "@/components/articles/ArticleBody";
import { RelatedArticles } from "@/components/articles/RelatedArticles";
import { Badge } from "@/components/ui/badge";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const article = await getArticleBySlug(slug, locale);
  if (!article) return { title: "Not Found" };

  return {
    title: `${article.title} | MFM Sport`,
    description: article.excerpt || undefined,
    openGraph: {
      title: article.title,
      description: article.excerpt || undefined,
      images: getImageUrl(article.featuredImage, "hero")
        ? [{ url: getImageUrl(article.featuredImage, "hero")! }]
        : undefined,
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const article = await getArticleBySlug(slug, locale);
  if (!article) notFound();

  const t = await getTranslations({ locale, namespace: "article" });

  const heroImage = getImageUrl(article.featuredImage, "hero");
  const heroAlt = getImageAlt(article.featuredImage);

  // Get related articles from same categories
  const categoryIds = (article.categories || [])
    .map((c: any) => (typeof c === "object" ? c.id : c))
    .filter(Boolean);

  const related = categoryIds.length > 0
    ? await getRelatedArticles(article.id, categoryIds, locale, 4)
    : null;

  const author = typeof article.author === "object" ? article.author : null;

  return (
    <article className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Categories */}
      {article.categories && article.categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {article.categories.map((cat: any) =>
            typeof cat === "object" ? (
              <CategoryBadge key={cat.id} name={cat.name} slug={cat.slug} locale={locale} />
            ) : null,
          )}
        </div>
      )}

      {/* Title */}
      <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-4">
        {article.title}
      </h1>

      {/* Author + date row */}
      <div className="flex items-center gap-3 mb-6 text-sm text-muted-foreground">
        {author && (
          <>
            {author.avatar && (
              <Image
                src={getImageUrl(author.avatar, "thumbnail") || ""}
                alt={author.name || ""}
                width={32}
                height={32}
                className="rounded-full"
              />
            )}
            <Link
              href={`/${locale}/author/${author.slug}`}
              className="font-medium text-foreground hover:text-primary transition-colors"
            >
              {author.name}
            </Link>
            <span className="text-border">|</span>
          </>
        )}
        {article.publishedAt && (
          <time>
            {formatDate(article.publishedAt, locale)} &middot;{" "}
            {formatTime(article.publishedAt, locale)}
          </time>
        )}
      </div>

      {/* Featured image */}
      {heroImage && (
        <div className="relative aspect-video rounded-lg overflow-hidden mb-8">
          <Image
            src={heroImage}
            alt={heroAlt}
            fill
            className="object-cover"
            sizes="(max-width: 896px) 100vw, 896px"
            priority
          />
        </div>
      )}

      {/* Video embed */}
      {article.isVideo && article.videoUrl && (
        <div className="relative aspect-video rounded-lg overflow-hidden mb-8">
          <iframe
            src={article.videoUrl.replace("watch?v=", "embed/")}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={article.title}
          />
        </div>
      )}

      {/* Body */}
      <ArticleBody content={article.body} />

      {/* Tags */}
      {article.tags && article.tags.length > 0 && (
        <div className="mt-8 pt-6 border-t border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            {t("tags")}
          </h3>
          <div className="flex flex-wrap gap-2">
            {article.tags.map((tag: any) =>
              typeof tag === "object" ? (
                <Link key={tag.id} href={`/${locale}/tag/${tag.slug}`}>
                  <Badge variant="secondary" className="text-xs">
                    {tag.name}
                  </Badge>
                </Link>
              ) : null,
            )}
          </div>
        </div>
      )}

      {/* Related articles */}
      {related && related.docs.length > 0 && (
        <RelatedArticles
          articles={related.docs}
          locale={locale}
          title={t("relatedNews")}
        />
      )}
    </article>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/articles/ArticleBody.tsx src/components/articles/RelatedArticles.tsx src/app/\(frontend\)/\[locale\]/articles/\[slug\]/ tailwind.config.ts package.json pnpm-lock.yaml
git commit -m "feat: add single article page with rich text, author, tags, related articles"
```

---

## Task 9: Category & Tag Archive Pages

**Files:**
- Create: `src/app/(frontend)/[locale]/category/[slug]/page.tsx`
- Create: `src/app/(frontend)/[locale]/tag/[slug]/page.tsx`

- [ ] **Step 1: Create category archive page**

Create `src/app/(frontend)/[locale]/category/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getCategoryBySlug, getArticlesByCategory } from "@/lib/payload/queries";
import { ArticleGrid } from "@/components/articles/ArticleGrid";
import { Pagination } from "@/components/shared/Pagination";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const category = await getCategoryBySlug(slug, locale);
  if (!category) return { title: "Not Found" };
  return {
    title: `${category.name} | MFM Sport`,
    description: category.description || undefined,
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  const { page } = await searchParams;
  setRequestLocale(locale);

  const category = await getCategoryBySlug(slug, locale);
  if (!category) notFound();

  const currentPage = Math.max(1, parseInt(page || "1", 10));
  const result = await getArticlesByCategory(category.id, locale, currentPage);
  const t = await getTranslations({ locale, namespace: "category" });

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">{category.name}</h1>
      {category.description && (
        <p className="text-muted-foreground mb-6">{category.description}</p>
      )}

      {result.docs.length > 0 ? (
        <>
          <ArticleGrid articles={result.docs} locale={locale} columns={3} />
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

- [ ] **Step 2: Create tag archive page**

Create `src/app/(frontend)/[locale]/tag/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getTagBySlug, getArticlesByTag } from "@/lib/payload/queries";
import { ArticleGrid } from "@/components/articles/ArticleGrid";
import { Pagination } from "@/components/shared/Pagination";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const tag = await getTagBySlug(slug, locale);
  if (!tag) return { title: "Not Found" };
  return {
    title: `${tag.name} | MFM Sport`,
  };
}

export default async function TagPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  const { page } = await searchParams;
  setRequestLocale(locale);

  const tag = await getTagBySlug(slug, locale);
  if (!tag) notFound();

  const currentPage = Math.max(1, parseInt(page || "1", 10));
  const result = await getArticlesByTag(tag.id, locale, currentPage);
  const t = await getTranslations({ locale, namespace: "article" });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <span className="text-muted-foreground">#</span>
        <h1 className="text-2xl font-bold">{tag.name}</h1>
      </div>

      {result.docs.length > 0 ? (
        <>
          <ArticleGrid articles={result.docs} locale={locale} columns={3} />
          <Pagination
            currentPage={result.page!}
            totalPages={result.totalPages}
            basePath={`/${locale}/tag/${slug}`}
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

- [ ] **Step 3: Commit**

```bash
git add src/app/\(frontend\)/\[locale\]/category/ src/app/\(frontend\)/\[locale\]/tag/
git commit -m "feat: add category and tag archive pages with pagination"
```

---

## Task 10: Author Profile Page

**Files:**
- Create: `src/components/author/AuthorCard.tsx`
- Create: `src/app/(frontend)/[locale]/author/[slug]/page.tsx`

- [ ] **Step 1: Create AuthorCard component**

Create `src/components/author/AuthorCard.tsx`:

```tsx
import Image from "next/image";
import { getImageUrl } from "@/lib/utils";

type Props = {
  author: {
    name: string;
    bio?: string | null;
    avatar?: any;
    social?: {
      twitter?: string | null;
      facebook?: string | null;
      instagram?: string | null;
    };
  };
  locale: string;
};

export function AuthorCard({ author, locale }: Props) {
  const avatarUrl = getImageUrl(author.avatar, "thumbnail");

  return (
    <div className="flex flex-col sm:flex-row items-start gap-4 p-6 rounded-lg bg-card border border-border">
      {avatarUrl && (
        <Image
          src={avatarUrl}
          alt={author.name}
          width={80}
          height={80}
          className="rounded-full"
        />
      )}
      <div className="flex-1">
        <h2 className="text-xl font-bold">{author.name}</h2>
        {author.bio && (
          <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
            {author.bio}
          </p>
        )}
        {author.social && (
          <div className="mt-3 flex gap-3">
            {author.social.twitter && (
              <a
                href={author.social.twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                X / Twitter
              </a>
            )}
            {author.social.facebook && (
              <a
                href={author.social.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                Facebook
              </a>
            )}
            {author.social.instagram && (
              <a
                href={author.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                Instagram
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create author profile page**

Create `src/app/(frontend)/[locale]/author/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getAuthorBySlug, getArticlesByAuthor } from "@/lib/payload/queries";
import { AuthorCard } from "@/components/author/AuthorCard";
import { ArticleGrid } from "@/components/articles/ArticleGrid";
import { Pagination } from "@/components/shared/Pagination";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const author = await getAuthorBySlug(slug, locale);
  if (!author) return { title: "Not Found" };
  return {
    title: `${author.name} | MFM Sport`,
    description: author.bio || undefined,
  };
}

export default async function AuthorPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  const { page } = await searchParams;
  setRequestLocale(locale);

  const author = await getAuthorBySlug(slug, locale);
  if (!author) notFound();

  const currentPage = Math.max(1, parseInt(page || "1", 10));
  const result = await getArticlesByAuthor(author.id, locale, currentPage);
  const t = await getTranslations({ locale, namespace: "author" });

  return (
    <div className="container mx-auto px-4 py-8">
      <AuthorCard author={author} locale={locale} />

      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">{t("articles")}</h2>

        {result.docs.length > 0 ? (
          <>
            <ArticleGrid articles={result.docs} locale={locale} columns={3} />
            <Pagination
              currentPage={result.page!}
              totalPages={result.totalPages}
              basePath={`/${locale}/author/${slug}`}
            />
          </>
        ) : (
          <p className="text-muted-foreground text-center py-12">
            No articles yet
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/author/ src/app/\(frontend\)/\[locale\]/author/
git commit -m "feat: add author profile page with bio, avatar, social links, and articles"
```

---

## Task 11: Homepage

**Files:**
- Create: `src/components/home/HeroSection.tsx`
- Create: `src/components/home/NewsSection.tsx`
- Create: `src/components/shared/SectionHeader.tsx`
- Modify: `src/app/(frontend)/[locale]/page.tsx`

- [ ] **Step 1: Create SectionHeader component**

Create `src/components/shared/SectionHeader.tsx`:

```tsx
import Link from "next/link";

type Props = {
  title: string;
  href?: string;
  linkText?: string;
};

export function SectionHeader({ title, href, linkText }: Props) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xl font-bold relative">
        {title}
        <span className="absolute -bottom-1 start-0 w-12 h-0.5 bg-primary" />
      </h2>
      {href && linkText && (
        <Link
          href={href}
          className="text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          {linkText} &rarr;
        </Link>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create HeroSection component**

Create `src/components/home/HeroSection.tsx`:

```tsx
import Image from "next/image";
import Link from "next/link";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import { formatDate, getImageUrl, getImageAlt } from "@/lib/utils";
import { ArticleCard } from "@/components/articles/ArticleCard";

type Props = {
  featured: any;
  secondary: any[];
  locale: string;
};

export function HeroSection({ featured, secondary, locale }: Props) {
  const heroImage = getImageUrl(featured.featuredImage, "hero");
  const heroAlt = getImageAlt(featured.featuredImage);
  const category = featured.categories?.[0];

  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Main hero */}
      <Link
        href={`/${locale}/articles/${featured.slug}`}
        className="lg:col-span-2 group block"
      >
        <div className="relative aspect-video rounded-lg overflow-hidden">
          {heroImage ? (
            <Image
              src={heroImage}
              alt={heroAlt}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 1024px) 100vw, 66vw"
              priority
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-secondary">
              <span className="text-muted-foreground">MFM Sport</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          <div className="absolute bottom-0 start-0 end-0 p-6">
            {category && typeof category === "object" && (
              <div className="mb-2" onClick={(e) => e.preventDefault()}>
                <CategoryBadge name={category.name} slug={category.slug} locale={locale} />
              </div>
            )}
            <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight line-clamp-3">
              {featured.title}
            </h2>
            {featured.publishedAt && (
              <time className="mt-2 block text-sm text-white/70">
                {formatDate(featured.publishedAt, locale)}
              </time>
            )}
          </div>
        </div>
      </Link>

      {/* Secondary stories */}
      <div className="flex flex-col gap-4">
        {secondary.slice(0, 3).map((article: any) => (
          <ArticleCard key={article.id} article={article} locale={locale} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Create NewsSection component**

Create `src/components/home/NewsSection.tsx`:

```tsx
import { ArticleGrid } from "@/components/articles/ArticleGrid";
import { SectionHeader } from "@/components/shared/SectionHeader";

type Props = {
  title: string;
  articles: any[];
  locale: string;
  viewAllHref?: string;
  viewAllText?: string;
  columns?: 2 | 3 | 4;
};

export function NewsSection({
  title,
  articles,
  locale,
  viewAllHref,
  viewAllText,
  columns = 3,
}: Props) {
  if (articles.length === 0) return null;

  return (
    <section className="mt-10">
      <SectionHeader title={title} href={viewAllHref} linkText={viewAllText} />
      <ArticleGrid articles={articles} locale={locale} columns={columns} />
    </section>
  );
}
```

- [ ] **Step 4: Rewrite homepage**

Replace `src/app/(frontend)/[locale]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getArticles } from "@/lib/payload/queries";
import { HeroSection } from "@/components/home/HeroSection";
import { NewsSection } from "@/components/home/NewsSection";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === "ar"
      ? "MFM Sport - أخبار الكرة المغربية"
      : locale === "fr"
        ? "MFM Sport - Actualites du football marocain"
        : "MFM Sport - Moroccan Football News",
  };
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "home" });
  const tArticle = await getTranslations({ locale, namespace: "article" });
  const tCommon = await getTranslations({ locale, namespace: "common" });

  // Fetch latest articles for the homepage
  const latest = await getArticles({ locale, page: 1, limit: 16 });
  const articles = latest.docs;

  // Split articles: 1 hero + 3 secondary + rest
  const featured = articles[0];
  const secondary = articles.slice(1, 4);
  const topNews = articles.slice(4, 10);
  const moreNews = articles.slice(10, 16);

  if (!featured) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl font-bold text-primary mb-4">MFM Sport</h1>
        <p className="text-muted-foreground">{tArticle("noArticles")}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <HeroSection featured={featured} secondary={secondary} locale={locale} />

      <NewsSection
        title={t("topNews")}
        articles={topNews}
        locale={locale}
        viewAllHref={`/${locale}/articles`}
        viewAllText={tCommon("readMore")}
        columns={3}
      />

      <NewsSection
        title={t("latestNews")}
        articles={moreNews}
        locale={locale}
        viewAllHref={`/${locale}/articles`}
        viewAllText={tCommon("readMore")}
        columns={3}
      />
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/home/ src/components/shared/SectionHeader.tsx src/app/\(frontend\)/\[locale\]/page.tsx
git commit -m "feat: build homepage with hero section, top news, and latest news"
```

---

## Task 12: Search Page

**Files:**
- Create: `src/app/(frontend)/[locale]/search/page.tsx`

- [ ] **Step 1: Create search page**

Create `src/app/(frontend)/[locale]/search/page.tsx`:

```tsx
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { searchArticles } from "@/lib/payload/queries";
import { ArticleGrid } from "@/components/articles/ArticleGrid";
import { Pagination } from "@/components/shared/Pagination";
import { Input } from "@/components/ui/input";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "search" });
  return {
    title: `${t("title")} | MFM Sport`,
  };
}

export default async function SearchPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { q, page } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "search" });
  const query = q?.trim() || "";
  const currentPage = Math.max(1, parseInt(page || "1", 10));

  const result = query
    ? await searchArticles(query, locale, currentPage)
    : null;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">{t("title")}</h1>

      {/* Search form */}
      <form action={`/${locale}/search`} method="GET" className="mb-8">
        <Input
          type="search"
          name="q"
          defaultValue={query}
          placeholder={t("placeholder")}
          className="max-w-lg bg-card"
          autoFocus
        />
      </form>

      {/* Results */}
      {query && result && (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            {t("results")} &ldquo;{query}&rdquo; &mdash; {result.totalDocs}{" "}
            {result.totalDocs === 1 ? "result" : "results"}
          </p>

          {result.docs.length > 0 ? (
            <>
              <ArticleGrid articles={result.docs} locale={locale} columns={3} />
              <Pagination
                currentPage={result.page!}
                totalPages={result.totalPages}
                basePath={`/${locale}/search?q=${encodeURIComponent(query)}`}
              />
            </>
          ) : (
            <p className="text-muted-foreground text-center py-12">
              {t("noResults")}
            </p>
          )}
        </>
      )}

      {!query && (
        <p className="text-muted-foreground text-center py-12">
          {t("placeholder")}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(frontend\)/\[locale\]/search/
git commit -m "feat: add search page with full-text article search"
```

---

## Self-Review

**Spec coverage:**
- Articles collection: Task 1 (title, slug, excerpt, body, image, author, categories, tags, status, publishedAt, isVideo, videoUrl)
- Authors collection: Task 2 (name, slug, bio, avatar, social links)
- Homepage: Task 11 (hero + top news + latest news sections)
- Article list: Task 7 (paginated grid)
- Single article: Task 8 (body, author, categories, tags, video embed, related articles, OG metadata)
- Category archive: Task 9 (filtered articles with pagination)
- Tag archive: Task 9 (filtered articles with pagination)
- Author profile: Task 10 (bio + avatar + social + articles)
- Search: Task 12 (full-text search with results)
- i18n: Task 3 (all new message keys for AR/FR/EN)
- Reusable components: Tasks 5-6 (ArticleCard, ArticleGrid, CategoryBadge, Pagination, SectionHeader)

**No gaps found.**

**Type consistency check:** All query helpers use consistent parameter types (locale: string, page: number, limit: number). All components use `locale: string` prop. Article shape matches across ArticleCard, ArticlePage, HeroSection, RelatedArticles, NewsSection.

---

*Plan written 2026-04-20. Ready for execution.*
