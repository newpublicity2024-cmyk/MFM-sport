# MFM Sport — Plan 5: SEO & Launch

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the site production-ready with SEO infrastructure (sitemap, robots, RSS, OG images), legacy URL redirect handling for ~43K WordPress articles, a revalidation webhook for on-demand ISR, and a WordPress migration script.

**Architecture:** Redirects collection in Payload stores old WP slug -> new slug mappings. Middleware checks non-locale paths against an API lookup route before falling through to next-intl. Sitemap and robots use Next.js metadata file conventions. RSS is a route handler generating XML. OG images use Next.js ImageResponse. Migration script uses Payload local API for bulk import from WP REST API.

**Tech Stack:** Payload Redirects collection, Next.js middleware, Next.js Metadata API (sitemap.ts, robots.ts), next/og ImageResponse, Payload local API for migration, WP REST API

---

## Depends On

Plans 1-4 complete. Existing:
- 10 Payload collections (Users, Media, Categories, Tags, Authors, Articles, Competitions, Clubs, Subscribers, Pages)
- Middleware at `src/middleware.ts` with next-intl locale routing
- All editorial + football + engagement pages built
- Query helpers in `src/lib/payload/queries.ts`
- `NEXT_PUBLIC_SITE_URL` env var

---

## File Structure

```
src/
  collections/
    Redirects.ts                             # Task 1
  app/
    api/
      redirects/route.ts                     # Task 1
      revalidate/route.ts                    # Task 6
      og/route.tsx                           # Task 5
    sitemap.ts                               # Task 3
    robots.ts                                # Task 3
    (frontend)/
      [locale]/
        feed.xml/route.ts                    # Task 4
  middleware.ts                              # Task 2 (modify)
  payload.config.ts                          # Task 1 (modify)
scripts/
  migrate-wp.ts                              # Task 7
.env.example                                 # Task 6 (modify)
```

---

## Task 1: Redirects Collection + API Lookup Route

**Files:**
- Create: `src/collections/Redirects.ts`
- Create: `src/app/api/redirects/route.ts`
- Modify: `src/payload.config.ts`

- [ ] **Step 1: Create Redirects collection**

Create `src/collections/Redirects.ts`:

```ts
import type { CollectionConfig } from "payload";

export const Redirects: CollectionConfig = {
  slug: "redirects",
  admin: {
    defaultColumns: ["from", "to", "statusCode"],
    description: "Legacy URL redirects (WordPress migration)",
  },
  fields: [
    {
      name: "from",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: {
        description: "Old path (e.g., /%D8%A3%D8%AE%D8%A8%D8%A7%D8%B1-old-slug/)",
      },
    },
    {
      name: "to",
      type: "text",
      required: true,
      admin: {
        description: "New path (e.g., /ar/articles/new-slug)",
      },
    },
    {
      name: "statusCode",
      type: "select",
      required: true,
      defaultValue: "301",
      options: [
        { label: "301 Permanent", value: "301" },
        { label: "302 Temporary", value: "302" },
      ],
    },
  ],
};
```

- [ ] **Step 2: Register in payload.config.ts**

Add import and update collections array:

```ts
import { Redirects } from "./collections/Redirects";

collections: [Users, Media, Categories, Tags, Authors, Articles, Competitions, Clubs, Subscribers, Pages, Redirects],
```

- [ ] **Step 3: Create redirect lookup API route**

Create `src/app/api/redirects/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getPayload } from "payload";
import configPromise from "@payload-config";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");

  if (!from) {
    return NextResponse.json({ to: null });
  }

  try {
    const payload = await getPayload({ config: configPromise });
    const result = await payload.find({
      collection: "redirects",
      where: { from: { equals: from } },
      limit: 1,
    });

    if (result.docs[0]) {
      return NextResponse.json({
        to: result.docs[0].to,
        statusCode: result.docs[0].statusCode,
      });
    }

    return NextResponse.json({ to: null });
  } catch (error) {
    console.error("[Redirects] Lookup error:", error);
    return NextResponse.json({ to: null });
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/collections/Redirects.ts src/app/api/redirects/ src/payload.config.ts
git commit -m "feat: add Redirects collection and lookup API route"
```

---

## Task 2: Legacy Redirect Middleware

**Files:**
- Modify: `src/middleware.ts`

- [ ] **Step 1: Enhance middleware with legacy redirect logic**

