# WordPress Archive Import — Runbook

Operational steps for the 36,992-post backfill. Read `wp-corpus-analysis.md` first for what's in the export and why the tiering is what it is.

---

## Step 1 — Apply the schema change (must happen BEFORE deploying)

The code and this DDL are coupled: `sitemap.ts` and `news-sitemap.xml` select `seo_tier`, so **the build fails with `column articles.seo_tier does not exist` until this runs.** Apply it, then deploy.

`src/migrations/` is gitignored in this repo, so the generated migration file does not travel with the branch. The statements are reproduced here so they are recoverable.

### Do not run `payload migrate` on this project

It prompts:

> It looks like you've run Payload in dev mode, meaning you've dynamically pushed changes to your database. If you'd like to run migrations, **data loss will occur**. Would you like to proceed?

That warning is generic — Payload raises it whenever it detects dev-push drift, which this database has. It is not specific to this change. But answering "yes" hands Payload permission to reconcile the whole schema against its snapshot, and that snapshot is known to be stale on this project (it has previously re-emitted already-applied ads columns). **Don't take that risk for three nullable columns.**

### Apply this instead

Purely additive: one enum type, three nullable columns, three indexes. No `DROP`, no `ALTER COLUMN`, no data rewrite. Safe to run against the live database — existing queries don't reference these columns, so the running site is unaffected.

```sql
BEGIN;

CREATE TYPE "public"."enum_articles_seo_tier"
  AS ENUM('editorial', 'archive-full', 'archive-brief');

ALTER TABLE "articles" ADD COLUMN "wp_post_id"  numeric;
ALTER TABLE "articles" ADD COLUMN "legacy_slug" varchar;
ALTER TABLE "articles" ADD COLUMN "seo_tier"
  "enum_articles_seo_tier" DEFAULT 'editorial';

CREATE UNIQUE INDEX "articles_wp_post_id_idx"  ON "articles" USING btree ("wp_post_id");
CREATE INDEX        "articles_legacy_slug_idx" ON "articles" USING btree ("legacy_slug");
CREATE INDEX        "articles_seo_tier_idx"    ON "articles" USING btree ("seo_tier");

-- Keep Payload's bookkeeping consistent so it doesn't try to re-apply this.
INSERT INTO payload_migrations (name, batch, updated_at, created_at)
VALUES ('20260728_120642_add_wp_archive_fields', 8, now(), now());

COMMIT;
```

The `UNIQUE` index on `wp_post_id` is load-bearing, not decoration — it is what makes the import idempotent and resumable. Postgres allows unlimited NULLs under a unique index, so the ~400 existing articles are unaffected.

### Verify

```sql
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'articles'
   AND column_name IN ('wp_post_id','legacy_slug','seo_tier');
-- expect 3 rows

SELECT seo_tier, count(*) FROM articles GROUP BY seo_tier;
-- expect every existing row = 'editorial' (the column default)
```

Existing articles defaulting to `editorial` is the intended behaviour: native CMS articles are always indexable, and only imported rows carry an archive tier.

### Rollback

```sql
BEGIN;
DROP INDEX "articles_wp_post_id_idx";
DROP INDEX "articles_legacy_slug_idx";
DROP INDEX "articles_seo_tier_idx";
ALTER TABLE "articles" DROP COLUMN "wp_post_id";
ALTER TABLE "articles" DROP COLUMN "legacy_slug";
ALTER TABLE "articles" DROP COLUMN "seo_tier";
DROP TYPE "public"."enum_articles_seo_tier";
DELETE FROM payload_migrations WHERE name = '20260728_120642_add_wp_archive_fields';
COMMIT;
```

---

## Step 2 — Dry run

Writes nothing. Confirms parsing, tier assignment and slug derivation.

```bash
pnpm import:wp:dry                       # 20 posts
pnpm import:wp -- --dry-run --limit=200  # a wider look
```

Each line reports the post ID, assigned tier, body length and slug. Check that
tiers look sane and that Arabic slugs decode rather than staying percent-encoded.

---

## Step 3 — Import in batches

The import is resumable and idempotent — `wpPostId` is unique, so re-running skips what already landed. There is no penalty for stopping and restarting, and no need to finish in one pass.

