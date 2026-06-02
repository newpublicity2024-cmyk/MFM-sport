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
