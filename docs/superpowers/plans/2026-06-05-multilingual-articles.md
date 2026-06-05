# Multilingual Articles (Arabic / French / English) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve every article's title, excerpt, body, slug, and taxonomy in the visitor's chosen language (ar/fr/en) from pre-translated content stored in the database, with zero per-request translation.

**Architecture:** The storage + serving half already exists — Payload localization is configured (`ar`/`fr`/`en`, `defaultLocale:'ar'`, `fallback:true`) and `title`/`excerpt`/`body` are already `localized:true`; the frontend already reads the locale from the URL and passes it to every query. This project therefore reduces to: (1) make `slug` localized too (per-locale keyword URLs), (2) build a structure-safe Lexical translate engine, (3) build an export → (translate in a Claude Code session) → import pipeline that writes `fr`/`en` locale fields, (4) add hreflang/canonical/localized sitemap, then (5) translate a pilot, verify end-to-end, and bulk-translate the rest.

**Tech Stack:** Payload CMS 3.84 + Next.js 16.2 (App Router) · Postgres (Neon) via `@payloadcms/db-postgres` (committed migrations in `src/migrations/`) · next-intl 4 · Lexical richtext · Vitest 3 (jsdom) · scripts run with `tsx` + `dotenv/config` · pnpm.

---

## Context

The site's language switch already works for UI, players, teams, and football-API data, but **articles render Arabic in all three languages**. That is not a missing feature — it is empty `fr`/`en` locale fields plus `fallback:true` serving Arabic. The moment we write French/English into an article's locale fields, `/fr/...` and `/en/...` serve that language automatically, with no frontend rewiring.

The user chose: **localized slugs** (best SEO; each language gets its own keyword URL), **Claude Code file-based translation** (free, high-quality, reviewable — export JSON, translate in a Claude Code session, import), and **pilot-first then bulk** (~5–10 articles verified end-to-end before the full ~200).

Two consequences shape the plan:
- `status` is **shared across locales** (no per-language draft). Because `fallback:true` is on, an untranslated article shows Arabic on `/fr` and `/en` today — a safe, progressive state. But it also means a written `fr` field goes live immediately, so **quality must be gated before import** (dry-run + structural lint + manual review on a pilot).
- Making `slug` localized **moves a column** from the `articles` table into `articles_locales`. The auto-generated migration is destructive (drops the Arabic slugs). The migration must be **hand-edited to backfill** the existing Arabic slug into each article's `ar` locale row. This is the single highest-risk step.

### Pre-flight (do once, before Phase A)
- **Take a Neon backup / branch** before running any migration (`mcp__supabase__create_branch` or a Neon console branch). The slug migration is the only step that can lose data.
- Record the pilot baseline (used to prove no Arabic slug was lost), via `mcp__supabase__execute_sql` (read-only):
  ```sql
  SELECT _parent_id, _locale, slug, left(title,40) AS title
  FROM articles_locales WHERE _locale='ar' ORDER BY _parent_id LIMIT 10;
  ```
  Save the 5–10 `_parent_id`s + Arabic slugs — this is the pilot set and the R1/R2 safety check.

### File structure (created / modified)
| Path | Responsibility |
|---|---|
| `src/collections/Articles.ts` | **Modify** — make `slug` localized |
| `src/migrations/<ts>_localized_article_slug.ts` | **Create** (generate, then hand-edit `up()` to backfill) |
| `src/migrations/index.ts` | **Modify** — register migration (generator does this) |
| `src/lib/payload/slugify.ts` | **Create** — shared ASCII slugify + fallback |
| `src/lib/payload/slugify.test.ts` | **Create** — slugify tests |
| `src/lib/payload/queries.ts` | **Modify** — `resolveArticleBySlug`, locale-aware `getArticleBySlug`, `getArticleLocalizedSlugs` |
| `src/lib/i18n/lexical-translate.ts` | **Create** — extract/reinject/setDirection/validators (the engine) |
| `src/lib/i18n/lexical-translate.test.ts` | **Create** — engine tests (TDD) |
| `scripts/i18n-export.ts` | **Create** — Arabic articles → `translations/pending/<id>.json` |
| `scripts/i18n-import.ts` | **Create** — `translations/done/<id>.json` → `fr`/`en` locale fields |
| `scripts/i18n-translate-taxonomy.ts` | **Create** — category/tag/author name+bio fr/en |
| `src/app/(frontend)/[locale]/articles/[slug]/page.tsx` | **Modify** — resolver + 301; hreflang/canonical metadata |
| `src/app/(frontend)/layout.tsx` | **Modify** — add `metadataBase` |
| `src/app/sitemap.ts` | **Modify** — per-locale article slugs |
| `src/components/layout/LanguageSwitcher.tsx` | **Modify** (optional) — slug-aware switch |
| `package.json` | **Modify** — `i18n:*` scripts |
| `.gitignore` | **Modify** — ignore `translations/` work files |

---

# PHASE A — Foundation: localized slug + migration + lookup

This phase must land and verify **before** any translation work. It is purely structural and safe (untranslated articles keep serving Arabic).

### Task A1: Make `slug` localized in Articles

**Files:**
- Modify: `src/collections/Articles.ts:16-24`

- [ ] **Step 1: Replace the slug field**

Current (`src/collections/Articles.ts:16-24`):
```ts
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      admin: {
        description: "URL-friendly identifier (ASCII, lowercase, hyphens)",
      },
    },
```
New:
```ts
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      localized: true,
      index: true,
      admin: {
        description:
          "URL-friendly identifier for THIS locale. Arabic keeps the original keyword slug; fr/en get an ASCII keyword slug. Unique per language.",
      },
    },
```
**Why `unique` stays:** with `localized:true`, Payload enforces uniqueness **per locale** (composite on `(_locale, slug)`) — exactly what we want. `index:true` speeds the cross-locale fallback lookup in A5.

- [ ] **Step 2: Regenerate Payload types**

Run: `pnpm generate:types`
Expected: `src/payload-types.ts` updates; `Article.slug` remains typed `string` (Payload types a localized field as its base type for the default-locale view).

- [ ] **Step 3: Commit**
```bash
git add src/collections/Articles.ts src/payload-types.ts
git commit -m "feat(i18n): make article slug localized (per-locale keyword URLs)"
```

---

### Task A2: Generate + hand-edit the slug migration (backfill-safe)

**Files:**
- Create: `src/migrations/<timestamp>_localized_article_slug.ts`
- Modify: `src/migrations/index.ts` (generator auto-registers)

The repo is in **migrate mode** (committed `src/migrations/*.ts` + `index.ts`; existing style uses `db.execute(sql\`...\`)` — see `20260506_111918_boss_preview_fallbacks.ts`). The auto-generated migration for this change is **destructive** (drops `articles.slug` without copying it into `articles_locales`). We generate it, then replace `up()`/`down()` with the backfill-safe version below.

- [ ] **Step 1: Generate the migration scaffold**

PowerShell (env must be loaded for the Payload CLI):
```powershell
$env:DATABASE_URL=(Get-Content .env | Select-String '^DATABASE_URL=').ToString().Split('=',2)[1]
$env:PAYLOAD_SECRET=(Get-Content .env | Select-String '^PAYLOAD_SECRET=').ToString().Split('=',2)[1]
pnpm payload migrate:create localized_article_slug
```
Expected: a new file `src/migrations/<timestamp>_localized_article_slug.ts` and an entry added to `src/migrations/index.ts`.

- [ ] **Step 2: Replace the generated `up()`/`down()` with the backfill-safe version**

Overwrite the body of the generated file with:
```ts
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- 1. Add the localized slug column NULLABLE first (so backfill can run).
    ALTER TABLE "articles_locales" ADD COLUMN IF NOT EXISTS "slug" varchar;

    -- 2. Backfill: copy each article's existing parent slug into its 'ar' locale row.
    --    Every existing article already has an 'ar' locales row (created with locale:'ar').
    UPDATE "articles_locales" AS al
    SET "slug" = a."slug"
    FROM "articles" AS a
    WHERE al."_parent_id" = a."id"
      AND al."_locale" = 'ar'
      AND al."slug" IS NULL;

    -- 3. Safety net: if any 'ar' locale row is missing, create it from the parent slug.
    INSERT INTO "articles_locales" ("_locale", "_parent_id", "slug", "title", "body")
    SELECT 'ar', a."id", a."slug", '', '{}'::jsonb
    FROM "articles" a
    WHERE NOT EXISTS (
      SELECT 1 FROM "articles_locales" al
      WHERE al."_parent_id" = a."id" AND al."_locale" = 'ar'
    );

    -- 4. Drop the old non-localized unique index + parent column.
    DROP INDEX IF EXISTS "articles_slug_idx";
    ALTER TABLE "articles" DROP COLUMN IF EXISTS "slug";

    -- 5. Composite unique index = unique PER LOCALE.
    CREATE UNIQUE INDEX IF NOT EXISTS "articles_locales_locale_slug_idx"
      ON "articles_locales" USING btree ("_locale", "slug");
    -- Plain index for the cross-locale fallback lookup in getArticleBySlug.
    CREATE INDEX IF NOT EXISTS "articles_locales_slug_idx"
      ON "articles_locales" USING btree ("slug");
  `)
  // NOTE: column stays NULLABLE on purpose — fr/en rows are NULL until import
  // fills them. Payload's field-level `required` guards new writes; existing
  // untranslated rows simply fall back to Arabic. Add NOT NULL in a follow-up
  // migration AFTER bulk import (Task E4), or leave nullable permanently.
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "slug" varchar;
    UPDATE "articles" AS a
    SET "slug" = al."slug"
    FROM "articles_locales" AS al
    WHERE al."_parent_id" = a."id" AND al."_locale" = 'ar';
    DROP INDEX IF EXISTS "articles_locales_locale_slug_idx";
    DROP INDEX IF EXISTS "articles_locales_slug_idx";
    ALTER TABLE "articles_locales" DROP COLUMN IF EXISTS "slug";
    CREATE UNIQUE INDEX IF NOT EXISTS "articles_slug_idx" ON "articles" USING btree ("slug");
  `)
}
```

