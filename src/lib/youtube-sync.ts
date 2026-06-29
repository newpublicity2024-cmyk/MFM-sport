/**
 * Shared YouTube playlist -> Payload `videos` sync core.
 *
 * Used by BOTH the CLI script (`scripts/sync-videos.ts`) and the scheduled cron
 * route (`/api/cron/sync-videos`), so there is one implementation of the fetch +
 * upsert logic. Pure of any Next.js / CLI specifics — callers provide the Payload
 * instance and the API key.
 */
import { PLAYLISTS, VIDEOS_PER_PLAYLIST, parseIsoDuration } from "./youtube";
import type { PlaylistKey } from "./youtube";

const API = "https://www.googleapis.com/youtube/v3";

export type FetchedVideo = {
  youtubeId: string;
  title: string;
  thumbnailUrl: string;
  duration: string;
  publishedAt: string | undefined;
  sortOrder: number;
};

type PlaylistItemsResponse = {
  items?: { contentDetails?: { videoId?: string } }[];
};
type VideoDetail = {
  id: string;
  snippet?: { title?: string; publishedAt?: string };
  contentDetails?: { duration?: string };
};
type VideosResponse = { items?: VideoDetail[] };

async function ytGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API ${path} failed: ${res.status} ${body}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Fetch the latest N videos of one playlist, in playlist order. The MFM
 * playlists are ordered newest-first, so index 0 is the most recent upload and
 * becomes sortOrder 0 (the homepage/archive sort ascending by sortOrder).
 */
export async function fetchPlaylist(
  playlistId: string,
  apiKey: string,
): Promise<FetchedVideo[]> {
  if (VIDEOS_PER_PLAYLIST > 50) {
    throw new Error(
      "VIDEOS_PER_PLAYLIST exceeds the YouTube single-page limit (50); add pagination.",
    );
  }

  const items = await ytGet<PlaylistItemsResponse>("playlistItems", {
    part: "contentDetails",
    maxResults: String(VIDEOS_PER_PLAYLIST),
    playlistId,
    key: apiKey,
  });
  const ids: string[] = (items.items ?? [])
    .map((it) => it.contentDetails?.videoId)
    .filter(Boolean) as string[];
  if (ids.length === 0) return [];

  const details = await ytGet<VideosResponse>("videos", {
    part: "snippet,contentDetails",
    id: ids.join(","),
    key: apiKey,
  });

  const byId = new Map<string, VideoDetail>();
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
        publishedAt: v.snippet?.publishedAt ?? undefined,
        sortOrder: index,
      } as FetchedVideo;
    })
    .filter((v): v is FetchedVideo => v !== null);
}

// The minimal slice of the Payload local API the sync uses — lets tests inject
// a fake without standing up a real Payload instance. Kept loose (`any` args /
// `docs: any[]`) so the real strongly-typed Payload client also satisfies it.
type VideoRow = { id: string | number; youtubeId: string };

export interface SyncPayload {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  find(args: any): Promise<{ docs: any[] }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  create(args: any): Promise<unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  update(args: any): Promise<unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete(args: any): Promise<unknown>;
}

export type SyncResult = {
  created: number;
  updated: number;
  pruned: number;
  perPlaylist: Record<string, number>;
};

/**
 * Fetch both playlists and upsert into `videos` (idempotent by youtubeId,
 * sortOrder from playlist position). With `prune`, videos no longer in a
 * playlist's latest set are deleted — but ONLY for a playlist that actually
 * returned videos, so a transient empty/failed fetch can never wipe the table.
 */
export async function syncVideos(
  payload: SyncPayload,
  apiKey: string,
  opts: { prune?: boolean } = {},
): Promise<SyncResult> {
  let created = 0;
  let updated = 0;
  let pruned = 0;
  const perPlaylist: Record<string, number> = {};

  for (const { key, playlistId } of PLAYLISTS) {
    const videos = await fetchPlaylist(playlistId, apiKey);
    perPlaylist[key] = videos.length;
    // Safety: never mutate a playlist's rows when the fetch came back empty.
    if (videos.length === 0) continue;

    const keepIds = new Set(videos.map((v) => v.youtubeId));

    for (const v of videos) {
      const existing = (await payload.find({
        collection: "videos",
        where: { youtubeId: { equals: v.youtubeId } },
        limit: 1,
      })) as { docs: VideoRow[] };
      const data = {
        youtubeId: v.youtubeId,
        playlist: key as PlaylistKey,
        title: v.title,
        thumbnailUrl: v.thumbnailUrl,
        duration: v.duration,
        publishedAt: v.publishedAt,
        sortOrder: v.sortOrder,
      };
      if (existing.docs[0]) {
        await payload.update({ collection: "videos", id: existing.docs[0].id, data });
        updated++;
      } else {
        await payload.create({ collection: "videos", data });
        created++;
      }
    }

    if (opts.prune) {
      const stale = (await payload.find({
        collection: "videos",
        where: { playlist: { equals: key } },
        limit: 1000,
      })) as { docs: VideoRow[] };
      for (const doc of stale.docs) {
        if (!keepIds.has(doc.youtubeId)) {
          await payload.delete({ collection: "videos", id: doc.id });
          pruned++;
        }
      }
    }
  }

  return { created, updated, pruned, perPlaylist };
}
