# WP Migration — Next Session Handoff

**Created:** 2026-04-27
**Goal:** Migrate **200 articles** from live WordPress (`mfmsport.ma`) into Payload/Neon. Capped at 200 — Neon storage cannot hold the full ~41k.

## Pre-flight (do these BEFORE running anything)

1. **Add `BLOB_READ_WRITE_TOKEN` to `.env`.** It's currently missing. The script throws on line 139-141 of [scripts/migrate-wp.ts](scripts/migrate-wp.ts#L139-L141) if absent for any non-dry-run.
   - Get one from Vercel → Storage → Blob → `.env.local` snippet.
   - Without it, images would hit local disk (not viable).

2. **Confirm scope assumption.** Migration source is the **live WP REST API** at `WP_API_URL`, NOT the `mfmsport.WordPress.2026-04-24.xml` archive in repo root. "First 200" = 200 most recent published posts on the live site at run time. If you need a curated set, stop and rework the script.

3. **Stop the dev server** if running. Migration spins up Payload locally and may collide on DB connections.

## Steps

### Step 1 — Dry run (no writes, ~30s)

```bash
pnpm migrate:wp:sample
```

This is `--dry-run --limit=10`. Verifies:
- WP API reachable
- Categories/tags/authors fetched and parsed
- 10 articles parsed, HTML→Lexical conversion works
- No DB writes, no Blob uploads

**Expected:** counters at end show `articlesCreated: 0` (dry run) but parsing stats look sensible. Zero failures. If image count is way higher than expected per article, flag it before the live run — every body image becomes a Blob upload + Media row.

### Step 2 — Live run (200 articles)

Only after Step 1 looks clean AND `BLOB_READ_WRITE_TOKEN` is set:

```bash
pnpm migrate:wp -- --limit=200
```

What it does:
- Migrates all categories, tags, authors first (idempotent, skip-by-slug)
- Migrates 200 articles, each: featured image + every `<img>` in body → Vercel Blob → Media row → Lexical body
- Creates redirects from old WP slugs

**Idempotent.** Re-running with the same limit skips already-imported articles by slug, and skips already-uploaded media by `wpUrl`. Safe to interrupt and resume.

**Expected duration:** rough estimate 15–40 min depending on image count (3 articles concurrent, body images uploaded inline).

### Step 3 — Verify

- `/admin` → Articles → confirm count ≈ 200
- Spot-check 2–3 articles in the frontend: body renders, featured image loads, in-body images load
- Check Vercel Blob dashboard for upload count
- Check Neon storage % — should be well within plan

## Rollback (if something looks wrong)

The script has no built-in rollback. Options:
- **Soft:** delete imported articles via `/admin` (slow, manual)
- **Hard:** drop and re-run the initial migration (`src/migrations/20260423_125413_initial.ts`), then re-seed structural + preview content. Loses everything from this session's import. Only do this on a clean staging DB — destructive.

## What comes after migration succeeds

(From `project_status.md`, unchanged path to launch:)
1. Add prod env vars: `BLOB_READ_WRITE_TOKEN`, `NEXT_PUBLIC_SENTRY_DSN`
2. Push to GitHub + Vercel import
3. DNS for mfmsport.ma + Resend domain verification
4. AdSense application once traffic accumulates → fill slot IDs in [src/lib/ads/slots.ts](src/lib/ads/slots.ts) + publisher ID in [public/ads.txt](public/ads.txt)

## Open questions worth asking before Step 2

- Is "200 most recent published posts" actually the right slice? Or do you want a specific category, date range, or curated list? If curated, the script needs an extra flag.
- After 200 articles import, what's the actual Neon storage delta? If we're nowhere near the limit, you may want to bump to 500 or 1000 — easier to do it in one pass than in chunks.
