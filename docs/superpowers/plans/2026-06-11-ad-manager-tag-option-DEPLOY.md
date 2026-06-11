# Ad-Manager Tag Option — Schema Deploy Runbook

**Applies to:** the `ads` table. Adds the `type` (image|tag) + `embed_code` columns and makes `image_id` nullable, so an ad can be an ad-manager embed snippet instead of an uploaded image.

**Why this is a manual step:** `src/payload.config.ts` sets `push: false`, so schema changes do **not** auto-apply in dev or prod. They are applied through migrations / direct SQL. Migration files live under `src/migrations/` which is **gitignored** (local-only, by repo convention), so the migration ships as raw SQL in this committed runbook rather than as a tracked file.

**Safety:** This change is **backward-compatible**. Existing image ads are untouched — `type` defaults to `'image'`, `embed_code` is nullable, and only the NOT NULL constraint on `image_id` is relaxed. No data is modified or deleted.

> ⚠️ Per the team's setup, the local `DATABASE_URL` points at the **production** Neon database. Apply this when you intend to update production.

---

## What gets applied (the SQL)

```sql
CREATE TYPE "public"."enum_ads_type" AS ENUM('image', 'tag');
ALTER TABLE "ads" ADD COLUMN "type" "enum_ads_type" DEFAULT 'image' NOT NULL;
ALTER TABLE "ads" ADD COLUMN "embed_code" varchar;
ALTER TABLE "ads" ALTER COLUMN "image_id" DROP NOT NULL;
```

This is exactly what the gitignored migration `src/migrations/20260611_000000_ads_tag.ts` runs.

---

## Option A — Payload migrate (uses the local migration file)

Run from this machine (where `src/migrations/20260611_000000_ads_tag.ts` exists on disk):

```bash
pnpm payload migrate
```

Payload applies any pending migrations from `src/migrations/index.ts` — here, just `20260611_000000_ads_tag` — and records it in the `payload_migrations` table. Idempotent: re-running does nothing once applied.

## Option B — Direct SQL via Neon (matches how `article-sidebar` was added)

Paste the four statements from **What gets applied** into the Neon SQL editor (or the Neon MCP `run_sql_transaction`) against the target branch/database. Use this if you prefer not to depend on the local migration file.

---

## Verify it worked

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'ads' AND column_name IN ('type', 'embed_code', 'image_id')
ORDER BY column_name;
```

Expected:
- `type` → `USER-DEFINED` (enum_ads_type), `NO`, default `'image'::enum_ads_type`
- `embed_code` → `character varying`, `YES`, null default
- `image_id` → `integer`, `YES` (now nullable)

---

## After applying — finish the admin verification

These are Task 6, Steps 4–5 from the plan ([2026-06-11-ad-manager-tag-option.md](2026-06-11-ad-manager-tag-option.md)):

1. `pnpm dev` → open the Payload admin → **Ads** → **Create New**.
2. Confirm a **Type** dropdown ("Image upload" / "Ad-manager tag").
3. Choose **Ad-manager tag** → the Image upload hides, an **Embed code** box appears.
4. Save with an empty embed code → expect the validation error.
5. Paste a visible test snippet, set Placement = "Home — Top banner", Active = on, Save:
   ```html
   <div style="width:100%;height:90px;background:#16a34a;color:#fff;display:flex;align-items:center;justify-content:center;font:700 16px sans-serif">TAG AD OK</div>
   ```
6. Open the homepage → the top-banner slot shows the green "TAG AD OK" block (no carousel).
7. Confirm the other image-based placements still render and rotate as before.

---

## Rollback (only if needed)

```sql
-- Delete any tag ads first, or the NOT NULL re-add will fail.
DELETE FROM "ads" WHERE "type" = 'tag';
ALTER TABLE "ads" ALTER COLUMN "image_id" SET NOT NULL;
ALTER TABLE "ads" DROP COLUMN "embed_code";
ALTER TABLE "ads" DROP COLUMN "type";
DROP TYPE "public"."enum_ads_type";
```