Read the existing `src/middleware.ts`. Replace it with a version that checks for legacy redirects before applying locale routing:

```ts
import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

// Paths that are definitely NOT legacy redirects
const KNOWN_PREFIXES = ["/ar", "/fr", "/en", "/admin", "/api", "/_next", "/_vercel"];

function isLegacyCandidate(pathname: string): boolean {
  // Skip known prefixes
  if (KNOWN_PREFIXES.some((p) => pathname.startsWith(p))) return false;
  // Skip static files
  if (pathname.includes(".")) return false;
  // Skip root
  if (pathname === "/") return false;
  // Everything else might be a legacy WP URL
  return true;
}

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Check if this might be a legacy WordPress URL
  if (isLegacyCandidate(pathname)) {
    try {
      const lookupUrl = new URL(
        `/api/redirects?from=${encodeURIComponent(pathname)}`,
        request.url,
      );
      const res = await fetch(lookupUrl);

      if (res.ok) {
        const data = await res.json();
        if (data.to) {
          return NextResponse.redirect(
            new URL(data.to, request.url),
            parseInt(data.statusCode) || 301,
          );
        }
      }
    } catch {
      // Silently fall through to normal routing
    }
  }

  // Normal next-intl locale routing
  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};
```

Key changes from original:
- Wraps `intlMiddleware` instead of exporting it directly
- Adds `isLegacyCandidate` check before locale routing
- Calls `/api/redirects` for non-locale, non-admin paths
- Falls through to normal locale routing if no redirect found

- [ ] **Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add legacy URL redirect handling to middleware"
```

---

## Task 3: Sitemap.xml + robots.txt

**Files:**
- Create: `src/app/sitemap.ts`
- Create: `src/app/robots.ts`

- [ ] **Step 1: Create dynamic sitemap**

Create `src/app/sitemap.ts`:

```ts
import type { MetadataRoute } from "next";
import { getPayload } from "payload";
import configPromise from "@payload-config";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://mfmsport.ma";
const LOCALES = ["ar", "fr", "en"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const payload = await getPayload({ config: configPromise });
  const entries: MetadataRoute.Sitemap = [];

  // Static pages per locale
  for (const locale of LOCALES) {
    entries.push(
      { url: `${SITE_URL}/${locale}`, lastModified: new Date(), changeFrequency: "hourly", priority: 1.0 },
      { url: `${SITE_URL}/${locale}/articles`, changeFrequency: "hourly", priority: 0.9 },
      { url: `${SITE_URL}/${locale}/matches`, changeFrequency: "hourly", priority: 0.9 },
      { url: `${SITE_URL}/${locale}/videos`, changeFrequency: "daily", priority: 0.7 },
      { url: `${SITE_URL}/${locale}/search`, changeFrequency: "weekly", priority: 0.3 },
      { url: `${SITE_URL}/${locale}/about`, changeFrequency: "monthly", priority: 0.4 },
      { url: `${SITE_URL}/${locale}/contact`, changeFrequency: "monthly", priority: 0.4 },
      { url: `${SITE_URL}/${locale}/legal`, changeFrequency: "monthly", priority: 0.2 },
      { url: `${SITE_URL}/${locale}/privacy`, changeFrequency: "monthly", priority: 0.2 },
    );
  }

  // Articles
  const articles = await payload.find({
    collection: "articles",
    where: { status: { equals: "published" } },
    limit: 50000,
    select: { slug: true, updatedAt: true },
    sort: "-publishedAt",
  });

  for (const article of articles.docs) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${SITE_URL}/${locale}/articles/${article.slug}`,
        lastModified: new Date(article.updatedAt),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  }

  // Categories
  const categories = await payload.find({
    collection: "categories",
    limit: 500,
    select: { slug: true },
  });

  for (const category of categories.docs) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${SITE_URL}/${locale}/category/${category.slug}`,
        changeFrequency: "daily",
        priority: 0.6,
      });
    }
  }

  // Tags
  const tags = await payload.find({
    collection: "tags",
    limit: 1000,
    select: { slug: true },
  });

  for (const tag of tags.docs) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${SITE_URL}/${locale}/tag/${tag.slug}`,
        changeFrequency: "daily",
        priority: 0.5,
      });
    }
  }

  // Authors
  const authors = await payload.find({
    collection: "authors",
    limit: 100,
    select: { slug: true },
  });

  for (const author of authors.docs) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${SITE_URL}/${locale}/author/${author.slug}`,
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
  }

  // Competitions
  const competitions = await payload.find({
    collection: "competitions",
    limit: 50,
    select: { slug: true },
  });

  for (const comp of competitions.docs) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${SITE_URL}/${locale}/competition/${comp.slug}`,
        changeFrequency: "daily",
        priority: 0.7,
      });
    }
  }

  // Clubs
  const clubs = await payload.find({
    collection: "clubs",
    limit: 200,
    select: { slug: true },
  });

  for (const club of clubs.docs) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${SITE_URL}/${locale}/club/${club.slug}`,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  }

  return entries;
}
```

- [ ] **Step 2: Create robots.txt**

Create `src/app/robots.ts`:

```ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mfmsport.ma";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/", "/_next/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/sitemap.ts src/app/robots.ts
git commit -m "feat: add dynamic sitemap.xml and robots.txt"
```

---

## Task 4: RSS Feeds per Locale

**Files:**
- Create: `src/app/(frontend)/[locale]/feed.xml/route.ts`

- [ ] **Step 1: Create RSS route handler**

Create `src/app/(frontend)/[locale]/feed.xml/route.ts`:

```ts
import { getPayload } from "payload";
import configPromise from "@payload-config";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://mfmsport.ma";

