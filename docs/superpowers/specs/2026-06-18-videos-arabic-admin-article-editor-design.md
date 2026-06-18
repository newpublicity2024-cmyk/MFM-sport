# Design — Videos page, Arabic admin, simplified article editor

Date: 2026-06-18
Branch: `feat/videos-page-arabic-admin-article-editor`

Three independent changes to MFM Sport (Payload 3.84 + Next 16). Each ships in
order and is verifiable on its own.

## Task 1 — Dedicated videos page (two YouTube playlists)

**Current behaviour:** `/[locale]/videos` renders `VideosListing`, which calls
`getVideoArticles` (articles flagged `isVideo`). None exist, so the page shows the
`videos.noVideos` empty state — appears blank.

**Target:** the page shows the same two YouTube playlists as the homepage
(`the-third-half`, `from-the-stadiums`), styled as a dedicated archive.

**Changes:**
- Rewrite `src/components/videos/VideosListing.tsx`:
  - Fetch both playlists via `getVideos(key, limit)` from `src/lib/videos.ts`.
  - Render one homepage `VideosSection` (navy player + scrollable list) per
    playlist, titles from existing i18n keys `home.videoThirdHalf` /
    `home.videoFromStadiums`. Page `<h1>` uses `videos.title`.
  - Show more videos than the homepage teaser: page limit ~24 per playlist
    (homepage stays at `VIDEOS_PER_PLAYLIST` = 12). Add a `VIDEOS_PAGE_LIMIT`
    constant rather than hardcoding.
  - If a playlist has no videos, omit that section (don't render an empty shell).
- `src/app/(frontend)/[locale]/videos/page.tsx`: drop the `page={1}` /
  pagination contract; render the new playlist-based listing. Keep `revalidate`.
- `src/app/(frontend)/[locale]/videos/page/[n]/page.tsx`: redirect to
  `/${locale}/videos` (playlists are capped, not paginated). Keeps old links alive.
- Remove now-unused imports (`getVideoArticles`, `ArticleGrid`, `Pagination`)
  from the videos listing path if nothing else uses them there.

**Out of scope:** changing the homepage; changing the YouTube sync.

## Task 2 — Arabic admin dashboard

**Target:** an admin who selects العربية gets the entire Payload panel in Arabic
(RTL), including our custom field labels and help text.

**Changes:**
- Add `@payloadcms/translations` (3.84.0) as an explicit dependency (currently
  transitive; not resolvable from app code).
- `src/payload.config.ts`: add
  `i18n: { supportedLanguages: { en, fr, ar } }` (imported from
  `@payloadcms/translations`). Default language stays English; each admin selects
  Arabic in their **account settings** (Payload's built-in switcher), which
  persists per user and flips the panel to Arabic + RTL automatically.
- Translate every **custom** string (Payload auto-translates its own chrome, not
  ours) to `{ en, fr, ar }` objects:
  - Collection `labels` (singular/plural) for all collections.
  - Every field `label`.
  - Every `admin.description`.
  - `select` field option `label`s (e.g. status Draft/Published, ad type/placement).
  - Covers: Users, Media, Categories, Tags, Authors, Articles, Competitions,
    Clubs, Subscribers, Pages, Redirects, Videos, Ads.
- Field-label objects are keyed by Payload i18n language code (`en`/`fr`/`ar`),
  which is independent of the content-localization locales.

**Out of scope:** translating article *content* (already handled by content
localization + i18n scripts).

## Task 3 — Simplified article editor + language tabs + auto publish date

**Language tabs:**
- Add a custom admin UI component rendering a tab bar: العربية / Français /
  English. Clicking a tab switches Payload's active editing **locale** (same
  engine as the built-in locale dropdown) so the title/excerpt/body fields show
  that language. One language is edited at a time.
- Rationale: keeps the existing Payload content-localization model intact, so the
  public frontend, i18n scripts, localized slug, and migrations are untouched
  (zero data risk). Showing all three languages stacked simultaneously would
  require non-localized parallel fields — a major, risky rework — and is
  explicitly rejected.
- Implemented with a client component using Payload UI hooks
  (`useLocale` + router to set the `locale` search param). Mounted via the
  Articles collection `admin.components` (e.g. `beforeFields` / a `ui` field at
  the top of the form).

**Simplify the form:**
- Group fields so the editor isn't one long flat list:
  - Content (title, excerpt, body) at the top, under the language tabs.
  - Publishing controls in the sidebar: `status`, `publishedAt`, `author`,
    `isVideo`/`videoUrl`.
  - Media/meta (featuredImage) in the main column.
- Hide the seed-only `featuredImageUrl` from normal editing
  (`admin.hidden` or `admin.condition` false) so it doesn't clutter the form.
- Keep slug read-only / auto (unchanged).

**Auto publish date:**
- Add a `beforeChange` hook on Articles: if `status === "published"` and
  `publishedAt` is empty, set `publishedAt` to the current time. Never overwrite
  an existing value. (Drafts may stay without a date.)

**Out of scope:** changing the slug auto-generation; changing the rich-text editor.

## Risks / notes
- Task 3 tabs switch language (one at a time), not simultaneous stacked editors —
  accepted tradeoff for zero frontend/migration risk.
- Task 2 is many small strings but a one-time pass; no schema/migration changes.
- No DB migration required for any task (no new/changed persisted fields;
  `publishedAt` already exists).

## Verification per task
1. Videos page renders both playlists with players + lists in all three locales;
   `/videos/page/2` redirects to `/videos`.
2. Switching an admin account to Arabic renders the panel RTL with Arabic nav,
   field labels, descriptions and select options.
3. Article editor shows language tabs that switch the edited language; saving a
   published article with no date stamps the current time; form is grouped/simpler.
