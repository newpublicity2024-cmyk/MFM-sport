import { getTranslations } from "next-intl/server";
import { getVideos } from "@/lib/videos";
import { VIDEOS_PAGE_LIMIT } from "@/lib/youtube";
import { VideosSection } from "@/components/home/VideosSection";

/**
 * Dedicated /videos archive page. Shows the channel's latest uploads (the same
 * feed teased on the homepage) as a full section — a navy player + scrollable
 * list — but with more videos than the homepage teaser.
 */
export async function VideosListing({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "videos" });
  const tHome = await getTranslations({ locale, namespace: "home" });

  const videos = await getVideos("channel-uploads", VIDEOS_PAGE_LIMIT);

  return (
    <div className="container space-y-6 py-8">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {videos.length > 0 ? (
        <VideosSection title={tHome("latestVideos")} locale={locale} videos={videos} />
      ) : (
        <p className="text-muted-foreground text-center py-12">{t("noVideos")}</p>
      )}
    </div>
  );
}