const LOCALE_NAMES: Record<string, string> = {
  ar: "MFM Sport - أخبار الكرة المغربية",
  fr: "MFM Sport - Actualites du football marocain",
  en: "MFM Sport - Moroccan Football News",
};

const LOCALE_DESCRIPTIONS: Record<string, string> = {
  ar: "آخر أخبار كرة القدم المغربية والعالمية",
  fr: "Les dernieres actualites du football marocain et mondial",
  en: "Latest Moroccan and world football news",
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  const payload = await getPayload({ config: configPromise });

  const articles = await payload.find({
    collection: "articles",
    where: { status: { equals: "published" } },
    locale,
    limit: 50,
    sort: "-publishedAt",
    depth: 1,
  });

  const items = articles.docs
    .map((article) => {
      const url = `${SITE_URL}/${locale}/articles/${article.slug}`;
      const pubDate = article.publishedAt
        ? new Date(article.publishedAt).toUTCString()
        : new Date(article.createdAt).toUTCString();

      return `    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(article.excerpt || "")}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(LOCALE_NAMES[locale] || LOCALE_NAMES.en)}</title>
    <link>${SITE_URL}/${locale}</link>
    <description>${escapeXml(LOCALE_DESCRIPTIONS[locale] || LOCALE_DESCRIPTIONS.en)}</description>
    <language>${locale}</language>
    <atom:link href="${SITE_URL}/${locale}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(frontend)/[locale]/feed.xml/"
git commit -m "feat: add RSS feeds per locale"
```

---

## Task 5: Dynamic OG Image Generation

**Files:**
- Create: `src/app/api/og/route.tsx`
- Modify: `src/app/(frontend)/[locale]/articles/[slug]/page.tsx` (update generateMetadata)

- [ ] **Step 1: Create OG image route**

Create `src/app/api/og/route.tsx`:

```tsx
import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") || "MFM Sport";
  const category = searchParams.get("category") || "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "60px",
          background: "linear-gradient(135deg, #0E0E10 0%, #1A1A1D 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* Brand */}
        <div
          style={{
            position: "absolute",
            top: "40px",
            left: "60px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span style={{ fontSize: "32px", fontWeight: 700, color: "#D92332" }}>
            MFM
          </span>
          <span style={{ fontSize: "32px", fontWeight: 700, color: "#F5F5F5" }}>
            Sport
          </span>
        </div>

        {/* Category badge */}
        {category && (
          <div
            style={{
              display: "flex",
              marginBottom: "16px",
            }}
          >
            <span
              style={{
                background: "#D92332",
                color: "white",
                padding: "6px 16px",
                borderRadius: "6px",
                fontSize: "20px",
                fontWeight: 600,
              }}
            >
              {category}
            </span>
          </div>
        )}

        {/* Title */}
        <div
          style={{
            fontSize: "52px",
            fontWeight: 700,
            color: "#F5F5F5",
            lineHeight: 1.2,
            display: "flex",
            maxWidth: "900px",
          }}
        >
          {title.length > 100 ? title.slice(0, 97) + "..." : title}
        </div>

        {/* Bottom accent line */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "#D92332",
          }}
        />
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
```

- [ ] **Step 2: Update article page metadata to use OG image fallback**

Read `src/app/(frontend)/[locale]/articles/[slug]/page.tsx`. Find the `generateMetadata` function and update the `openGraph.images` to fall back to the dynamic OG image when no featured image exists:

Replace the existing `openGraph` block in generateMetadata with:

```ts
const heroImageUrl = getImageUrl(article.featuredImage, "hero");
const category = article.categories?.[0];
const categoryName = category && typeof category === "object" ? category.name : "";

const ogImage = heroImageUrl
  || `${process.env.NEXT_PUBLIC_SITE_URL || ""}/api/og?title=${encodeURIComponent(article.title)}&category=${encodeURIComponent(categoryName)}`;

return {
  title: `${article.title} | MFM Sport`,
  description: article.excerpt || undefined,
  openGraph: {
    title: article.title,
    description: article.excerpt || undefined,
    images: [{ url: ogImage, width: 1200, height: 630 }],
  },
};
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/og/ "src/app/(frontend)/[locale]/articles/[slug]/page.tsx"
git commit -m "feat: add dynamic OG image generation with branded fallback"
```

---

## Task 6: Revalidation API Route

**Files:**
- Create: `src/app/api/revalidate/route.ts`
- Modify: `.env.example`

- [ ] **Step 1: Create revalidation route**

Create `src/app/api/revalidate/route.ts`:

```ts
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function POST(request: Request) {
  const secret = request.headers.get("x-revalidate-secret");

  if (!process.env.REVALIDATION_SECRET || secret !== process.env.REVALIDATION_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { collection, slug, locale } = body;
    const locales = locale ? [locale] : ["ar", "fr", "en"];

    for (const loc of locales) {
      switch (collection) {
        case "articles":
          revalidatePath(`/${loc}/articles/${slug}`);
          revalidatePath(`/${loc}/articles`);
          revalidatePath(`/${loc}`);
          break;
        case "categories":
          revalidatePath(`/${loc}/category/${slug}`);
          break;
        case "tags":
          revalidatePath(`/${loc}/tag/${slug}`);
          break;
        case "authors":
          revalidatePath(`/${loc}/author/${slug}`);
          break;
        case "competitions":
          revalidatePath(`/${loc}/competition/${slug}`);
          break;
        case "clubs":
          revalidatePath(`/${loc}/club/${slug}`);
          break;
        case "pages":
          revalidatePath(`/${loc}/${slug}`);
          break;
        default:
          // Revalidate homepage for any collection change
          revalidatePath(`/${loc}`);
      }
    }

    return NextResponse.json({ revalidated: true, collection, slug });
  } catch (error) {
    console.error("[Revalidate] Error:", error);
    return NextResponse.json({ error: "Revalidation failed" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Update .env.example**

Add:
```env
# Revalidation (on-demand ISR)
REVALIDATION_SECRET=
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/revalidate/ .env.example
git commit -m "feat: add revalidation API route for on-demand ISR"
```

---

## Task 7: WordPress Migration Script

**Files:**
- Create: `scripts/migrate-wp.ts`

- [ ] **Step 1: Create migration script**

Create `scripts/migrate-wp.ts`:

```ts
/**
 * WordPress -> Payload CMS Migration Script
 *
 * Usage:
 *   npx tsx scripts/migrate-wp.ts
 *
 * Requires:
 *   - WP_API_URL env var (e.g., https://mfmsport.ma/wp-json/wp/v2)
 *   - DATABASE_URL and PAYLOAD_SECRET env vars (for Payload)
 *
 * What it does:
 *   1. Fetches all categories, tags, authors from WordPress
 *   2. Creates them in Payload
 *   3. Fetches all published articles (paginated)
 *   4. For each article: maps relationships, creates in Payload, creates redirect
 */

import "dotenv/config";
import { getPayload } from "payload";
import config from "../src/payload.config";

const WP_API_URL = process.env.WP_API_URL || "https://mfmsport.ma/wp-json/wp/v2";
const BATCH_SIZE = 100;

// ID mapping: WP ID -> Payload ID
const categoryMap = new Map<number, string>();
const tagMap = new Map<number, string>();
const authorMap = new Map<number, string>();

async function fetchWpPages<T>(endpoint: string): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `${WP_API_URL}/${endpoint}?per_page=${BATCH_SIZE}&page=${page}`;
    console.log(`  Fetching ${url}`);

    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 400) break; // No more pages
      throw new Error(`WP API error: ${res.status} for ${url}`);
    }

    const data: T[] = await res.json();
    all.push(...data);

    const totalPages = parseInt(res.headers.get("x-wp-totalpages") || "1", 10);
    hasMore = page < totalPages;
    page++;
  }

  return all;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

