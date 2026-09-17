/**
 * YouTube helpers + feed config for the homepage video sync.
 * Pure module — safe to import from scripts and tests (no DB, no network).
 */

/**
 * The one feed the site syncs. Historically there were two hand-picked
 * playlists ("the-third-half", "from-the-stadiums"); both went dead on YouTube
 * (every synced video 404s) and the sections showed a player that never
 * played. The feed is now the channel's own uploads, so whatever MFM Sport
 * publishes appears without anyone curating a playlist.
 */
export type FeedKey = "channel-uploads";

/**
 * MFM Sport's channel (youtube.com/@mfmsport1430). A channel id is public —
 * it is in the page source of the channel — so it is config, not a secret.
 * The API key is the secret and lives in the `YOUTUBE_API_KEY` env var only.
 */
export const YOUTUBE_CHANNEL_ID = "UCnDy06vggD-48O8ePrXMhAw";

/**
 * Every YouTube channel has a system "uploads" playlist whose id is the
 * channel id with its `UC` prefix swapped for `UU`. Listing it through
 * `playlistItems` costs 1 quota unit per page; `search?channelId=` costs 100.
 * This is the documented way to list a channel's videos.
 */
export function uploadsPlaylistId(channelId: string): string {
  if (!/^UC[\w-]{22}$/.test(channelId)) {
    throw new Error(`Not a YouTube channel id: ${channelId}`);
  }
  return `UU${channelId.slice(2)}`;
}

/** The feeds to sync, in display order (index 0 = the homepage section). */
export const FEEDS: { key: FeedKey; playlistId: string }[] = [
  { key: "channel-uploads", playlistId: uploadsPlaylistId(YOUTUBE_CHANNEL_ID) },
];

/** Max videos pulled & shown for the feed on the homepage teaser. */
export const VIDEOS_PER_PLAYLIST = 12;

/** Max videos shown on the dedicated /videos archive page. */
export const VIDEOS_PAGE_LIMIT = 24;

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