```bash
pnpm import:wp -- --min-year=2024              # ~8,600 — the released tier first
pnpm import:wp -- --min-year=2023 --limit=5000
pnpm import:wp                                  # the remainder
```

Start with `--min-year=2024`: those are the articles Stage 1 actually releases into the index, so they are the batch whose effect you can measure in Search Console. Everything else can land afterwards at any pace, since it imports as `noindex` regardless.

`--concurrency` defaults to 4. Raise it only if Neon is comfortable; the bottleneck is database round-trips, not parsing.

### Expected shape

| | |
|---|---|
| Published posts scanned | 36,992 |
| `archive-full` (≥500 chars) | 26,982 |
| `archive-brief` (<500 chars) | 10,006 |
| Genuinely empty | 4 |
| Redirects created | one per imported post |

---

## Step 4 — Release indexation in stages

Everything is imported and every legacy URL 301s from day one. What is staged is only whether Google is invited to index a page.

Edit `RELEASED_ARCHIVE_YEARS` in `src/lib/seo/indexation.ts` and deploy:

```
Stage 1 (now)  2024, 2025, 2026     ~8,600
Stage 2        + 2023               ~6,600
Stage 3        + 2022               ~9,900
Stage 4        + 2021 and earlier   ~11,900
```

Between stages, wait 2–3 weeks and check Search Console:

- **Impressions rising** on the released cohort → release the next.
- **Impressions flat and "Crawled – currently not indexed" climbing** → Google is rejecting the batch. Stop and reassess before adding more.
- **Sitewide impressions falling** on articles that were already ranking → the expansion is dragging quality signals down. Roll the config back; no data changes, no re-import.

`archive-brief` stays held via `RELEASE_ARCHIVE_BRIEF = false`. Promote it only if Search Console shows those pages earning impressions on their own.

---

## Step 5 — Google Publisher Center

Only after the redirect map is live and 404s have dropped. Submit `/news-sitemap.xml`.

Before submitting, confirm the archive cannot leak into it:

```bash
curl -s https://www.mfmsport.ma/news-sitemap.xml | grep -c "<url>"
# should be a couple of dozen — one to two days of publishing, never thousands
```

The feed has two independent guards: a 48-hour rolling window, and a hard publish-date floor (`NEVER_BEFORE`) that excludes anything pre-dating the Arabic-only relaunch. The window alone is clock arithmetic and a timezone bug would defeat it; the floor holds regardless.

---

## Known gaps

- **Legacy images are gone.** All 43,584 attachment URLs 404, and the WordPress REST API no longer responds. Bodies import with `<img>`/`<figure>` stripped. If a `wp-content/uploads` backup is ever located, images can be backfilled against `legacySlug` without re-importing text.
- **Import ordering is not link-prioritised.** Ideally the URLs with the most referring domains import first, so equity starts flowing soonest. That needs an Ahrefs export; without it the order is simply chronological.
- **Category consolidation is still pending.** The archive references the old taxonomy, which includes the duplicate and trailing-space slugs documented in `seo-recon-findings.md` §8. Consolidating after import means fewer, larger merges — but it must happen before those category hubs are worth linking to.

## Admin panel

### Articles list lost its title column (2026-07-29)

`payload_preferences` key `collection-articles` had `{"active": false, "accessor": "title"}`.
A saved column preference permanently overrides `admin.defaultColumns`, so this is a data
fix, not a code fix. If it recurs, someone unticked Title in the list's Columns picker.

The repair is to delete the row rather than patch the one entry, because preferences are
**per user**: patching fixes whoever's row you patched and leaves every other account in
whatever state it is in. Deleting is idempotent and drops each user back to
`defaultColumns` in `src/collections/Articles.ts`.

```sql
DELETE FROM payload_preferences WHERE key = 'collection-articles';
```

The key is `collection-articles` — **not** `collection-articles-list`. Confirm against the
live table before running; a wrong key makes this a silent no-op that looks like it worked:

```sql
SELECT key, count(*) FROM payload_preferences GROUP BY key ORDER BY key;
```

The trade is that the user also loses their saved sort and page size for that list. That
is accepted — a list you cannot identify rows in is worse than a reset sort order.

A verified database row is a **proxy**. The artefact is the rendered page: confirm the
title column by loading `/admin/collections/articles` in an authenticated browser.