async function migrateCategories(payload: any) {
  console.log("\n--- Migrating Categories ---");
  const wpCategories = await fetchWpPages<any>("categories");
  console.log(`Found ${wpCategories.length} WP categories`);

  for (const wpCat of wpCategories) {
    const slug = wpCat.slug || slugify(wpCat.name);
    try {
      // Check if already exists
      const existing = await payload.find({
        collection: "categories",
        where: { slug: { equals: slug } },
        limit: 1,
      });

      if (existing.docs[0]) {
        categoryMap.set(wpCat.id, existing.docs[0].id);
        console.log(`  [skip] Category "${wpCat.name}" already exists`);
        continue;
      }

      const created = await payload.create({
        collection: "categories",
        data: {
          name: wpCat.name,
          slug,
          description: wpCat.description || undefined,
        },
        locale: "ar",
      });

      categoryMap.set(wpCat.id, created.id);
      console.log(`  [created] Category "${wpCat.name}" -> ${created.id}`);
    } catch (error: any) {
      console.error(`  [error] Category "${wpCat.name}": ${error.message}`);
    }
  }
}

async function migrateTags(payload: any) {
  console.log("\n--- Migrating Tags ---");
  const wpTags = await fetchWpPages<any>("tags");
  console.log(`Found ${wpTags.length} WP tags`);

  for (const wpTag of wpTags) {
    const slug = wpTag.slug || slugify(wpTag.name);
    try {
      const existing = await payload.find({
        collection: "tags",
        where: { slug: { equals: slug } },
        limit: 1,
      });

      if (existing.docs[0]) {
        tagMap.set(wpTag.id, existing.docs[0].id);
        continue;
      }

      const created = await payload.create({
        collection: "tags",
        data: { name: wpTag.name, slug },
        locale: "ar",
      });

      tagMap.set(wpTag.id, created.id);
      console.log(`  [created] Tag "${wpTag.name}"`);
    } catch (error: any) {
      console.error(`  [error] Tag "${wpTag.name}": ${error.message}`);
    }
  }
}

