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

/** Max videos pulled & shown per playlist on the homepage teaser. */
export const VIDEOS_PER_PLAYLIST = 12;

/** Max videos shown per playlist on the dedicated /videos archive page. */
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
