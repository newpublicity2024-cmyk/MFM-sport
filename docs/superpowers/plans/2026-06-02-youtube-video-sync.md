# YouTube Video Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded homepage video list with videos auto-synced from two YouTube playlists into a Payload `videos` collection, rendered as two stacked homepage sections.

**Architecture:** A new `Videos` Payload collection stores one row per video (keyed by `youtubeId`, tagged with a `playlist` value). A `tsx` script (`pnpm sync:videos`) calls the YouTube Data API v3 and upserts rows. The homepage server-fetches each playlist via a `getVideos` query and renders `VideosSection` twice. The components switch from a single localized mock title to a single plain `title` string.

**Tech Stack:** Payload 3.84 (`@payloadcms/db-postgres`, schema-push mode), Next.js 16 App Router, next-intl, YouTube Data API v3, tsx, Vitest.

**CRITICAL DB-SAFETY CONSTRAINT:** A second session is running the WordPress migration against the same `DATABASE_URL`. Payload is in schema-push mode, so the `videos` table is created the first time a Payload process with the collection registered **connects** to the DB. Therefore:
- Tasks 1–7 below are **DB-safe**: they never open a Payload DB connection (no dev server, no non-dry sync). `pnpm generate:types` and Vitest unit tests run offline.
- **Task 8 (the first real `pnpm sync:videos`) is GATED** — run it only after the user confirms the WP migration has finished.
- All git commands in this worktree use the `worktree-youtube-video-import` branch. The Bash shell's cwd is the **main repo**, so prefix git with `git -C "<worktree-path>"` OR `cd` into the worktree first. Worktree path: `C:/Users/bench/OneDrive/Desktop/mfm-sport/.claude/worktrees/youtube-video-import`.

---

## File Structure

**Create:**
- `src/collections/Videos.ts` — the Payload collection
- `src/lib/youtube.ts` — pure helpers (ISO-8601 duration parser) + playlist config constants
- `src/lib/youtube.test.ts` — unit tests for the duration parser
- `scripts/sync-videos.ts` — the sync script
- `src/lib/videos.ts` — `HomeVideo` type + `getVideos` query

**Modify:**
- `src/payload.config.ts` — register `Videos`
- `src/components/home/VideoList.tsx` — use `HomeVideo` (plain `title`, `youtubeId`)
- `src/components/home/VideosSection.tsx` — accept `videos` prop, drop `MOCK_VIDEOS`
- `src/components/home/__tests__/VideosSection.test.tsx` — pass `videos` prop
- `src/app/(frontend)/[locale]/page.tsx` — fetch both playlists, render two sections
- `messages/en.json`, `messages/ar.json`, `messages/fr.json` — two section-title keys
- `package.json` — `sync:videos` + `sync:videos:dry` scripts
- `.env.example` — `YOUTUBE_API_KEY` placeholder

**Delete (Task 7, after sync verified):**
- `src/lib/home/mockVideos.ts`

**Note on scope:** The spec mentioned a "playlist-URL → ID extraction" helper. Playlist IDs are hardcoded config constants (they never change at runtime), so a URL parser would be dead code — **omitted** per YAGNI. The duration parser remains the one pure function under test.

---

## Task 1: Env + i18n scaffolding (no logic)

**Files:**
- Modify: `.env.example`
- Modify: `messages/en.json`, `messages/ar.json`, `messages/fr.json`

- [ ] **Step 1: Add the API key placeholder to `.env.example`**

Add after the `API_FOOTBALL_KEY` block (around line 17):

```
# YouTube Data API v3 (for homepage video sync — scripts/sync-videos.ts)
YOUTUBE_API_KEY=
```

- [ ] **Step 2: Add the real key to `.env` (gitignored)**

Append to `.env` (NOT `.env.example`):

```
YOUTUBE_API_KEY=AIzaSyCbYFZOep6YRTqnTkhn7i7yPHqMUE8mcGo
```

- [ ] **Step 3: Add two section-title keys to each message file**

In `messages/en.json`, inside the `"home"` object (next to `"latestVideos"`), add:

```json
    "videoThirdHalf": "The Third Half",
    "videoFromStadiums": "From the Stadiums",
```

In `messages/ar.json`, inside `"home"`:

```json
    "videoThirdHalf": "الشوط الثالث",
    "videoFromStadiums": "من الملاعب الرياضية",
```