async function migrateAuthors(payload: any) {
  console.log("\n--- Migrating Authors ---");
  const wpUsers = await fetchWpPages<any>("users");
  console.log(`Found ${wpUsers.length} WP users`);

  for (const wpUser of wpUsers) {
    const slug = wpUser.slug || slugify(wpUser.name);
    try {
      const existing = await payload.find({
        collection: "authors",
        where: { slug: { equals: slug } },
        limit: 1,
      });

      if (existing.docs[0]) {
        authorMap.set(wpUser.id, existing.docs[0].id);
        continue;
      }

      const created = await payload.create({
        collection: "authors",
        data: {
          name: wpUser.name,
          slug,
          bio: wpUser.description || undefined,
        },
        locale: "ar",
      });

      authorMap.set(wpUser.id, created.id);
      console.log(`  [created] Author "${wpUser.name}"`);
    } catch (error: any) {
      console.error(`  [error] Author "${wpUser.name}": ${error.message}`);
    }
  }
}

async function migrateArticles(payload: any) {
  console.log("\n--- Migrating Articles ---");
  let page = 1;
  let hasMore = true;
  let total = 0;

  while (hasMore) {
    const url = `${WP_API_URL}/posts?per_page=${BATCH_SIZE}&page=${page}&status=publish`;
    console.log(`  Fetching page ${page}...`);

    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 400) break;
      throw new Error(`WP API error: ${res.status}`);
    }

    const wpPosts: any[] = await res.json();
    const totalPages = parseInt(res.headers.get("x-wp-totalpages") || "1", 10);

    for (const wpPost of wpPosts) {
      const newSlug = wpPost.slug || slugify(wpPost.title.rendered);

      try {
        // Check if already migrated
        const existing = await payload.find({
          collection: "articles",
          where: { slug: { equals: newSlug } },
          limit: 1,
        });

        if (existing.docs[0]) {
          total++;
          continue;
        }

        // Map relationships
        const categoryIds = (wpPost.categories || [])
          .map((id: number) => categoryMap.get(id))
          .filter(Boolean);

        const tagIds = (wpPost.tags || [])
          .map((id: number) => tagMap.get(id))
          .filter(Boolean);

        const authorId = authorMap.get(wpPost.author);

        if (!authorId) {
          console.error(`  [skip] No author mapping for WP author ID ${wpPost.author}`);
          continue;
        }

        // Create article
        const article = await payload.create({
          collection: "articles",
          data: {
            title: wpPost.title.rendered.replace(/&#8211;/g, "-").replace(/&amp;/g, "&"),
            slug: newSlug,
            excerpt: wpPost.excerpt.rendered.replace(/<[^>]*>/g, "").trim(),
            // body: skip for now — HTML to Lexical conversion needed
            author: authorId,
            categories: categoryIds,
            tags: tagIds,
            status: "published",
            publishedAt: wpPost.date,
          },
          locale: "ar",
        });

        // Create redirect from old WP path
        const oldPath = `/${wpPost.slug}/`;
        try {
          await payload.create({
            collection: "redirects",
            data: {
              from: oldPath,
              to: `/ar/articles/${newSlug}`,
              statusCode: "301",
            },
          });
        } catch {
          // Redirect may already exist
        }

        total++;
        if (total % 100 === 0) {
          console.log(`  Migrated ${total} articles...`);
        }
      } catch (error: any) {
        console.error(`  [error] Article "${wpPost.title?.rendered}": ${error.message}`);
      }
    }

    hasMore = page < totalPages;
    page++;
  }

  console.log(`\nTotal articles migrated: ${total}`);
}

