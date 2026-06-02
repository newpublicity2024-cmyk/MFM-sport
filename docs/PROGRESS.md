# MFM Sport — Progress Log

Running log of significant work. Newest entries on top. Production:
**https://mfm-sport-kappa.vercel.app** (Vercel project `mfm-sport`, team `ben776ya's projects`).

---

## 2026-06-02 / 06-03 — Launch prep: WP migration, prod bug fixes, homepage, YouTube merge

### WordPress migration (PR #2)
- Migrated the **first 200 published articles** from `mfmsport.ma` into Payload/Neon
  (scope intentionally capped at 200; full corpus is ~37k — Neon storage constraint).
- Result in prod DB: **200 articles, 186 media files, 200 redirects**, 23 categories, 228 tags, 3 authors.
- A prior run had created 174 **imageless** articles (old/invalid Blob token → uploads silently failed).
  Fixed by deleting those + re-importing fresh against the new Vercel Blob store
  (`store_R8qRmROjswh25YCU`). All 200 now have featured images.
- `scripts/migrate-wp.ts` refactored to lazy/on-demand taxonomy creation (only creates the
  categories/tags/authors actually referenced by imported articles).
- Gotcha: `--limit=N` counts *newly created* articles; re-running skips existing slugs (won't
  backfill). To fix imported articles you must delete + re-import.

### Post-migration production bug fixes (PR #3)
Two bugs surfaced once real articles went live; both root-caused against the live deploy.
- **Broken article images** — the `media` collection had no `access` rule, so Payload's default
  denied anonymous REST reads. Pages render via the server-side Local API (which bypasses access
  control), but the browser fetches `/api/media/file/...` over REST → 403 → `next/image`
  optimizer gets a non-image → broken. **Fix:** `access: { read: () => true }` on Media.
- **Article detail → 404** — the migration stored WordPress's raw **percent-encoded** Arabic
  slugs (`%d8%a7...`). Next.js decodes the route param before the `slug equals` lookup, so the
  decoded Arabic never matched the stored `%xx`. **Fix:** `decodeSlug()` in `migrate-wp.ts`
  (future imports) + `scripts/normalize-slugs.ts` decoded the 200 existing article slugs and
  redirect targets in the prod DB (verified: 0 still-encoded).
- Verified on prod: media serves `200 image/jpeg`; article pages return `200`.

### Homepage redesign (PRs #4 + #5)
- **Hero is now a 5-article slider** (`HeroSlider`) beside the live-matches panel: autoplay (6s,
  pauses on hover/focus, respects reduced-motion), prev/next arrows, dots, swipe.
- **League "news by league" section now uses real articles** instead of mock data. Real `LEAGUES`
  config (`src/lib/home/leagues.ts`) + slim card mappers (`src/lib/home/cards.ts`); homepage
  fetches 30 latest articles, uses 5 for the hero and distributes a distinct chunk of 4 per league.
  Placeholder attribution for the demo (only Botola articles exist today). Mock data removed.
- Image treatment: briefly tried a blur-fill (full image, no crop), then **reverted to the
  original `object-cover` + `group-hover:scale-105` zoom** per request (PR #5).

### YouTube video sync — separate session, merged (PR #6)
- A concurrent session built YouTube playlist auto-sync (new `Videos` collection, two homepage
  video sections, `pnpm sync:videos`). It was merged to `main` (`e17f5d5`) cleanly on top of the
  above, and deployed to production. First sync wrote **24 videos** (12/playlist) to Neon.
- **Shared-DB hazard (resolved):** both sessions used the *same* Neon DB. Before #6 merged, booting
  Payload locally from `main` (which lacked the `Videos` collection) triggered a dev schema-push
  prompting to **drop the `videos` table** — declined, no data lost. Now that #6 is on `main`,
  local config matches the DB and the hazard is gone. **Lesson:** for DB inspection against the
  shared prod DB, prefer raw SQL over `getPayload` to avoid dev schema-push.

### Cleanup
- Removed the `youtube-video-import` git worktree + deleted the 5 merged local branches
  (`worktree-youtube-video-import`, `chore/wp-migration-and-cleanup`,
  `fix/media-read-and-slug-encoding`, `feat/home-hero-slider-and-league-news`,
  `fix/home-restore-image-zoom`).

### Outstanding / follow-ups
- **`mfm-sport-9jwa`** is a broken duplicate Vercel project (every deploy ERRORs) — delete it.
- Stale **remote** branches (the 5 merged ones + `feat/youtube-video-sync`) can be deleted on origin.
- The worktree's `node_modules` folder couldn't be deleted (OneDrive/native-binary file locks);
  remove it after the locking process exits or on reboot. Git no longer tracks it.
- Pre-launch: custom domain / DNS for `mfmsport.ma` (activates the 200 WP→new 301 redirects),
  AdSense activation (deferred), and the YouTube playlists refresh via `pnpm sync:videos`.