In `messages/fr.json`, inside `"home"`:

```json
    "videoThirdHalf": "La Troisième Mi-temps",
    "videoFromStadiums": "Depuis les Stades",
```

(Arabic is the source of truth; en/fr are best-effort and editable later.)

- [ ] **Step 4: Verify JSON is valid**

Run: `node -e "require('./messages/en.json');require('./messages/ar.json');require('./messages/fr.json');console.log('OK')"`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/bench/OneDrive/Desktop/mfm-sport/.claude/worktrees/youtube-video-import"
git add .env.example messages/en.json messages/ar.json messages/fr.json
git commit -m "feat(videos): add YOUTUBE_API_KEY placeholder and section-title i18n keys"
```

(`.env` is gitignored and will not be committed — that is intentional.)

---

## Task 2: Duration parser + playlist config (pure, TDD)

**Files:**
- Create: `src/lib/youtube.ts`
- Test: `src/lib/youtube.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/youtube.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseIsoDuration, PLAYLISTS } from "./youtube";

describe("parseIsoDuration", () => {
  it("formats minutes and seconds zero-padded", () => {
    expect(parseIsoDuration("PT8M12S")).toBe("08:12");
  });
  it("keeps two-digit minutes", () => {
    expect(parseIsoDuration("PT12M1S")).toBe("12:01");
  });
  it("handles seconds-only", () => {
    expect(parseIsoDuration("PT45S")).toBe("00:45");
  });
  it("handles minutes-only", () => {
    expect(parseIsoDuration("PT12M")).toBe("12:00");
  });
  it("includes hours when present", () => {
    expect(parseIsoDuration("PT1H2M3S")).toBe("1:02:03");
  });
  it("handles hours with no minutes/seconds", () => {
    expect(parseIsoDuration("PT1H")).toBe("1:00:00");
  });
  it("returns 00:00 for empty/zero", () => {
    expect(parseIsoDuration("PT0S")).toBe("00:00");
    expect(parseIsoDuration("")).toBe("00:00");
  });
});