async function main() {
  console.log("=== MFM Sport WordPress Migration ===");
  console.log(`WP API: ${WP_API_URL}`);

  const payload = await getPayload({ config });

  await migrateCategories(payload);
  await migrateTags(payload);
  await migrateAuthors(payload);
  await migrateArticles(payload);

  console.log("\n=== Migration Complete ===");
  console.log(`Categories: ${categoryMap.size}`);
  console.log(`Tags: ${tagMap.size}`);
  console.log(`Authors: ${authorMap.size}`);
  console.log(`\nNote: Article bodies were skipped (HTML -> Lexical conversion needed).`);
  console.log(`Use Payload admin to manually edit article bodies, or implement HTML-to-Lexical conversion.`);

  process.exit(0);
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
```

- [ ] **Step 2: Add WP_API_URL to .env.example**

Add:
```env
# WordPress Migration (one-time use)
WP_API_URL=https://mfmsport.ma/wp-json/wp/v2
```

- [ ] **Step 3: Add migrate script to package.json**

Add to scripts:
```json
"migrate:wp": "tsx scripts/migrate-wp.ts"
```

- [ ] **Step 4: Install tsx if not present**

```bash
pnpm add -D tsx
```

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate-wp.ts .env.example package.json pnpm-lock.yaml
git commit -m "feat: add WordPress migration script (categories, tags, authors, articles, redirects)"
```

---

## Self-Review

**Spec coverage (from PROJECT_MEMORY.md §18):**
- Redirects collection: Task 1 (from, to, statusCode with indexed from field)
- Legacy redirect middleware: Task 2 (checks non-locale paths against API, 301 redirects)
- Sitemap.xml: Task 3 (dynamic, all locales, articles/categories/tags/authors/competitions/clubs)
- robots.txt: Task 3 (allows /, disallows admin/api/_next, points to sitemap)
- RSS feed per locale: Task 4 (/[locale]/feed.xml with latest 50 articles)
- OG image generation: Task 5 (/api/og with branded MFM Sport template + article fallback)
- Revalidation webhook: Task 6 (POST /api/revalidate with secret, per-collection path revalidation)
- WordPress migration: Task 7 (WP REST API -> Payload with categories/tags/authors/articles/redirects)

**Noted limitation:** Article body migration skips HTML-to-Lexical conversion (documented in script output). This is intentional — converting ~43K HTML bodies to Lexical JSON requires careful handling of WP shortcodes, embeds, and formatting. The script migrates all metadata, relationships, and creates redirects. Bodies can be converted in a follow-up pass or edited manually for priority articles.

**No gaps found.**

---

*Plan written 2026-04-21. Ready for execution.*
