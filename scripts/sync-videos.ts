/**
 * YouTube Playlist -> Payload `videos` sync (CLI).
 *
 * The fetch + upsert logic lives in `src/lib/youtube-sync.ts` and is shared with
 * the scheduled cron route (`/api/cron/sync-videos`). This script is just the CLI
 * wrapper (arg parsing, dry-run logging, Payload bootstrap).
 *
 * Usage:
 *   pnpm sync:videos              # fetch both playlists, upsert into DB
 *   pnpm sync:videos:dry          # fetch + log only, NO DB connection
 *   pnpm sync:videos -- --prune   # also delete videos no longer in latest set
 *
 * Requires: YOUTUBE_API_KEY (always), DATABASE_URL + PAYLOAD_SECRET (non-dry only).
 *
 * DB-SAFETY: in --dry-run we never call getPayload(), so no Payload DB
 * connection (and no schema push) happens. Only a real run touches the DB.
 */

import "dotenv/config";
import { PLAYLISTS } from "../src/lib/youtube";
import { fetchPlaylist, syncVideos } from "../src/lib/youtube-sync";

function parseArgs(argv: string[]): { dryRun: boolean; prune: boolean } {
  return {
    dryRun: argv.includes("--dry-run"),
    prune: argv.includes("--prune"),
  };
}

async function main() {
  const { dryRun, prune } = parseArgs(process.argv.slice(2));
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error("ERROR: YOUTUBE_API_KEY is not set.");
    process.exit(1);
  }

  if (dryRun) {
    // Read-only: fetch each playlist and log, never touch the DB.
    for (const { key, playlistId } of PLAYLISTS) {
      const videos = await fetchPlaylist(playlistId, apiKey);
      console.log(`[${key}] fetched ${videos.length} videos`);
      for (const v of videos) console.log(`   - ${v.youtubeId}  ${v.duration}  ${v.title}`);
    }
    console.log(
      `\n--dry-run: no database connection opened, nothing written.${prune ? " (--prune would have run)" : ""}`,
    );
    return;
  }

  // Real run: connect to Payload and upsert via the shared sync core.
  const { getPayload } = await import("payload");
  const { default: config } = await import("../src/payload.config");
  const payload = await getPayload({ config });

  const result = await syncVideos(payload, apiKey, { prune });
  console.log(
    `\nSync complete. created=${result.created} updated=${result.updated} pruned=${result.pruned}`,
  );
  for (const [key, n] of Object.entries(result.perPlaylist)) {
    console.log(`   [${key}] fetched ${n}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