describe("PLAYLISTS", () => {
  it("declares the two configured playlists in order", () => {
    expect(PLAYLISTS.map((p) => p.key)).toEqual([
      "the-third-half",
      "from-the-stadiums",
    ]);
    expect(PLAYLISTS[0].playlistId).toBe("PL0toBD2vH6zPrTFvXcVQqYLpwifwiWEGi");
    expect(PLAYLISTS[1].playlistId).toBe("PL0toBD2vH6zMqBunGKI5DRd1jz1CH7-xa");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/youtube.test.ts`
Expected: FAIL — cannot resolve `./youtube` / `parseIsoDuration is not a function`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/youtube.ts`:

```ts
/**
 * YouTube helpers + playlist config for the homepage video sync.
 * Pure module — safe to import from scripts and tests (no DB, no network).
 */

export type PlaylistKey = "the-third-half" | "from-the-stadiums";

/**
 * The two playlists feeding the homepage video sections, in display order
 * (index 0 = top section). `titleKey` is the next-intl key under "home".
 */
export const PLAYLISTS: {
  key: PlaylistKey;
  playlistId: string;
  titleKey: "videoThirdHalf" | "videoFromStadiums";
}[] = [
  {
    key: "the-third-half",
    playlistId: "PL0toBD2vH6zPrTFvXcVQqYLpwifwiWEGi",
    titleKey: "videoThirdHalf",
  },
  {
    key: "from-the-stadiums",
    playlistId: "PL0toBD2vH6zMqBunGKI5DRd1jz1CH7-xa",
    titleKey: "videoFromStadiums",
  },
];

/** Max videos pulled & shown per playlist. */
export const VIDEOS_PER_PLAYLIST = 12;

/**
 * Convert an ISO-8601 duration (e.g. "PT8M12S") to a display string.
 * "MM:SS" when under an hour, "H:MM:SS" otherwise. Falls back to "00:00".
 */
export function parseIsoDuration(iso: string): string {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso ?? "");
  if (!match) return "00:00";
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/youtube.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/bench/OneDrive/Desktop/mfm-sport/.claude/worktrees/youtube-video-import"
git add src/lib/youtube.ts src/lib/youtube.test.ts
git commit -m "feat(videos): ISO-8601 duration parser and playlist config"
```

---

## Task 3: `Videos` collection + register in config + generate types

**Files:**
- Create: `src/collections/Videos.ts`
- Modify: `src/payload.config.ts`

- [ ] **Step 1: Create the collection**

Create `src/collections/Videos.ts`:

```ts
import type { CollectionConfig } from "payload";

export const Videos: CollectionConfig = {
  slug: "videos",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "playlist", "publishedAt"],
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: "youtubeId",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: { description: "The 11-character YouTube video ID." },
    },
    {
      name: "playlist",
      type: "select",
      required: true,
      index: true,
      options: [
        { label: "الشوط الثالث", value: "the-third-half" },
        { label: "من الملاعب الرياضية", value: "from-the-stadiums" },
      ],
    },
    {
      name: "title",
      type: "text",
      required: true,
    },
    {
      name: "thumbnailUrl",
      type: "text",
      required: true,
    },
    {
      name: "duration",
      type: "text",
    },
    {
      name: "publishedAt",
      type: "date",
    },
    {
      name: "sortOrder",
      type: "number",
      defaultValue: 0,
      admin: { description: "Lower = earlier. Set from playlist order on sync." },
    },
  ],
};
```

Note: `access.read` is public; create/update/delete are omitted, which defaults to authenticated-only in this config — matching the other content collections.

- [ ] **Step 2: Register the collection in `src/payload.config.ts`**

Add the import alongside the others (after the `Redirects` import, line ~19):

```ts
import { Videos } from './collections/Videos'
```

Add `Videos` to the `collections` array (line ~48):

```ts
  collections: [Users, Media, Categories, Tags, Authors, Articles, Competitions, Clubs, Subscribers, Pages, Redirects, Videos],
```

- [ ] **Step 3: Generate Payload types (offline — no DB connection)**

Run: `pnpm generate:types`
Expected: completes; `src/payload-types.ts` now contains a `Video` interface and `videos` in `Config["collections"]`.

- [ ] **Step 4: Verify the type was generated**

Run: `node -e "const t=require('fs').readFileSync('src/payload-types.ts','utf8'); if(!/interface Video\b/.test(t)) throw new Error('Video type missing'); console.log('OK')"`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/bench/OneDrive/Desktop/mfm-sport/.claude/worktrees/youtube-video-import"
git add src/collections/Videos.ts src/payload.config.ts src/payload-types.ts
git commit -m "feat(videos): add Videos collection and register it in payload config"
```

---

## Task 4: `HomeVideo` type + `getVideos` query

**Files:**
- Create: `src/lib/videos.ts`

- [ ] **Step 1: Create the query module**

Create `src/lib/videos.ts`:

```ts
import { getPayloadClient } from "@/lib/payload/queries";
import type { PlaylistKey } from "@/lib/youtube";
import { VIDEOS_PER_PLAYLIST } from "@/lib/youtube";

/** Shape consumed by the homepage video components. Locale-agnostic title. */
export type HomeVideo = {
  youtubeId: string;
  title: string;
  thumbnailUrl: string;
  duration: string;
  publishedAt: string;
};

/** Fetch videos for one playlist, ordered by sortOrder (playlist order). */
export async function getVideos(
  playlist: PlaylistKey,
  limit: number = VIDEOS_PER_PLAYLIST,
): Promise<HomeVideo[]> {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "videos",
    where: { playlist: { equals: playlist } },
    limit,
    sort: "sortOrder",
  });
  return result.docs.map((doc) => ({
    youtubeId: doc.youtubeId,
    title: doc.title,
    thumbnailUrl: doc.thumbnailUrl,
    duration: doc.duration ?? "",
    publishedAt:
      typeof doc.publishedAt === "string"
        ? doc.publishedAt
        : doc.publishedAt
          ? new Date(doc.publishedAt).toISOString()
          : "",
  }));
}
```

- [ ] **Step 2: Type-check the new module (offline)**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no errors referencing `src/lib/videos.ts`. (Pre-existing unrelated errors, if any, are out of scope — confirm none are in `videos.ts`.)

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/bench/OneDrive/Desktop/mfm-sport/.claude/worktrees/youtube-video-import"
git add src/lib/videos.ts
git commit -m "feat(videos): HomeVideo type and getVideos query"
```

---

## Task 5: Sync script `scripts/sync-videos.ts`

**Files:**
- Create: `scripts/sync-videos.ts`
- Modify: `package.json`

- [ ] **Step 1: Add scripts to `package.json`**

In the `"scripts"` block, after `"migrate:wp:sample"`, add:

```json
    "sync:videos": "tsx scripts/sync-videos.ts",
    "sync:videos:dry": "tsx scripts/sync-videos.ts --dry-run",
```

- [ ] **Step 2: Create the sync script**

Create `scripts/sync-videos.ts`:

```ts
/**
 * YouTube Playlist -> Payload `videos` sync.
 *
 * Usage:
 *   pnpm sync:videos              # fetch both playlists, upsert into DB
 *   pnpm sync:videos:dry          # fetch + log only, NO DB connection
 *   pnpm sync:videos -- --prune   # also delete videos no longer in latest 12
 *
 * Requires: YOUTUBE_API_KEY (always), DATABASE_URL + PAYLOAD_SECRET (non-dry only).
 *
 * DB-SAFETY: in --dry-run we never call getPayload(), so no Payload DB
 * connection (and no schema push) happens. Only a real run touches the DB.
 *
 * Idempotent: upsert by youtubeId. sortOrder is set from playlist position.
 */

import "dotenv/config";
import { PLAYLISTS, VIDEOS_PER_PLAYLIST, parseIsoDuration } from "../src/lib/youtube";
import type { PlaylistKey } from "../src/lib/youtube";

type FetchedVideo = {
  youtubeId: string;
  title: string;
  thumbnailUrl: string;
  duration: string;
  publishedAt: string;
  sortOrder: number;
};

const API = "https://www.googleapis.com/youtube/v3";

function parseArgs(argv: string[]): { dryRun: boolean; prune: boolean } {
  return {
    dryRun: argv.includes("--dry-run"),
    prune: argv.includes("--prune"),
  };
}

async function ytGet(path: string, params: Record<string, string>): Promise<any> {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API ${path} failed: ${res.status} ${body}`);
  }
  return res.json();
}

