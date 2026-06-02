# YouTube Video Sync — Design

**Date:** 2026-06-02
**Branch:** `worktree-youtube-video-import`
**Status:** Approved (design); pending implementation plan

## Goal

Replace the hardcoded homepage video list (`src/lib/home/mockVideos.ts`) with videos
auto-synced from **two YouTube playlists** belonging to the MFM Sport channel, stored in
the Payload/Neon database and rendered as **two stacked sections** on the homepage.

Each section uses the existing layout: one video in the large player, the rest in the
side list.

## Inputs (fixed config)

| Section | Position | Playlist ID | Display title (Arabic) | `playlist` select value |
|---|---|---|---|---|
| Top | above | `PL0toBD2vH6zPrTFvXcVQqYLpwifwiWEGi` | الشوط الثالث | `the-third-half` |
| Bottom | below | `PL0toBD2vH6zMqBunGKI5DRd1jz1CH7-xa` | من الملاعب الرياضية | `from-the-stadiums` |

- **Videos per section:** latest 12, newest first.
- **API key:** `YOUTUBE_API_KEY` in `.env` (gitignored). Placeholder added to `.env.example`.
  The key must be restricted in Google Cloud Console (YouTube Data API v3 only + referrer/IP).
- **Titles:** single YouTube title per video, shown for all locales (no per-language translation).
- **Thumbnails:** hotlinked `i.ytimg.com` URLs (zero storage cost — respects the Neon limit).

## Architecture

### 1. `Videos` collection (Payload)

New collection `src/collections/Videos.ts`, slug `videos`, registered in `src/payload.config.ts`.

| Field | Type | Notes |
|---|---|---|
| `youtubeId` | text, required, unique, indexed | 11-char video ID; the upsert key |
| `playlist` | select, required | options: `the-third-half` (label الشوط الثالث), `from-the-stadiums` (label من الملاعب الرياضية) |
| `title` | text, required | YouTube title, locale-agnostic |
| `thumbnailUrl` | text, required | hotlinked `i.ytimg.com` URL |
| `duration` | text | display string e.g. `08:12`, converted from ISO-8601 |
| `publishedAt` | date | from YouTube; default sort key |
| `sortOrder` | number | optional manual ordering; falls back to `publishedAt` desc |

- **Access:** public `read`, admin-only `create`/`update`/`delete` (matches other content collections).
- **Not localized** — one row per video.

### 2. Sync script — `scripts/sync-videos.ts` (`pnpm sync:videos`)

Run via `tsx`, mirroring `scripts/migrate-wp.ts`.

Flow per playlist:
1. Read `YOUTUBE_API_KEY`; playlist IDs are config constants in the script.
2. `playlistItems.list` → newest 12 video IDs.
3. `videos.list` (parts `snippet,contentDetails`) → title, thumbnail, `publishedAt`,
   and `contentDetails.duration` (ISO-8601).
4. Convert duration `PT8M12S` → `08:12`.
5. **Upsert** by `youtubeId` (find → update existing, else create), tagged with the
   section's `playlist` value.

Flags:
- `--dry-run` — fetch + log, **no DB writes** (read-only; safe during WP migration).
- `--prune` (default OFF) — delete rows in a playlist that are no longer in its latest 12.

Scripts added to `package.json`:
- `"sync:videos": "tsx scripts/sync-videos.ts"`
- `"sync:videos:dry": "tsx scripts/sync-videos.ts --dry-run"`

### 3. Frontend wiring

- New query `getVideos({ playlist, limit })` in `src/lib/payload/queries.ts`
  (or `src/lib/videos.ts`) returning videos for one playlist, sorted by
  `sortOrder` then `publishedAt` desc.
- `src/components/home/VideosSection.tsx`: change from importing `MOCK_VIDEOS` to
  accepting a `videos` prop. Stays a client component (player-select interactivity).
- Homepage `src/app/(frontend)/[locale]/page.tsx`: fetch both playlists server-side and
  render `<VideosSection>` **twice** (top = الشوط الثالث, bottom = من الملاعب الرياضية).
- Section titles: two `next-intl` keys, defaulting to the Arabic names; en/fr fillable later.
- Empty DB (pre-sync) → section renders nothing (graceful), so deploy is safe before first sync.
- `src/lib/home/mockVideos.ts` removed once sync verified.

### 4. Data flow

```
YouTube Data API ──(sync-videos.ts)──► Payload `videos` collection (Neon)
                                              │
                              getVideos({playlist}) (server)
                                              │
                          HomePage ──► VideosSection (×2, client)
```

## DB safety & sequencing (critical — shared DB with live WP migration)

The repo has **no `src/migrations/` directory** → Payload runs in **schema-push mode**:
the `videos` table is created on the shared Neon DB the first time a Payload process that
has the collection registered connects to it.

A second Claude session is **actively running the WP migration** against the same
`DATABASE_URL`. Therefore:

- **Safe now (no DB contact):** build the collection/script/frontend, unit tests,
  and `pnpm sync:videos:dry` (read-only YouTube calls).
- **GATED — run only after the user confirms the WP migration has finished:**
  the first real `pnpm sync:videos` and any local dev server pointed at the shared DB
  (both trigger the schema push).

File isolation is already handled: this work lives in the `worktree-youtube-video-import`
git worktree, separate from the migration session's working tree.

## Testing

- Unit-test the ISO-8601 duration parser (`PT8M12S` → `08:12`, edge cases: hours, seconds-only).
- Unit-test playlist-URL → ID extraction (pure function).
- Update `VideosSection` tests for the new `videos` prop (replacing the `MOCK_VIDEOS` import).
- Manual `pnpm sync:videos:dry` against the real API to confirm key + playlists resolve
  before any DB write.

## Out of scope (YAGNI)

- A separate `Playlists` collection / admin-managed sections (only two fixed playlists).
- Scheduled/cron or admin-button sync (manual script chosen).
- Downloading thumbnails into Media storage (hotlinking chosen).
- Per-language video title translations.
