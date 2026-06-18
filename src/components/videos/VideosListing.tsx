import { getTranslations } from "next-intl/server";
import { getVideos } from "@/lib/videos";
import { VIDEOS_PAGE_LIMIT } from "@/lib/youtube";
import { VideosSection } from "@/components/home/VideosSection";

/**
 * Dedicated /videos archive page. Shows the two YouTube playlists (the same ones
 * teased on the homepage) as full sections — a navy player + scrollable list per
 * playlist — but with more videos than the homepage teaser.
 */
export async function VideosListing({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "videos" });
  const tHome = await getTranslations({ locale, namespace: "home" });

  const [thirdHalfVideos, fromStadiumsVideos] = await Promise.all([
    getVideos("the-third-half", VIDEOS_PAGE_LIMIT),
    getVideos("from-the-stadiums", VIDEOS_PAGE_LIMIT),
  ]);

  const hasAny = thirdHalfVideos.length > 0 || fromStadiumsVideos.length > 0;

  return (
    <div className="container space-y-6 py-8">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {hasAny ? (
        <>
          {thirdHalfVideos.length > 0 && (
            <VideosSection
              title={tHome("videoThirdHalf")}
              locale={locale}
              videos={thirdHalfVideos}
            />
          )}

          {fromStadiumsVideos.length > 0 && (
            <VideosSection
              title={tHome("videoFromStadiums")}
              locale={locale}
              videos={fromStadiumsVideos}
            />
          )}
        </>
      ) : (
        <p className="text-muted-foreground text-center py-12">{t("noVideos")}</p>
      )}
    </div>
  );
}