/** Fetch the latest N videos of one playlist, in playlist order. */
async function fetchPlaylist(playlistId: string, apiKey: string): Promise<FetchedVideo[]> {
  const items = await ytGet("playlistItems", {
    part: "contentDetails",
    maxResults: String(VIDEOS_PER_PLAYLIST),
    playlistId,
    key: apiKey,
  });
  const ids: string[] = (items.items ?? [])
    .map((it: any) => it.contentDetails?.videoId)
    .filter(Boolean);
  if (ids.length === 0) return [];

  const details = await ytGet("videos", {
    part: "snippet,contentDetails",
    id: ids.join(","),
    key: apiKey,
  });

  const byId = new Map<string, any>();
  for (const v of details.items ?? []) byId.set(v.id, v);

  // Preserve playlist order via the ids array.
  return ids
    .map((id, index) => {
      const v = byId.get(id);
      if (!v) return null;
      return {
        youtubeId: id,
        title: v.snippet?.title ?? "(untitled)",
        thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        duration: parseIsoDuration(v.contentDetails?.duration ?? ""),
        publishedAt: v.snippet?.publishedAt ?? "",
        sortOrder: index,
      } as FetchedVideo;
    })
    .filter((v): v is FetchedVideo => v !== null);
}

async function main() {
  const { dryRun, prune } = parseArgs(process.argv.slice(2));
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error("ERROR: YOUTUBE_API_KEY is not set.");
    process.exit(1);
  }

  // Fetch everything first (read-only, no DB).
  const fetched = new Map<PlaylistKey, FetchedVideo[]>();
  for (const { key, playlistId } of PLAYLISTS) {
    const videos = await fetchPlaylist(playlistId, apiKey);
    fetched.set(key, videos);
    console.log(`[${key}] fetched ${videos.length} videos`);
    for (const v of videos) console.log(`   - ${v.youtubeId}  ${v.duration}  ${v.title}`);
  }

  if (dryRun) {
    console.log("\n--dry-run: no database connection opened, nothing written.");
    return;
  }

  // Real run: connect to Payload and upsert.
  const { getPayload } = await import("payload");
  const { default: config } = await import("../src/payload.config");
  const payload = await getPayload({ config });

  for (const { key } of PLAYLISTS) {
    const videos = fetched.get(key) ?? [];
    const keepIds = new Set(videos.map((v) => v.youtubeId));

    for (const v of videos) {
      const existing = await payload.find({
        collection: "videos",
        where: { youtubeId: { equals: v.youtubeId } },
        limit: 1,
      });
      const data = {
        youtubeId: v.youtubeId,
        playlist: key,
        title: v.title,
        thumbnailUrl: v.thumbnailUrl,
        duration: v.duration,
        publishedAt: v.publishedAt || undefined,
        sortOrder: v.sortOrder,
      };
      if (existing.docs[0]) {
        await payload.update({ collection: "videos", id: existing.docs[0].id, data });
        console.log(`[${key}] updated ${v.youtubeId}`);
      } else {
        await payload.create({ collection: "videos", data });
        console.log(`[${key}] created ${v.youtubeId}`);
      }
    }

    if (prune) {
      const stale = await payload.find({
        collection: "videos",
        where: { playlist: { equals: key } },
        limit: 1000,
      });
      for (const doc of stale.docs) {
        if (!keepIds.has(doc.youtubeId)) {
          await payload.delete({ collection: "videos", id: doc.id });
          console.log(`[${key}] pruned ${doc.youtubeId}`);
        }
      }
    }
  }

  console.log("\nSync complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Type-check the script (offline, no execution)**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no errors in `scripts/sync-videos.ts`.

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/bench/OneDrive/Desktop/mfm-sport/.claude/worktrees/youtube-video-import"
git add scripts/sync-videos.ts package.json
git commit -m "feat(videos): sync-videos script (dry-run safe, idempotent upsert)"
```

> DO NOT run `pnpm sync:videos` (non-dry) yet — that is Task 8, gated on the WP migration. `pnpm sync:videos:dry` is safe but is also deferred to Task 8 so all DB-adjacent verification happens together.

---

## Task 6: Wire components + homepage to the DB; replace mock

**Files:**
- Modify: `src/components/home/VideoList.tsx`
- Modify: `src/components/home/VideosSection.tsx`
- Modify: `src/components/home/__tests__/VideosSection.test.tsx`
- Modify: `src/app/(frontend)/[locale]/page.tsx`

- [ ] **Step 1: Update the failing test first (TDD — new `videos` prop)**

Replace the entire contents of `src/components/home/__tests__/VideosSection.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VideosSection } from "@/components/home/VideosSection";
import type { HomeVideo } from "@/lib/videos";