- [ ] **Step 3: Commit (do NOT run yet)**
```bash
git add src/migrations
git commit -m "feat(i18n): backfill-safe migration to localize article slug"
```

---

### Task A3: Run the migration and prove no Arabic slug was lost

**Files:** none (DB operation + verification)

- [ ] **Step 1: Confirm the Neon backup/branch from Pre-flight exists.** If not, create it before proceeding.

- [ ] **Step 2: Run pending migrations**
```powershell
pnpm payload migrate
```
Expected: applies `<timestamp>_localized_article_slug`; no errors.

- [ ] **Step 3: Assert zero NULL Arabic slugs** (via `mcp__supabase__execute_sql`, read-only)
```sql
SELECT count(*) AS null_ar_slugs
FROM articles_locales WHERE _locale='ar' AND slug IS NULL;
```
Expected: `null_ar_slugs = 0`. If non-zero — STOP, restore the backup, fix the backfill.

- [ ] **Step 4: Spot-check the pilot Arabic slugs match the Pre-flight snapshot**
```sql
SELECT _parent_id, slug FROM articles_locales
WHERE _locale='ar' AND _parent_id IN (<pilot ids>) ORDER BY _parent_id;
```
Expected: byte-for-byte identical to the Pre-flight snapshot.

- [ ] **Step 5: Confirm an existing Arabic article still loads**

Run `pnpm dev`, then:
```powershell
curl.exe -s -o NUL -w "%{http_code}`n" "http://localhost:3000/ar/articles/<an-existing-arabic-slug>"
```
Expected: `200`.

---

### Task A4: Shared slugify module (TDD)

**Files:**
- Create: `src/lib/payload/slugify.ts`
- Test: `src/lib/payload/slugify.test.ts`

- [ ] **Step 1: Write the failing test** (`src/lib/payload/slugify.test.ts`)
```ts
import { describe, it, expect } from "vitest";
import { slugify, slugifyWithFallback } from "./slugify";

describe("slugify", () => {
  it("lowercases, strips diacritics, hyphenates spaces", () => {
    expect(slugify("L'Armée Royale gagne")).toBe("larmee-royale-gagne");
  });
  it("collapses repeats and trims edge hyphens", () => {
    expect(slugify("  Royal   Army!! ")).toBe("royal-army");
  });
  it("returns empty string for all-Arabic input", () => {
    expect(slugify("الجيش الملكي")).toBe("");
  });
});

