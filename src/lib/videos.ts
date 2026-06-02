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