const VIDEOS: HomeVideo[] = [
  {
    youtubeId: "aaa111",
    title: "First Video",
    thumbnailUrl: "https://i.ytimg.com/vi/aaa111/hqdefault.jpg",
    duration: "08:12",
    publishedAt: "2026-05-13T12:00:00.000Z",
  },
  {
    youtubeId: "bbb222",
    title: "Second Video",
    thumbnailUrl: "https://i.ytimg.com/vi/bbb222/hqdefault.jpg",
    duration: "05:45",
    publishedAt: "2026-05-11T12:00:00.000Z",
  },
];

describe("VideosSection", () => {
  it("renders the section title", () => {
    render(<VideosSection title="The Third Half" locale="en" videos={VIDEOS} />);
    expect(screen.getByRole("heading", { name: "The Third Half" })).toBeInTheDocument();
  });

  it("renders nothing when there are no videos", () => {
    const { container } = render(
      <VideosSection title="Empty" locale="en" videos={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("defaults to the first video and renders its iframe", () => {
    render(<VideosSection title="The Third Half" locale="en" videos={VIDEOS} />);
    const iframe = screen.getByTitle("First Video") as HTMLIFrameElement;
    expect(iframe.src).toContain("youtube.com/embed/aaa111");
  });

  it("swaps the iframe when a list item is clicked", () => {
    render(<VideosSection title="The Third Half" locale="en" videos={VIDEOS} />);
    fireEvent.click(screen.getByRole("button", { name: /Second Video/ }));
    const iframe = screen.getByTitle("Second Video") as HTMLIFrameElement;
    expect(iframe.src).toContain("youtube.com/embed/bbb222");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/components/home/__tests__/VideosSection.test.tsx`
Expected: FAIL — `VideosSection` doesn't accept `videos`, still imports `MOCK_VIDEOS`; type/prop errors.

- [ ] **Step 3: Update `VideoList.tsx` to use `HomeVideo`**

Replace the entire contents of `src/components/home/VideoList.tsx`:

```tsx
"use client";

import Image from "next/image";
import { Play } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { HomeVideo } from "@/lib/videos";

type Props = {
  videos: HomeVideo[];
  selectedId: string;
  locale: string;
  onSelect: (videoId: string) => void;
};

export function VideoList({ videos, selectedId, locale, onSelect }: Props) {
  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto rounded-xl border border-border bg-card p-2">
      {videos.map((video) => {
        const isActive = video.youtubeId === selectedId;
        return (
          <button
            key={video.youtubeId}
            type="button"
            onClick={() => onSelect(video.youtubeId)}
            aria-pressed={isActive}
            className={`flex items-stretch gap-2 rounded-lg p-1.5 text-start transition-colors ${
              isActive
                ? "bg-primary/10 ring-1 ring-primary"
                : "hover:bg-muted/40"
            }`}
          >
            <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-md">
              <Image
                src={video.thumbnailUrl}
                alt=""
                fill
                className="object-cover"
                sizes="96px"
              />
              {isActive && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Play className="h-5 w-5 fill-white stroke-white" />
                </div>
              )}
              <span className="absolute bottom-0.5 end-0.5 rounded bg-black/70 px-1 text-[10px] font-medium text-white">
                {video.duration}
              </span>
            </div>
            <div className="flex flex-1 flex-col justify-between py-0.5">
              <span className="text-xs font-medium leading-snug line-clamp-2">
                {video.title}
              </span>
              <time
                dateTime={video.publishedAt}
                className="text-[10px] text-muted-foreground"
              >
                {formatDate(video.publishedAt, locale)}
              </time>
            </div>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Update `VideosSection.tsx` to accept `videos`**

Replace the entire contents of `src/components/home/VideosSection.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { VideoPlayer } from "./VideoPlayer";
import { VideoList } from "./VideoList";
import type { HomeVideo } from "@/lib/videos";

type Props = {
  title: string;
  locale: string;
  videos: HomeVideo[];
};

export function VideosSection({ title, locale, videos }: Props) {
  const [selectedId, setSelectedId] = useState<string>(videos[0]?.youtubeId ?? "");

  const selected = useMemo(
    () => videos.find((v) => v.youtubeId === selectedId) ?? videos[0],
    [selectedId, videos],
  );

  if (!selected) return null;

  return (
    <section className="mt-10">
      <SectionHeader title={title} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <VideoPlayer videoId={selected.youtubeId} title={selected.title} />
        </div>
        <div>
          <VideoList
            videos={videos}
            selectedId={selectedId}
            locale={locale}
            onSelect={setSelectedId}
          />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run src/components/home/__tests__/VideosSection.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Wire the homepage to fetch both playlists**

In `src/app/(frontend)/[locale]/page.tsx`:

Add imports near the top (after the `getArticles` import, line ~5):

```ts
import { getVideos } from "@/lib/videos";
```

In the `HomePage` component body, after `const featured = latest.docs[0];` (line ~39), add:

```ts
  const [thirdHalfVideos, fromStadiumsVideos] = await Promise.all([
    getVideos("the-third-half"),
    getVideos("from-the-stadiums"),
  ]);
```

Replace the single existing `VideosSection` usage:

```tsx
      <VideosSection title={t("latestVideos")} locale={locale} />
```

with the two stacked sections:

```tsx
      <VideosSection
        title={t("videoThirdHalf")}
        locale={locale}
        videos={thirdHalfVideos}
      />

      <VideosSection
        title={t("videoFromStadiums")}
        locale={locale}
        videos={fromStadiumsVideos}
      />
```

- [ ] **Step 7: Delete the now-unused mock**

Confirm nothing else imports it: run `pnpm exec grep -r "mockVideos" src/` (or use editor search). The only references should have been `VideosSection.tsx` (now removed) and the old test (now rewritten). Then:

```bash
cd "C:/Users/bench/OneDrive/Desktop/mfm-sport/.claude/worktrees/youtube-video-import"
git rm src/lib/home/mockVideos.ts
```

- [ ] **Step 8: Type-check + run the full unit test suite**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no new errors in the touched files.

Run: `pnpm vitest run src/lib/youtube.test.ts src/components/home/__tests__/VideosSection.test.tsx`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
cd "C:/Users/bench/OneDrive/Desktop/mfm-sport/.claude/worktrees/youtube-video-import"
git add src/components/home/VideoList.tsx src/components/home/VideosSection.tsx src/components/home/__tests__/VideosSection.test.tsx "src/app/(frontend)/[locale]/page.tsx"
git commit -m "feat(videos): render two DB-backed video sections on the homepage; drop mockVideos"
```

---

## Task 7: Pre-flight review (still DB-safe)

**Files:** none (verification only)

- [ ] **Step 1: Confirm no remaining mock references**

Run: `pnpm exec grep -rn "MOCK_VIDEOS\|mockVideos" src/`
Expected: no matches.

- [ ] **Step 2: Confirm lint passes on touched files**

Run: `pnpm lint`
Expected: no new errors introduced by this work. (Pre-existing warnings unrelated to videos are acceptable.)

- [ ] **Step 3: Confirm the gated command is wired**

Run: `node -e "const p=require('./package.json'); if(!p.scripts['sync:videos']||!p.scripts['sync:videos:dry']) throw new Error('scripts missing'); console.log('OK')"`
Expected: `OK`

---

## Task 8: GATED — first sync against the shared DB

> **DO NOT START until the user explicitly confirms the WordPress migration in the other session has finished.** This is the first step that opens a Payload DB connection and pushes the `videos` table to shared Neon.

**Files:** none (data operation)

- [ ] **Step 1: Dry-run to validate the API key + playlists (read-only, still no DB)**

Run: `pnpm sync:videos:dry`
Expected: prints `[the-third-half] fetched N videos` and `[from-the-stadiums] fetched N videos` with IDs/durations/titles, then `--dry-run: no database connection opened`. If it errors with `403`/`400`, the API key is unrestricted-but-wrong or needs the referrer/IP fixed — stop and resolve before Step 2.

- [ ] **Step 2: (After user confirms WP migration done) Real sync**

Run: `pnpm sync:videos`
Expected: `created`/`updated` lines for each video, then `Sync complete.` The `videos` table now exists in Neon and is populated.

- [ ] **Step 3: Verify on the running app**

Start dev (now safe): `pnpm dev`, open `http://localhost:3000`, confirm two video sections render — الشوط الثالث on top, من الملاعب الرياضية below — each with a large player + side list. Stop the dev server when done.

- [ ] **Step 4: Final commit (if any lockfile/type drift) and finish**

```bash
cd "C:/Users/bench/OneDrive/Desktop/mfm-sport/.claude/worktrees/youtube-video-import"
git status
# commit only if something changed; otherwise proceed to finishing-a-development-branch
```

Then use the **superpowers:finishing-a-development-branch** skill to merge/PR the worktree branch.

---

## Self-Review

**Spec coverage:**
- Videos collection w/ youtubeId/playlist/title/thumbnailUrl/duration/publishedAt/sortOrder → Task 3 ✓
- Sync script, upsert by youtubeId, `--dry-run`, `--prune` default off → Task 5 ✓
- `getVideos` query + `VideosSection` prop refactor + two homepage sections → Tasks 4, 6 ✓
- Single title all locales (plain string) → Tasks 4, 6 (VideoList/Section use `video.title`) ✓
- Hotlinked `i.ytimg.com` thumbnails → Task 5 (`hqdefault.jpg`) ✓
- next-intl section titles defaulting to Arabic → Task 1 ✓
- DB-safety gating (dry-run no DB; first sync gated) → script design Task 5 + Task 8 ✓
- Duration parser unit-tested → Task 2 ✓
- Empty DB renders gracefully → Task 6 (VideosSection returns null; test covers it) ✓
- Remove mockVideos after verify → Task 6 Step 7 ✓
- Playlist-URL→ID helper → intentionally omitted (YAGNI, IDs hardcoded); noted in File Structure ✓

**Placeholder scan:** none — every code step has complete code.

**Type consistency:** `HomeVideo` (youtubeId/title/thumbnailUrl/duration/publishedAt) defined in Task 4 and consumed identically in Tasks 5 (FetchedVideo superset) and 6. `PlaylistKey` and `PLAYLISTS` from Task 2 used in Tasks 4 and 5. `getVideos(playlist, limit)` signature consistent between Task 4 definition and Task 6 calls. Collection field names match the upsert `data` object and the `getVideos` mapper.