describe("slugifyWithFallback", () => {
  it("uses the slug when non-empty", () => {
    expect(slugifyWithFallback("Royal Army", "123")).toBe("royal-army");
  });
  it("falls back when the slug is empty", () => {
    expect(slugifyWithFallback("الجيش الملكي", "123")).toBe("123");
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `pnpm vitest run src/lib/payload/slugify.test.ts`
Expected: FAIL — `Cannot find module './slugify'`.

- [ ] **Step 3: Implement** (`src/lib/payload/slugify.ts`)
```ts
/**
 * Generate a clean, ASCII, URL-safe slug from a (translated) title. Latin titles
 * survive; diacritics are stripped via NFD ("l'armée" -> "larmee"). Non-Latin
 * input may produce "" — callers must provide a fallback. Mirrors the regex used
 * in scripts/migrate-wp.ts so slugs stay consistent across the codebase.
 */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim();
}

/** slugify with a guaranteed-non-empty result (fallback is typically the id). */
export function slugifyWithFallback(text: string, fallback: string): string {
  const s = slugify(text);
  return s || slugify(fallback) || fallback;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm vitest run src/lib/payload/slugify.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**
```bash
git add src/lib/payload/slugify.ts src/lib/payload/slugify.test.ts
git commit -m "feat(i18n): shared slugify helper with non-empty fallback"
```

---

### Task A5: Locale-aware article lookup + 301 fallback for old Arabic links

**Files:**
- Modify: `src/lib/payload/queries.ts:32-45` (replace `getArticleBySlug`, add `resolveArticleBySlug` + `getArticleLocalizedSlugs`)
- Modify: `src/app/(frontend)/[locale]/articles/[slug]/page.tsx:51-56` (page body) and import line

An inbound `/ar/articles/<arabic-slug>` matches directly (the Arabic slug *is* the `ar` slug). An inbound `/fr/articles/<arabic-slug>` (old shared link, or a naive locale-swap) fails the current-locale match, falls back to a cross-locale lookup, finds the article, reads its `fr` slug, and 301s to the canonical localized URL. If the target locale has no slug yet (untranslated during rollout), it serves the doc by id (Arabic fallback content) with **no** redirect — avoiding a loop to a missing slug.

- [ ] **Step 1: Replace `getArticleBySlug` (lines 32-45) with the resolver + back-compat wrapper**
```ts
type ArticleResolution = {
  article: Awaited<ReturnType<typeof getArticleBySlug>>;
  /** When set, the inbound slug didn't match the current locale; 301 here. */
  redirectToSlug: string | null;
};

/**
 * Resolve an article by slug for a display locale.
 *  1. Match the slug in the CURRENT locale (happy path).
 *  2. Fall back to matching it in ANY locale (old Arabic links). If found,
 *     surface the current locale's own slug so the caller can 301.
 */
export async function resolveArticleBySlug(
  slug: string,
  locale: Locale,
): Promise<ArticleResolution> {
  const payload = await getPayloadClient();
  const decoded = decodeSlug(slug);

  const primary = await payload.find({
    collection: "articles",
    where: { slug: { equals: decoded }, status: { equals: "published" } },
    locale,
    limit: 1,
    depth: 2,
  });
  if (primary.docs[0]) return { article: primary.docs[0], redirectToSlug: null };

  // locale:'all' matches the slug in ANY locale and returns slug as {ar,fr,en}.
  const fallback = await payload.find({
    collection: "articles",
    where: { slug: { equals: decoded }, status: { equals: "published" } },
    locale: "all",
    limit: 1,
    depth: 0,
  });
  const hit = fallback.docs[0];
  if (!hit) return { article: null, redirectToSlug: null };

  const slugByLocale = hit.slug as unknown as Partial<Record<Locale, string>>;
  const targetSlug = slugByLocale[locale];
  if (targetSlug && targetSlug !== decoded) {
    return { article: null, redirectToSlug: targetSlug };
  }

  const byId = await payload.findByID({
    collection: "articles",
    id: hit.id,
    locale,
    depth: 2,
  });
  return { article: byId, redirectToSlug: null };
}

/** Back-compat single-doc lookup (used by generateMetadata; ignores redirects). */
export async function getArticleBySlug(slug: string, locale: Locale) {
  const { article, redirectToSlug } = await resolveArticleBySlug(slug, locale);
  if (article) return article;
  if (redirectToSlug) {
    const payload = await getPayloadClient();
    const r = await payload.find({
      collection: "articles",
      where: { slug: { equals: redirectToSlug }, status: { equals: "published" } },
      locale,
      limit: 1,
      depth: 2,
    });
    return r.docs[0] || null;
  }
  return null;
}
```

- [ ] **Step 2: Append `getArticleLocalizedSlugs` (used by SEO in Phase D) at the end of `queries.ts`**
```ts
type LocalizedSlugs = Record<Locale, string>;

/**
 * Resolve the per-locale slugs for the article matching `slug` in `locale`.
 * Used by hreflang/canonical. Falls back to the Arabic slug for any locale whose
 * slug is empty (matches fallback:true). One id-resolving find + one all-locale find.
 */
export async function getArticleLocalizedSlugs(
  slug: string,
  locale: Locale,
): Promise<{ id: number | string; slugs: LocalizedSlugs } | null> {
  const payload = await getPayloadClient();
  const matched = await payload.find({
    collection: "articles",
    where: { slug: { equals: decodeSlug(slug) }, status: { equals: "published" } },
    locale,
    limit: 1,
    depth: 0,
    select: { slug: true },
  });
  const doc = matched.docs[0];
  if (!doc) return null;

  const allLocales = await payload.find({
    collection: "articles",
    where: { id: { equals: doc.id } },
    locale: "all",
    limit: 1,
    depth: 0,
    select: { slug: true },
  });
  const raw = (allLocales.docs[0] as { slug?: Partial<Record<Locale, string>> | string } | undefined)?.slug;
  const map: Partial<Record<Locale, string>> =
    raw && typeof raw === "object" ? raw : { ar: typeof raw === "string" ? raw : undefined };
  const arSlug = map.ar || (typeof raw === "string" ? raw : "") || decodeSlug(slug);

  return {
    id: doc.id,
    slugs: { ar: map.ar || arSlug, fr: map.fr || arSlug, en: map.en || arSlug },
  };
}
```

- [ ] **Step 3: Wire the page to redirect** (`src/app/(frontend)/[locale]/articles/[slug]/page.tsx`)

Change the import on line 5 and 8:
```ts
import { notFound, redirect } from "next/navigation";
```
```ts
import {
  getArticleBySlug,
  getArticleLocalizedSlugs,
  resolveArticleBySlug,
  getRelatedArticles,
} from "@/lib/payload/queries";
```
Replace the page body opening (lines 51-56):
```ts
export default async function ArticlePage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const { article, redirectToSlug } = await resolveArticleBySlug(
    slug,
    locale as Config["locale"],
  );
  if (redirectToSlug) {
    redirect(`/${locale}/articles/${encodeURIComponent(redirectToSlug)}`);
  }
  if (!article) notFound();
```
(The rest of the component is unchanged. `generateMetadata` keeps calling `getArticleBySlug`, which now resolves cross-locale transparently — `getArticleLocalizedSlugs` is added to metadata in Task D2.)

- [ ] **Step 4: Verify existing Arabic article + cross-locale redirect**

With `pnpm dev` running:
```powershell
curl.exe -s -o NUL -w "%{http_code}`n" "http://localhost:3000/ar/articles/<arabic-slug>"
```
Expected: `200` (unchanged behavior; no fr/en yet so no redirect occurs).

- [ ] **Step 5: Commit**
```bash
git add src/lib/payload/queries.ts "src/app/(frontend)/[locale]/articles/[slug]/page.tsx"
git commit -m "feat(i18n): locale-aware article resolver with 301 fallback for legacy slugs"
```

---

# PHASE B — Lexical translate engine (the technical crux)

Pure functions, fully TDD, no DB. Translates only `text` node strings; preserves every other field (formatting, links, **image/upload nodes by media id**); flips RTL→LTR for fr/en; validates structure before any DB write.

### Task B1: `lexical-translate.ts` engine + full test suite

**Files:**
- Create: `src/lib/i18n/lexical-translate.ts`
- Test: `src/lib/i18n/lexical-translate.test.ts`

Test discovery is automatic — `vitest.config.ts` includes `src/**/*.test.{ts,tsx}`. No config change.

- [ ] **Step 1: Write the failing test file** (`src/lib/i18n/lexical-translate.test.ts`)
```ts
import { describe, it, expect } from 'vitest';
import {
  extractSegments,
  reinjectSegments,
  setDirection,
  validateReinjection,
  assertFullCoverage,
  buildTranslatedBody,
  ReinjectionMismatchError,
  type LexicalRoot,
} from './lexical-translate';

// Fixture A: heading + paragraph (with a bold span) + an upload image.
function fixtureA(): LexicalRoot {
  return {
    root: {
      type: 'root', format: '', indent: 0, version: 1, direction: 'rtl',
      children: [
        { type: 'heading', tag: 'h2', version: 1, format: '', indent: 0, direction: 'rtl',
          children: [{ type: 'text', version: 1, text: 'الجيش الملكي', format: 0, mode: 'normal', style: '', detail: 0 }] },
        { type: 'paragraph', version: 1, format: '', indent: 0, direction: 'rtl', textFormat: 0, textStyle: '',
          children: [
            { type: 'text', version: 1, text: 'أعلن النادي ', format: 0, mode: 'normal', style: '', detail: 0 },
            { type: 'text', version: 1, text: 'إصابة اللاعب', format: 1, mode: 'normal', style: '', detail: 0 },
          ] },
        { type: 'upload', version: 3, format: '', id: 'a1b2c3d4e5f6a7b8c9d0e1f2', relationTo: 'media', value: 4242, fields: {} },
      ],
    },
  };
}
// Fixture B: paragraph containing a link node (inline element with children).
function fixtureB(): LexicalRoot {
  return {
    root: {
      type: 'root', format: '', indent: 0, version: 1, direction: 'rtl',
      children: [
        { type: 'paragraph', version: 1, format: '', indent: 0, direction: 'rtl', textFormat: 0, textStyle: '',
          children: [
            { type: 'text', version: 1, text: 'اقرأ ', format: 0, mode: 'normal', style: '', detail: 0 },
            { type: 'link', version: 3, format: '', indent: 0, direction: 'rtl', id: 'link-node-id-001',
              fields: { linkType: 'custom', url: 'https://mfmsport.ma/article', newTab: true },
              children: [{ type: 'text', version: 1, text: 'الخبر الكامل', format: 0, mode: 'normal', style: '', detail: 0 }] },
          ] },
      ],
    },
  };
}
// Fixture C: nested list + whitespace/empty text + linebreak + a paragraph with NO direction key.
function fixtureC(): LexicalRoot {
  return {
    root: {
      type: 'root', format: '', indent: 0, version: 1, direction: 'rtl',
      children: [
        { type: 'list', listType: 'bullet', start: 1, tag: 'ul', version: 1, format: '', indent: 0, direction: 'rtl',
          children: [
            { type: 'listitem', value: 1, version: 1, format: '', indent: 0, direction: 'rtl',
              children: [
                { type: 'text', version: 1, text: 'العنصر الأول', format: 0, mode: 'normal', style: '', detail: 0 },
                { type: 'text', version: 1, text: '   ', format: 0, mode: 'normal', style: '', detail: 0 },
                { type: 'list', listType: 'bullet', start: 1, tag: 'ul', version: 1, format: '', indent: 1, direction: 'rtl',
                  children: [
                    { type: 'listitem', value: 1, version: 1, format: '', indent: 1, direction: 'rtl',
                      children: [{ type: 'text', version: 1, text: 'عنصر متداخل', format: 0, mode: 'normal', style: '', detail: 0 }] },
                  ] },
              ] },
          ] },
        { type: 'paragraph', version: 1, format: '', indent: 0,
          children: [
            { type: 'linebreak', version: 1 },
            { type: 'text', version: 1, text: '', format: 0, mode: 'normal', style: '', detail: 0 },
          ] },
      ],
    },
  };
}

describe('extractSegments', () => {
  it('extracts heading + both paragraph spans in order with path ids; upload yields none', () => {
    expect(extractSegments(fixtureA())).toEqual([
      { id: '0.0', text: 'الجيش الملكي' },
      { id: '1.0', text: 'أعلن النادي ' },
      { id: '1.1', text: 'إصابة اللاعب' },
    ]);
  });
  it('reaches text inside a link via normal recursion', () => {
    expect(extractSegments(fixtureB())).toEqual([
      { id: '0.0', text: 'اقرأ ' },
      { id: '0.1.0', text: 'الخبر الكامل' },
    ]);
  });
  it('skips empty/whitespace-only text; handles nested lists', () => {
    const segs = extractSegments(fixtureC());
    expect(segs).toEqual([
      { id: '0.0.0', text: 'العنصر الأول' },
      { id: '0.0.2.0.0', text: 'عنصر متداخل' },
    ]);
  });
  it('returns [] for a degenerate body', () => {
    expect(extractSegments({ root: { type: 'root', children: [], direction: 'ltr', format: '', indent: 0, version: 1 } })).toEqual([]);
  });
});

describe('reinjectSegments', () => {
  it('replaces text by id, preserves bold bitmask + upload value, non-mutating', () => {
    const original = fixtureA();
    const snapshot = JSON.stringify(original);
    const out = reinjectSegments(original, { '0.0': 'Royal Army', '1.0': 'The club announced ', '1.1': 'the player injury' });
    expect(JSON.stringify(original)).toBe(snapshot);
    expect(out.root.children[1].children![1].format).toBe(1);
    expect(out.root.children[2]).toEqual({ type: 'upload', version: 3, format: '', id: 'a1b2c3d4e5f6a7b8c9d0e1f2', relationTo: 'media', value: 4242, fields: {} });
  });
  it('preserves link url/fields/id while translating link text', () => {
    const out = reinjectSegments(fixtureB(), { '0.0': 'Read ', '0.1.0': 'the full story' });
    const link = out.root.children[0].children![1];
    expect(link.fields).toEqual({ linkType: 'custom', url: 'https://mfmsport.ma/article', newTab: true });
    expect(link.children![0].text).toBe('the full story');
  });
  it('keeps original text for ids missing from the map', () => {
    const out = reinjectSegments(fixtureA(), { '0.0': 'Royal Army' });
    expect(out.root.children[1].children![0].text).toBe('أعلن النادي ');
  });
});

describe('setDirection', () => {
  it('flips root and nodes that HAVE direction, without inventing the field', () => {
    const out = setDirection(fixtureC(), 'ltr');
    expect(out.root.direction).toBe('ltr');
    expect(out.root.children[0].direction).toBe('ltr');
    expect(Object.prototype.hasOwnProperty.call(out.root.children[1], 'direction')).toBe(false);
  });
  it('leaves upload value untouched when flipping', () => {
    expect(setDirection(fixtureA(), 'ltr').root.children[2].value).toBe(4242);
  });
});

describe('validateReinjection', () => {
  it('passes for a correct reinjection', () => {
    const o = fixtureA();
    expect(() => validateReinjection(o, reinjectSegments(o, { '0.0': 'a', '1.0': 'b', '1.1': 'c' }))).not.toThrow();
  });
  it('throws when structure changes', () => {
    const o = fixtureA(); const broken = reinjectSegments(o, {}); broken.root.children.pop();
    expect(() => validateReinjection(o, broken)).toThrow(ReinjectionMismatchError);
  });
});

describe('assertFullCoverage', () => {
  it('throws when incomplete', () => { expect(() => assertFullCoverage(fixtureA(), { '0.0': 'x' })).toThrow(/missing 2 segment/); });
  it('throws on stray ids', () => { expect(() => assertFullCoverage(fixtureA(), { '0.0': 'a', '1.0': 'b', '1.1': 'c', '9.9': 'ghost' })).toThrow(/unknown segment id/); });
  it('passes on exact coverage', () => { expect(() => assertFullCoverage(fixtureA(), { '0.0': 'a', '1.0': 'b', '1.1': 'c' })).not.toThrow(); });
});

describe('buildTranslatedBody', () => {
  it('reinjects, validates, flips to ltr in one call', () => {
    const out = buildTranslatedBody(fixtureA(), { '0.0': 'Royal Army', '1.0': 'The club announced ', '1.1': 'the player injury' }, 'ltr');
    expect(out.root.direction).toBe('ltr');
    expect(out.root.children[2].value).toBe(4242);
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `pnpm vitest run src/lib/i18n/lexical-translate.test.ts`
Expected: FAIL — `Cannot find module './lexical-translate'`.

- [ ] **Step 3: Implement the engine** (`src/lib/i18n/lexical-translate.ts`)
```ts
/**
 * Lexical Body Translation Engine — extract -> (offline translate) -> reinject
 * for the localized `body` field of Articles.
 *  - Structure-preserving: only text-node `.text` is translated; all other fields
 *    (format bitmask, style, link url/fields, upload value/relationTo/id, ...) pass through.
 *  - Image-safe: upload nodes carry the Payload media id in `.value` (shared across
 *    locales) — never altered.
 *  - Deterministic path ids so reinjection is unambiguous.
 *  - Fail-closed: validators throw if a translation would change structure.
 * Out of scope: image `alt` (stored on the Media doc, shared across locales).
 */
export interface LexicalNode {
  type: string;
  version?: number;
  children?: LexicalNode[];
  direction?: 'ltr' | 'rtl' | null;
  text?: string;
  format?: number | string;
  mode?: string;
  style?: string;
  detail?: number;
  [k: string]: unknown;
}
export interface LexicalRoot {
  root: {
    type: string;
    children: LexicalNode[];
    direction: 'ltr' | 'rtl' | null;
    format: string;
    indent: number;
    version: number;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}
export interface Segment { id: string; text: string; }
export type TranslatedById = Record<string, string>;

function isTextNode(node: LexicalNode): boolean {
  return typeof node.text === 'string' && !Array.isArray(node.children);
}
function isTranslatable(node: LexicalNode): boolean {
  return isTextNode(node) && node.text!.trim().length > 0;
}
function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Depth-first; ordered { id, text } for every translatable text node. id is the
 *  dotted child-index path from root (e.g. "0.1.0"). */
export function extractSegments(body: LexicalRoot): Segment[] {
  const out: Segment[] = [];
  if (!body?.root?.children) return out;
  const walk = (nodes: LexicalNode[], prefix: string): void => {
    nodes.forEach((node, i) => {
      const id = prefix === '' ? String(i) : `${prefix}.${i}`;
      if (isTranslatable(node)) out.push({ id, text: node.text! });
      if (Array.isArray(node.children) && node.children.length > 0) walk(node.children, id);
    });
  };
  walk(body.root.children, '');
  return out;
}

/** NEW body (deep-cloned) with each translatable text replaced by id. Missing ids
 *  keep their original text. Everything non-text passes through. */
export function reinjectSegments(body: LexicalRoot, translatedById: TranslatedById): LexicalRoot {
  const clone = deepClone(body);
  if (!clone?.root?.children) return clone;
  const walk = (nodes: LexicalNode[], prefix: string): void => {
    nodes.forEach((node, i) => {
      const id = prefix === '' ? String(i) : `${prefix}.${i}`;
      if (isTranslatable(node)) {
        const t = translatedById[id];
        if (typeof t === 'string') node.text = t;
      }
      if (Array.isArray(node.children) && node.children.length > 0) walk(node.children, id);
    });
  };
  walk(clone.root.children, '');
  return clone;
}

/** NEW body with root + every node that ALREADY has `direction` set to `dir`.
 *  Never invents the field on nodes that lacked it. */
export function setDirection(body: LexicalRoot, dir: 'ltr' | 'rtl'): LexicalRoot {
  const clone = deepClone(body);
  if (!clone?.root) return clone;
  clone.root.direction = dir;
  const walk = (nodes: LexicalNode[] | undefined): void => {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes) {
      if (Object.prototype.hasOwnProperty.call(node, 'direction')) node.direction = dir;
      walk(node.children);
    }
  };
  walk(clone.root.children);
  return clone;
}

export class ReinjectionMismatchError extends Error {
  constructor(message: string) { super(message); this.name = 'ReinjectionMismatchError'; }
}
function countNodes(body: LexicalRoot): number {
  let n = 0;
  const walk = (nodes: LexicalNode[] | undefined): void => {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes) { n += 1; walk(node.children); }
  };
  walk(body?.root?.children);
  return n;
}

/** Asserts identical node count + identical segment-id set. */
export function validateReinjection(original: LexicalRoot, reinjected: LexicalRoot): void {
  const oc = countNodes(original), nc = countNodes(reinjected);
  if (oc !== nc) throw new ReinjectionMismatchError(`Node count changed: original=${oc}, reinjected=${nc}.`);
  const oi = new Set(extractSegments(original).map((s) => s.id));
  const ni = new Set(extractSegments(reinjected).map((s) => s.id));
  if (oi.size !== ni.size) throw new ReinjectionMismatchError(`Segment id count changed: ${oi.size} -> ${ni.size}.`);
  for (const id of oi) if (!ni.has(id)) throw new ReinjectionMismatchError(`Missing segment id "${id}".`);
}

/** Strict: every extracted id translated, no stray ids. */
export function assertFullCoverage(original: LexicalRoot, translatedById: TranslatedById): void {
  const ids = extractSegments(original).map((s) => s.id);
  const missing = ids.filter((id) => typeof translatedById[id] !== 'string');
  if (missing.length > 0) {
    throw new ReinjectionMismatchError(`Translation is missing ${missing.length} segment(s): ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ' …' : ''}`);
  }
  const idSet = new Set(ids);
  const stray = Object.keys(translatedById).filter((k) => !idSet.has(k));
  if (stray.length > 0) {
    throw new ReinjectionMismatchError(`Translation has ${stray.length} unknown segment id(s): ${stray.slice(0, 10).join(', ')}${stray.length > 10 ? ' …' : ''}`);
  }
}

/** Import helper: reinject -> validate -> setDirection in one call. */
export function buildTranslatedBody(original: LexicalRoot, translatedById: TranslatedById, dir: 'ltr' | 'rtl' = 'ltr'): LexicalRoot {
  const reinjected = reinjectSegments(original, translatedById);
  validateReinjection(original, reinjected);
  return setDirection(reinjected, dir);
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm vitest run src/lib/i18n/lexical-translate.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**
```bash
git add src/lib/i18n/lexical-translate.ts src/lib/i18n/lexical-translate.test.ts
git commit -m "feat(i18n): structure-safe Lexical translate engine (extract/reinject/direction)"
```

---

# PHASE C — Export / Import / Taxonomy pipeline

Scripts mirror existing conventions (`getPayload({config})`, `dotenv/config`, `--dry-run`, `--limit/--offset`, `overrideAccess:true`, idempotency). The translator never sees raw Lexical — only ordered text **segments** — so structure and images are guaranteed intact and reinjection is deterministic.

### Task C1: Work-file directory + gitignore

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Append to `.gitignore`**
```
# i18n translation work files (large, transient)
/translations/
```
- [ ] **Step 2: Commit**
```bash
git add .gitignore
git commit -m "chore(i18n): ignore translation work files"
```

### Work-file schema — `translations/pending/<id>.json`
`bodySegments` ids are the **path ids** produced by `extractSegments` (e.g. `"0.0"`, `"1.1"`), not sequential `s0/s1`. `meta` is read-only translator context (never written back).
```jsonc
{
  "schemaVersion": 1,
  "id": "1234",
  "arSlug": "الجيش-الملكي-يفوز",
  "source": { "title": "الجيش الملكي يفوز على الرجاء", "excerpt": "ملخص عربي قصير." },
  "bodySegments": [
    { "id": "0.0", "text": "الفقرة الأولى من نص المقال." },
    { "id": "1.0", "text": "جملة أخرى داخل فقرة ثانية." }
  ],
  "meta": {
    "categoryNames": ["البطولة الاحترافية 1"],
    "tagNames": ["الجيش الملكي", "الرجاء"],
    "authorName": "محمد العلوي",
    "publishedAt": "2024-03-12T18:30:00.000Z",
    "featuredImageId": 4567
  },
  "target": {
    "fr": { "title": "", "excerpt": "", "slug": "", "bodySegments": [ { "id": "0.0", "text": "" }, { "id": "1.0", "text": "" } ] },
    "en": { "title": "", "excerpt": "", "slug": "", "bodySegments": [ { "id": "0.0", "text": "" }, { "id": "1.0", "text": "" } ] }
  }
}
```

---

### Task C2: `scripts/i18n-export.ts`

**Files:**
- Create: `scripts/i18n-export.ts`

- [ ] **Step 1: Create the export script**
```ts
/**
 * MFM Sport — i18n Export (Arabic → translation work files)
 *   pnpm i18n:export                       # all published AR articles
 *   pnpm i18n:export -- --limit=10         # PILOT: first 10
 *   pnpm i18n:export -- --limit=10 --offset=10
 *   pnpm i18n:export -- --dry-run
 * Output: translations/pending/<id>.json (one per article). Skips any id already
 * present in translations/done/ so in-progress work is never clobbered.
 * Requires: DATABASE_URL, PAYLOAD_SECRET in .env
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { getPayload } from "payload";
import config from "../src/payload.config";
import { extractSegments } from "../src/lib/i18n/lexical-translate";

function parseArgs(argv: string[]) {
  let limit: number | null = null, offset = 0, dryRun = false;
  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg.startsWith("--limit=")) limit = parseInt(arg.slice(8), 10);
    else if (arg.startsWith("--offset=")) offset = parseInt(arg.slice(9), 10);
  }
  return { limit, offset, dryRun };
}
const { limit: LIMIT, offset: OFFSET, dryRun: DRY_RUN } = parseArgs(process.argv.slice(2));
const ROOT = process.cwd();
const PENDING_DIR = path.join(ROOT, "translations", "pending");
const DONE_DIR = path.join(ROOT, "translations", "done");
const SCHEMA_VERSION = 1, PAGE_SIZE = 100;
type Seg = { id: string; text: string };
const log = (m: string) => console.log(m);

function relName(name: unknown): string | null {
  if (name && typeof name === "object" && "name" in (name as any)) {
    return String((name as any).name ?? "").trim() || null;
  }
  return null;
}
function emptyTarget(segments: Seg[]) {
  return { title: "", excerpt: "", slug: "", bodySegments: segments.map((s) => ({ id: s.id, text: "" })) };
}
function doneIds(): Set<string> {
  if (!fs.existsSync(DONE_DIR)) return new Set();
  return new Set(fs.readdirSync(DONE_DIR).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")));
}

async function main() {
  log("=== MFM Sport i18n Export ===");
  log(`mode: ${DRY_RUN ? "DRY RUN" : "WRITE"}  limit: ${LIMIT ?? "none"}  offset: ${OFFSET}`);
  if (!DRY_RUN) fs.mkdirSync(PENDING_DIR, { recursive: true });

  const payload = await getPayload({ config });
  const already = doneIds();
  let written = 0, skippedDone = 0, processed = 0, globalSeen = 0, page = 1, hasMore = true;

  while (hasMore) {
    const res = await payload.find({
      collection: "articles",
      where: { status: { equals: "published" } },
      locale: "ar", sort: "publishedAt", page, limit: PAGE_SIZE, depth: 1, overrideAccess: true,
    });
    for (const art of res.docs) {
      if (globalSeen < OFFSET) { globalSeen++; continue; }
      globalSeen++;
      if (LIMIT !== null && processed >= LIMIT) { hasMore = false; break; }
      processed++;
      const id = String(art.id);
      if (already.has(id)) { skippedDone++; continue; }

      const segments: Seg[] = extractSegments((art as any).body);
      const fi = (art as any).featuredImage;
      const featuredImageId = fi && typeof fi === "object" ? fi.id : (fi ?? null);

      const fileData = {
        schemaVersion: SCHEMA_VERSION, id, arSlug: String((art as any).slug ?? ""),
        source: { title: String((art as any).title ?? ""), excerpt: String((art as any).excerpt ?? "") },
        bodySegments: segments,
        meta: {
          categoryNames: ((art as any).categories ?? []).map(relName).filter(Boolean) as string[],
          tagNames: ((art as any).tags ?? []).map(relName).filter(Boolean) as string[],
          authorName: relName((art as any).author),
          publishedAt: (art as any).publishedAt ?? null,
          featuredImageId: featuredImageId ?? null,
        },
        target: { fr: emptyTarget(segments), en: emptyTarget(segments) },
      };

      if (DRY_RUN) {
        log(`  [dry] ${id}  "${fileData.source.title}"  segments=${segments.length}`);
      } else {
        const outPath = path.join(PENDING_DIR, `${id}.json`);
        fs.writeFileSync(outPath, JSON.stringify(fileData, null, 2), "utf8");
        written++; log(`  [export] ${outPath}  (${segments.length} segments)`);
      }
    }
    hasMore = hasMore && page < res.totalPages;
    page++;
  }
  log(`\n=== Export Complete ===\nFiles written: ${written}\nSkipped (already in done/): ${skippedDone}`);
  if (DRY_RUN) log("(DRY RUN: no files written)");
  process.exit(0);
}
main().catch((err) => { console.error("Export failed:", err); process.exit(1); });
```

- [ ] **Step 2: Smoke test (dry-run, no DB writes)**

Run: `pnpm tsx scripts/i18n-export.ts --dry-run --limit=3`
Expected: prints 3 `[dry]` lines with segment counts; no files written.

- [ ] **Step 3: Commit**
```bash
git add scripts/i18n-export.ts
git commit -m "feat(i18n): article export script (Arabic -> segment work files)"
```

---

### Task C3: `scripts/i18n-import.ts` (validates, reinjects, generates unique slug, writes fr/en)

**Files:**
- Create: `scripts/i18n-import.ts`

Reconciles the two designs: the translator supplies an SEO-crafted `slug`, but the importer **normalizes it with `slugify` and guarantees per-locale uniqueness** (`-2`, `-3`, …) before writing. The importer NEVER writes the `ar` locale, and never passes `featuredImage`/media, so images are shared untouched (no re-upload).

- [ ] **Step 1: Create the import script**
```ts
/**
 * MFM Sport — i18n Import (translated work files → Payload fr/en locales)
 *   pnpm i18n:import                 # import everything in done/
 *   pnpm i18n:import -- --limit=10   # PILOT
 *   pnpm i18n:import -- --dry-run    # validate only, write nothing
 * Reinjects translated text into the ORIGINAL Arabic Lexical tree (media/upload
 * nodes pass through untouched), flips direction to ltr, writes fr+en. Never
 * writes ar. Idempotent (full per-locale overwrite). Requires DATABASE_URL, PAYLOAD_SECRET.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { getPayload } from "payload";
import config from "../src/payload.config";
import { extractSegments, reinjectSegments, setDirection } from "../src/lib/i18n/lexical-translate";
import { slugify, slugifyWithFallback } from "../src/lib/payload/slugify";

function parseArgs(argv: string[]) {
  let limit: number | null = null, offset = 0, dryRun = false;
  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg.startsWith("--limit=")) limit = parseInt(arg.slice(8), 10);
    else if (arg.startsWith("--offset=")) offset = parseInt(arg.slice(9), 10);
  }
  return { limit, offset, dryRun };
}
const { limit: LIMIT, offset: OFFSET, dryRun: DRY_RUN } = parseArgs(process.argv.slice(2));
const ROOT = process.cwd();
const DONE_DIR = path.join(ROOT, "translations", "done");
const LANGS = ["fr", "en"] as const;
type Lang = (typeof LANGS)[number];
type Seg = { id: string; text: string };
const log = (m: string) => console.log(m);

function validateFile(data: any): string[] {
  const errs: string[] = [];
  if (data?.schemaVersion !== 1) errs.push(`schemaVersion != 1`);
  if (!data?.id) errs.push(`missing id`);
  if (!Array.isArray(data?.bodySegments)) { errs.push(`missing source bodySegments`); return errs; }
  const sourceIds = data.bodySegments.map((s: Seg) => s.id);
  const sourceIdSet = new Set(sourceIds);
  for (const lang of LANGS) {
    const t = data?.target?.[lang];
    if (!t) { errs.push(`[${lang}] missing target block`); continue; }
    if (!t.title || !String(t.title).trim()) errs.push(`[${lang}] empty title`);
    if (!t.excerpt || !String(t.excerpt).trim()) errs.push(`[${lang}] empty excerpt`);
    if (!t.slug || !String(t.slug).trim()) errs.push(`[${lang}] empty slug`);
    const segs: Seg[] = Array.isArray(t.bodySegments) ? t.bodySegments : [];
    if (segs.length !== sourceIds.length) errs.push(`[${lang}] segment count ${segs.length} != source ${sourceIds.length}`);
    const seen = new Set<string>();
    for (const s of segs) {
      if (!sourceIdSet.has(s.id)) errs.push(`[${lang}] unknown segment id "${s.id}"`);
      if (seen.has(s.id)) errs.push(`[${lang}] duplicate segment id "${s.id}"`);
      seen.add(s.id);
      if (!s.text || !String(s.text).trim()) errs.push(`[${lang}] empty text for "${s.id}"`);
    }
    for (const id of sourceIds) if (!seen.has(id)) errs.push(`[${lang}] missing segment id "${id}"`);
  }
  return errs;
}

/** Per-locale unique slug: append -2, -3, ... on collision with another article. */
async function uniqueLocalizedSlug(payload: any, base: string, locale: Lang, selfId: string | number): Promise<string> {
  let candidate = base, n = 1;
  while (n < 50) {
    const clash = await payload.find({
      collection: "articles",
      where: { slug: { equals: candidate }, id: { not_equals: selfId } },
      locale, limit: 1, depth: 0, overrideAccess: true,
    });
    if (!clash.docs[0]) return candidate;
    n += 1; candidate = `${base}-${n}`;
  }
  return `${base}-${selfId}`;
}

async function main() {
  log("=== MFM Sport i18n Import ===");
  log(`mode: ${DRY_RUN ? "DRY RUN" : "WRITE"}  limit: ${LIMIT ?? "none"}  offset: ${OFFSET}`);
  if (!fs.existsSync(DONE_DIR)) { log(`No done/ directory at ${DONE_DIR}.`); process.exit(0); }

  const payload = await getPayload({ config });
  const files = fs.readdirSync(DONE_DIR).filter((f) => f.endsWith(".json")).sort()
    .slice(OFFSET, LIMIT !== null ? OFFSET + LIMIT : undefined);

  let imported = 0, invalid = 0, missing = 0;
  for (const file of files) {
    const filePath = path.join(DONE_DIR, file);
    let data: any;
    try { data = JSON.parse(fs.readFileSync(filePath, "utf8")); }
    catch (err: any) { invalid++; console.error(`  [parse-fail] ${file}: ${err.message}`); continue; }

    const problems = validateFile(data);
    if (problems.length) { invalid++; console.error(`  [invalid] ${file}:\n    - ${problems.join("\n    - ")}`); continue; }

    const id = data.id as string | number;
    const arDoc = await payload.findByID({ collection: "articles", id, locale: "ar", depth: 0, overrideAccess: true });
    if (!arDoc) { missing++; console.error(`  [missing] article id ${id} (file ${file})`); continue; }

    // Re-check the file's source ids still match the live AR body.
    const liveSegIds = extractSegments((arDoc as any).body).map((s) => s.id);
    const fileSegIds = data.bodySegments.map((s: Seg) => s.id);
    if (liveSegIds.join("|") !== fileSegIds.join("|")) {
      invalid++; console.error(`  [stale] ${file}: AR body changed since export. Re-export this article.`); continue;
    }

    for (const lang of LANGS) {
      const t = data.target[lang];
      const translatedById: Record<string, string> = {};
      for (const s of t.bodySegments as Seg[]) translatedById[s.id] = s.text;

      let body = reinjectSegments((arDoc as any).body, translatedById);
      body = setDirection(body, "ltr");

      const base = slugifyWithFallback(slugify(t.slug) || t.title, String(id));
      const slug = await uniqueLocalizedSlug(payload, base, lang, id);

      if (DRY_RUN) { log(`  [dry-update] id=${id} ${lang} slug=${slug} title="${t.title}"`); continue; }

      await payload.update({
        collection: "articles", id, locale: lang,
        data: { title: t.title, excerpt: t.excerpt, slug, body },
        overrideAccess: true,
      });
      log(`  [updated ${lang}] id=${id} slug=${slug}`);
    }
    imported++;
  }
  log(`\n=== Import Complete ===\nArticles imported: ${imported}\nInvalid/skipped: ${invalid}\nMissing: ${missing}`);
  if (DRY_RUN) log("(DRY RUN: nothing written)");
  process.exit(0);
}
main().catch((err) => { console.error("Import failed:", err); process.exit(1); });
```

- [ ] **Step 2: Commit** (functional test happens in Phase E with real translated files)
```bash
git add scripts/i18n-import.ts
git commit -m "feat(i18n): import script (reinject + unique localized slug -> fr/en)"
```

---

### Task C4: `scripts/i18n-translate-taxonomy.ts`

**Files:**
- Create: `scripts/i18n-translate-taxonomy.ts`

WP-migrated categories/tags/authors are Arabic-only → fr/en pages show Arabic chips/author via fallback. This translates the finite set (complementary to `seed.ts`'s 9-term map).

- [ ] **Step 1: Create the script**
```ts
/**
 * MFM Sport — Taxonomy & Author i18n
 *   pnpm i18n:taxonomy:export    # distinct AR names -> translations/taxonomy.json (fr/en empty)
 *   pnpm i18n:taxonomy           # filled taxonomy.json -> update fr/en
 *   pnpm i18n:taxonomy:dry
 * Keep "slug" unchanged; fill "fr"/"en" (and author bioFr/bioEn). Keyed by slug, idempotent.
 * Requires DATABASE_URL, PAYLOAD_SECRET.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { getPayload } from "payload";
import config from "../src/payload.config";

function parseArgs(argv: string[]) {
  let mode: "export" | "import" = "import", dryRun = false;
  for (const arg of argv) {
    if (arg === "--export") mode = "export";
    else if (arg === "--import") mode = "import";
    else if (arg === "--dry-run") dryRun = true;
  }
  return { mode, dryRun };
}
const { mode: MODE, dryRun: DRY_RUN } = parseArgs(process.argv.slice(2));
const FILE = path.join(process.cwd(), "translations", "taxonomy.json");
const PAGE_SIZE = 200;
const log = (m: string) => console.log(m);
type Term = { slug: string; ar: string; fr: string; en: string };
type Author = { slug: string; ar: string; fr: string; en: string; bioAr: string; bioFr: string; bioEn: string };
type TaxFile = { categories: Term[]; tags: Term[]; authors: Author[] };

async function collectTerms(payload: any, collection: "categories" | "tags"): Promise<Term[]> {
  const out: Term[] = []; let page = 1, hasMore = true;
  while (hasMore) {
    const res = await payload.find({ collection, locale: "ar", page, limit: PAGE_SIZE, depth: 0, sort: "slug", overrideAccess: true });
    for (const d of res.docs) out.push({ slug: String(d.slug), ar: String(d.name ?? ""), fr: "", en: "" });
    hasMore = page < res.totalPages; page++;
  }
  return out;
}
async function collectAuthors(payload: any): Promise<Author[]> {
  const out: Author[] = []; let page = 1, hasMore = true;
  while (hasMore) {
    const res = await payload.find({ collection: "authors", locale: "ar", page, limit: PAGE_SIZE, depth: 0, sort: "slug", overrideAccess: true });
    for (const d of res.docs) out.push({ slug: String(d.slug), ar: String(d.name ?? ""), fr: "", en: "", bioAr: String(d.bio ?? ""), bioFr: "", bioEn: "" });
    hasMore = page < res.totalPages; page++;
  }
  return out;
}
async function findIdBySlug(payload: any, collection: "categories" | "tags" | "authors", slug: string) {
  const res = await payload.find({ collection, where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true });
  return res.docs[0]?.id ?? null;
}
async function runExport(payload: any) {
  const data: TaxFile = { categories: await collectTerms(payload, "categories"), tags: await collectTerms(payload, "tags"), authors: await collectAuthors(payload) };
  if (DRY_RUN) { log(`  [dry] categories=${data.categories.length} tags=${data.tags.length} authors=${data.authors.length}`); return; }
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), "utf8");
  log(`  [export] ${FILE} (categories=${data.categories.length} tags=${data.tags.length} authors=${data.authors.length})`);
}
async function runImport(payload: any) {
  if (!fs.existsSync(FILE)) { console.error(`  [error] ${FILE} not found. Run i18n:taxonomy:export first.`); process.exit(1); }
  const data: TaxFile = JSON.parse(fs.readFileSync(FILE, "utf8"));
  let updated = 0, skipped = 0;
  for (const collection of ["categories", "tags"] as const) {
    for (const term of data[collection]) {
      if (!term.fr?.trim() || !term.en?.trim()) { skipped++; continue; }
      const id = await findIdBySlug(payload, collection, term.slug);
      if (!id) { skipped++; console.error(`  [missing] ${collection} "${term.slug}"`); continue; }
      if (DRY_RUN) { log(`  [dry-update] ${collection} ${term.slug}: fr="${term.fr}" en="${term.en}"`); continue; }
      await payload.update({ collection, id, data: { name: term.fr }, locale: "fr", overrideAccess: true });
      await payload.update({ collection, id, data: { name: term.en }, locale: "en", overrideAccess: true });
      updated++; log(`  [updated fr+en] ${collection} ${term.slug}`);
    }
  }
  for (const a of data.authors) {
    if (!a.fr?.trim() || !a.en?.trim()) { skipped++; continue; }
    const id = await findIdBySlug(payload, "authors", a.slug);
    if (!id) { skipped++; console.error(`  [missing] authors "${a.slug}"`); continue; }
    if (DRY_RUN) { log(`  [dry-update] authors ${a.slug}: fr="${a.fr}" en="${a.en}"`); continue; }
    await payload.update({ collection: "authors", id, data: { name: a.fr, bio: a.bioFr || undefined }, locale: "fr", overrideAccess: true });
    await payload.update({ collection: "authors", id, data: { name: a.en, bio: a.bioEn || undefined }, locale: "en", overrideAccess: true });
    updated++; log(`  [updated fr+en] authors ${a.slug}`);
  }
  log(`\n=== Taxonomy Import Complete ===\nUpdated: ${updated}  Skipped: ${skipped}`);
  if (DRY_RUN) log("(DRY RUN: nothing written)");
}
async function main() {
  log(`=== MFM Sport Taxonomy i18n ===  mode: ${MODE} ${DRY_RUN ? "(DRY RUN)" : ""}`);
  const payload = await getPayload({ config });
  if (MODE === "export") await runExport(payload); else await runImport(payload);
  process.exit(0);
}
main().catch((err) => { console.error("Taxonomy i18n failed:", err); process.exit(1); });
```

- [ ] **Step 2: Smoke test export**

Run: `pnpm tsx scripts/i18n-translate-taxonomy.ts --export --dry-run`
Expected: prints counts of categories/tags/authors; no file written.

- [ ] **Step 3: Commit**
```bash
git add scripts/i18n-translate-taxonomy.ts
git commit -m "feat(i18n): taxonomy/author translation script"
```

---

### Task C5: Add npm scripts

**Files:**
- Modify: `package.json` (inside `"scripts"`, after the existing `sync:videos:dry` line)

- [ ] **Step 1: Add**
```jsonc
"i18n:export": "tsx scripts/i18n-export.ts",
"i18n:export:dry": "tsx scripts/i18n-export.ts --dry-run",
"i18n:import": "tsx scripts/i18n-import.ts",
"i18n:import:dry": "tsx scripts/i18n-import.ts --dry-run",
"i18n:taxonomy:export": "tsx scripts/i18n-translate-taxonomy.ts --export",
"i18n:taxonomy": "tsx scripts/i18n-translate-taxonomy.ts --import",
"i18n:taxonomy:dry": "tsx scripts/i18n-translate-taxonomy.ts --import --dry-run",
```
Pass extra flags via `--`, e.g. `pnpm i18n:export -- --limit=10 --offset=10`.

- [ ] **Step 2: Commit**
```bash
git add package.json
git commit -m "chore(i18n): add i18n pipeline npm scripts"
```

---

# PHASE D — SEO: hreflang, canonical, localized sitemap

Safe to merge before any translation exists — the `typeof raw === "object"` guards make the code correct both before and after slugs are localized, and the **fallback rule** only advertises an fr/en alternate once that locale genuinely has its own slug.

### Task D1: `metadataBase` in the frontend root layout

**Files:**
- Modify: `src/app/(frontend)/layout.tsx:24-27`

Required so root-relative canonical/alternate/OG URLs absolutize (otherwise resolve against localhost).

- [ ] **Step 1: Replace the metadata export**
```ts
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://mfmsport.ma"),
  title: "MFM Sport",
  description: "Moroccan Football News Portal",
};
```
- [ ] **Step 2: Commit**
```bash
git add "src/app/(frontend)/layout.tsx"
git commit -m "feat(seo): set metadataBase for absolute canonical/alternate URLs"
```

---

### Task D2: hreflang + canonical + OG locale in article `generateMetadata`

**Files:**
- Modify: `src/app/(frontend)/[locale]/articles/[slug]/page.tsx` (imports + `generateMetadata`)

Uses `getArticleLocalizedSlugs` (added in A5). Advertises an alternate only when the locale is genuinely translated (`isTranslated = l === 'ar' || slugs[l] !== slugs.ar`), preventing Arabic-fallback pages from being indexed as duplicate fr/en content.

- [ ] **Step 1: Ensure imports** (top of file — `getArticleLocalizedSlugs` already added in A5 Step 3; add `decodeSlug`)
```ts
import { decodeSlug } from "@/lib/payload/slug";
```

- [ ] **Step 2: Replace `generateMetadata` (lines 26-49) entirely**
```ts
const HREFLANG: Record<Config["locale"], string> = { ar: "ar-MA", fr: "fr", en: "en" };
const OG_LOCALE: Record<Config["locale"], string> = { ar: "ar_MA", fr: "fr_FR", en: "en_US" };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const loc = locale as Config["locale"];

  const [article, localized] = await Promise.all([
    getArticleBySlug(slug, loc),
    getArticleLocalizedSlugs(slug, loc),
  ]);
  if (!article) return { title: "Not Found" };

  const heroImageUrl = getArticleHeroUrl(article, "hero");
  const category = article.categories?.[0];
  const categoryName = category && typeof category === "object" ? category.name : "";
  const ogImage =
    heroImageUrl ||
    `/api/og?title=${encodeURIComponent(article.title)}&category=${encodeURIComponent(categoryName)}`;

  const decoded = decodeSlug(slug);
  const slugs = localized?.slugs ?? { ar: decoded, fr: decoded, en: decoded };
  const pathFor = (l: Config["locale"]) => `/${l}/articles/${encodeURIComponent(slugs[l])}`;
  const canonical = pathFor(loc);

  const languages: Record<string, string> = {};
  for (const l of ["ar", "fr", "en"] as const) {
    const isTranslated = l === "ar" || slugs[l] !== slugs.ar;
    if (l === loc || isTranslated) languages[HREFLANG[l]] = pathFor(l);
  }
  languages["x-default"] = pathFor("ar");

  const alternateLocale = (["ar", "fr", "en"] as const)
    .filter((l) => l !== loc && (l === "ar" || slugs[l] !== slugs.ar))
    .map((l) => OG_LOCALE[l]);

  return {
    title: `${article.title} | MFM Sport`,
    description: article.excerpt || undefined,
    alternates: { canonical, languages },
    openGraph: {
      type: "article", url: canonical, siteName: "MFM Sport",
      locale: OG_LOCALE[loc], alternateLocale,
      title: article.title, description: article.excerpt || undefined,
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title: article.title, description: article.excerpt || undefined, images: [ogImage] },
  };
}
```

- [ ] **Step 3: Build check**

Run: `pnpm build`
Expected: compiles with no type errors in the article route.

- [ ] **Step 4: Commit**
```bash
git add "src/app/(frontend)/[locale]/articles/[slug]/page.tsx"
git commit -m "feat(seo): hreflang + canonical + OG locale on article pages"
```

---

### Task D3: Localized article slugs in the sitemap

**Files:**
- Modify: `src/app/sitemap.ts:27-45` (articles block only)

- [ ] **Step 1: Replace the Articles block (lines 27-45)**
```ts
  // Articles — fetch each locale so every URL uses that locale's own slug.
  // Skip a locale whose slug hasn't been translated yet (NULL).
  for (const locale of LOCALES) {
    const articles = await payload.find({
      collection: "articles",
      where: { status: { equals: "published" } },
      locale: locale as "ar" | "fr" | "en",
      limit: 50000,
      depth: 0,
      select: { slug: true, updatedAt: true },
      sort: "-publishedAt",
    });
    for (const article of articles.docs) {
      if (!article.slug) continue;
      entries.push({
        url: `${SITE_URL}/${locale}/articles/${encodeURIComponent(article.slug)}`,
        lastModified: new Date(article.updatedAt),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  }
```
(Category/tag/author/competition/club loops stay unchanged — their slugs are not localized this milestone.)

- [ ] **Step 2: Verify**

With `pnpm dev`: `curl.exe -s "http://localhost:3000/sitemap.xml" | Select-String "/articles/"`
Expected: today (pre-translation) only `/ar/articles/...` entries; fr/en appear automatically as they get translated.

- [ ] **Step 3: Commit**
```bash
git add src/app/sitemap.ts
git commit -m "feat(seo): sitemap emits per-locale article slugs"
```

---

### Task D4 (optional): Slug-aware LanguageSwitcher

**Files:**
- Modify: `src/components/layout/LanguageSwitcher.tsx`

**The resolver from A5 already makes the switcher functionally correct** — switching to `/fr/articles/<arabic-slug>` 301-redirects to the fr slug (or serves Arabic fallback if untranslated). This task only removes the extra redirect hop on article pages by navigating straight to the sibling slug. Implement only if the extra hop is judged worth it; otherwise skip.

- [ ] **Step 1: Accept an optional per-locale slug map and prefer it on article routes**
```tsx
type Props = { locale: string; localizedSlugs?: Partial<Record<Locale, string>> };

export function LanguageSwitcher({ locale, localizedSlugs }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  function switchLocale(newLocale: Locale) {
    const segments = pathname.split("/");
    // On an article route with a known sibling slug, swap the slug too.
    if (localizedSlugs?.[newLocale] && segments[2] === "articles" && segments[3]) {
      segments[1] = newLocale;
      segments[3] = encodeURIComponent(localizedSlugs[newLocale]!);
      router.push(segments.join("/"));
      return;
    }
    segments[1] = newLocale;
    router.push(segments.join("/"));
  }
  // ...unchanged render...
}
```
(Wiring the prop from the article page requires passing the slug map down through `Header`; defer the wiring unless prioritized — the resolver covers correctness.)

- [ ] **Step 2: Commit (if implemented)**
```bash
git add src/components/layout/LanguageSwitcher.tsx
git commit -m "feat(i18n): slug-aware language switch on article routes"
```

---

# PHASE E — Translation execution (pilot → bulk)

This is where the actual French/English content is produced and goes live. The translating is done **in a Claude Code session** reading `translations/pending/*.json` and writing `translations/done/*.json`.

### Translator instructions (the rules every translation must follow)
When filling a work file's `target.fr` and `target.en`:
1. **Translate meaning, not words.** Natural, fluent French / English in a sports-news register.
2. **Football/sport terminology** correct per language (e.g. "match nul", "draw"; "but", "goal"). Keep proper nouns (club/player/competition names) in their conventional Latin form for fr/en.
3. **`bodySegments`:** translate each segment's `text`; **keep every `id` exactly**; never add, remove, reorder, split, or merge segments; never leave a segment empty (whitespace counts as empty).
4. **`title` + `excerpt`:** translate and **SEO-optimize** — natural keyword phrasing, `excerpt` ≈ 120–160 chars (it is the meta description).
5. **`slug`:** a short, keyword-rich, ASCII, lowercase-hyphen slug per language (e.g. `royal-army-beats-raja`, `larmee-royale-bat-le-raja`). The importer will normalize + de-duplicate it, but provide a clean human one.
6. Leave `source`, `meta`, `schemaVersion`, `id`, `arSlug`, `bodySegments[].id` untouched. Move the finished file from `translations/pending/` to `translations/done/`.

### Task E1: PILOT — translate, verify, import ~10 articles

**Files:** `translations/pending/*.json` → `translations/done/*.json` (work files, gitignored)

- [ ] **Step 1: Export the pilot set**

Run: `pnpm i18n:export -- --limit=10`
Expected: `translations/pending/<id>.json` for ~10 articles.

- [ ] **Step 2: Translate in a Claude Code session**

Read each `translations/pending/<id>.json`, fill `target.fr`/`target.en` per the Translator instructions, write to `translations/done/<id>.json`.

- [ ] **Step 3: Dry-run import (the quality gate)**

Run: `pnpm i18n:import -- --dry-run`
Expected: every file prints `[dry-update]` for fr and en; **zero** `[invalid]`/`[stale]`/`[parse-fail]`. Any error → fix the work file, repeat. Do not proceed until clean.

- [ ] **Step 4: Apply the pilot import**

Run: `pnpm i18n:import`
Expected: `Articles imported: ~10`, `Invalid/skipped: 0`, `Missing: 0`.

- [ ] **Step 5: DB assertion — fr/en written, ar untouched** (`mcp__supabase__execute_sql`)
```sql
SELECT _parent_id, _locale, slug, left(title,40), (title IS NOT NULL) AS has_title
FROM articles_locales
WHERE _parent_id IN (<pilot ids>) AND _locale IN ('fr','en')
ORDER BY _parent_id, _locale;
```
Expected: every pilot id has fr+en rows with non-null title and a distinct localized slug; re-run the A3 ar-slug snapshot and confirm Arabic slugs are byte-for-byte unchanged.

- [ ] **Step 6: End-to-end render verification** — run the full **Verification** checklist below (Phases 3a–3f) against `pnpm dev` for 2–3 pilot articles. All must pass before bulk.

- [ ] **Step 7: Commit the milestone marker** (work files are gitignored — commit only code/docs already done; tag the pilot as verified in the plan checkboxes).

### Task E2: Translate the taxonomy

- [ ] **Step 1: Export** — `pnpm i18n:taxonomy:export` → `translations/taxonomy.json`
- [ ] **Step 2: Translate** every `fr`/`en` name (+ author `bioFr`/`bioEn`) in the Claude Code session; keep `slug` unchanged.
- [ ] **Step 3: Dry-run** — `pnpm i18n:taxonomy:dry` → zero `[missing]`.
- [ ] **Step 4: Import** — `pnpm i18n:taxonomy`.
- [ ] **Step 5: Verify** a pilot fr article shows French category/tag chips and a French author name (Verification 3a).

### Task E3: BULK — translate and import the remaining ~190

- [ ] **Step 1: Export the rest** — `pnpm i18n:export` (skips ids already in `done/`).
- [ ] **Step 2: Translate in batches** (e.g. 20–30 per Claude Code pass) per the Translator instructions; move each finished file to `done/`.
- [ ] **Step 3: Dry-run** — `pnpm i18n:import -- --dry-run`; resolve all errors.
- [ ] **Step 4: Import in chunks** — `pnpm i18n:import -- --limit=30 --offset=0`, then `--offset=30`, etc. (or one full `pnpm i18n:import`).
- [ ] **Step 5: Re-run the Verification checklist** on a random sample across locales; check the sitemap now lists fr/en URLs; spot-check several `/fr` and `/en` articles render fully translated.

### Task E4 (optional, after bulk): enforce slug NOT NULL

- [ ] **Step 1:** Once every published article has fr+en slugs, generate a follow-up migration that runs `ALTER TABLE "articles_locales" ALTER COLUMN "slug" SET NOT NULL;` (only if a `SELECT count(*) FROM articles_locales WHERE slug IS NULL` returns 0). Otherwise leave nullable — Payload's field `required` already guards new writes.

---

## Verification (end-to-end)

Run after the **pilot** import (Task E1 Step 6) and again on a sample after **bulk**. `<ar-slug>`/`<fr-slug>`/`<en-slug>` = a pilot article's three localized slugs.

**Phase 0 — baseline (already captured in Pre-flight + A3):** zero NULL `ar` slugs; pilot Arabic slugs recorded.

**Phase 1 — dry-run gate:** `pnpm i18n:import -- --dry-run` prints only `[dry-update]`, zero errors. This is the blocking gate (because `status` is shared — no per-language draft, so quality is gated here, not in Payload).

**Phase 2 — DB state:** the E1 Step 5 SQL — fr/en rows present with distinct slugs; ar rows unchanged.

**Phase 3 — render (`pnpm dev`, http://localhost:3000):**
- **3a French text + body integrity** — Playwright `browser_navigate` `/fr/articles/<fr-slug>` + `browser_snapshot`: `<h1>` French, body is French prose (no raw Lexical JSON, no empty `<article>`), category chips + author name French. `browser_console_messages`: no errors (esp. no "Cannot read properties of undefined (reading 'children')").
- **3b Layout + images** — `browser_network_requests` (images): featured + every in-body image returns 200; in-body `<img>` count == upload-node count in the AR source. `browser_take_screenshot` fullPage for visual review.
- **3c dir flip + font** — `browser_evaluate`:
  ```js
  () => { const el = document.querySelector('div[lang]'); const cs = getComputedStyle(el);
    return { lang: el.getAttribute('lang'), dir: el.getAttribute('dir'), cls: el.className, font: cs.fontFamily }; }
  ```
  Expected fr: `lang:"fr"`, `dir:"ltr"`, className has `font-sans` (not `font-arabic`). Repeat: ar → `rtl`/`font-arabic`, en → `ltr`/`font-sans`.
- **3d hreflang + meta** —
  ```bash
  curl.exe -s "http://localhost:3000/fr/articles/<fr-slug>" | Select-String 'rel="alternate"'
  ```
  Expected: distinct hreflang links — `ar-MA`→ar-slug, `fr`→fr-slug, `en`→en-slug, `x-default`→ar-slug. FAIL if any href reuses the same slug across locales. Then confirm each resolves 200 and `<title>`/`og:title`/`og:locale` are French.
- **3e legacy Arabic links** — `/ar/articles/<ar-slug>` → 200; `/fr/articles/<ar-slug>` → 301 to `/fr/articles/<fr-slug>`; a known legacy WP path via `/api/redirects` still 301s to `/ar/articles/<ar-slug>`.
- **3f untranslated fallback** — a non-pilot article under `/fr/articles/<its-ar-slug>` → 200 serving Arabic (fallback), no 500; `/fr/articles` list → click a card → lands on 200, never 404.

**Phase 4 — build + prod parity:** `pnpm build` → 0 errors. After `pnpm start`, `curl sitemap.xml` shows fr/en using localized slugs (post-translation).

**Phase 5 — staging:** deploy preview (Vercel MCP `get_deployment`/`get_deployment_build_logs` green), re-run 3a–3f against the preview URL, then prod alias `mfm-sport-kappa.vercel.app` (hreflang + redirect curls are highest-signal on prod).

**Automated regression (add as time permits):** (1) body-shape validator unit test; (2) upload-node parity (`countUploadNodes(ar) === fr === en` + per-index `value`/`relationTo`); (3) LanguageSwitcher slug-aware test (only if D4 implemented).

---

## Risk register (top items)

| # | Failure mode | Guardrail (phase that catches it) |
|---|---|---|
| R1 | Slug migration drops/doesn't-backfill Arabic slugs → mass 404 | Neon backup (Pre-flight); hand-edited backfill `up()` (A2); A3 asserts 0 NULL ar slugs + 200 on an ar URL **before** any translation |
| R2 | Import overwrites the `ar` slug | Import writes only fr/en, never ar (C3); E1 Step 5 re-checks ar unchanged; 3e legacy curl |
| R3 | Language switch 404 on articles | A5 resolver 301s stale slugs (covers it); D4 optional removes the hop |
| R4 | Lexical body corruption | engine validators + import `validateFile`/`[stale]` gate (C3); 3a console check; B1 tests |
| R5 | Dropped/reordered image nodes in fr/en | engine reinjects only text, passes uploads through (B1); 3b `<img>`-count check |
| R6 | RTL leftovers on fr/en | `setDirection('ltr')` in import (C3); 3c dir check |
| R7 | Untranslated taxonomy → Arabic chips on fr/en | Task E2; 3a chip/author check |
| R8/R9 | hreflang/sitemap reuse one slug across locales | per-locale fetch (D2/D3); 3d distinct-slug curl; Phase 4 sitemap grep |
| R11/R12 | Partial import live / slug collision | per-article transactional update + `uniqueLocalizedSlug` (C3); pilot-first; dry-run gate |

## Out of scope (follow-up backlog)
- `NewsArticle` JSON-LD + breadcrumb schema (article pages emit none today).
- Localized **category/tag/author page slugs** (only their names translate this milestone).
- Localized search ranking, per-locale RSS, Arabic OG-image font.
- **Future-article workflow** (biggest open product question): how newly authored Arabic articles get fr/en. Given shared `status`, options are a "don't publish until translated" convention or a new non-localized `translationStatus` field. Decide post-launch.
- Move `lang`/`dir` from the `<div>` to the root `<html>` for strict a11y/SEO.
